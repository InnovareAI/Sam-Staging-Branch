# Email Providers Integration Setup

## Overview

The SAM AI Platform now supports multiple email providers for cold email campaigns:
- **Google Workspace** (Gmail) via OAuth 2.0
- **Microsoft 365** (Outlook) via OAuth 2.0
- **Custom SMTP** providers

## Features

✅ **Multiple Account Management**: Add and manage multiple email accounts
✅ **OAuth Security**: Secure authentication for Google and Microsoft accounts
✅ **SMTP Support**: Connect custom email servers
✅ **Account Status Monitoring**: Real-time connection status indicators
✅ **Account Rotation**: Use multiple accounts for better deliverability

## Prerequisites

### 1. Environment Variables

Add the following to your `.env.local` file:

```bash
# OAuth Redirect URLs
NEXTAUTH_URL=http://localhost:3003  # Or your production domain
GOOGLE_REDIRECT_URI=http://localhost:3003/api/email-providers/google/callback
MICROSOFT_REDIRECT_URI=http://localhost:3003/api/email-providers/microsoft/callback

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Microsoft OAuth Credentials
MICROSOFT_CLIENT_ID=your_microsoft_client_id_here
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret_here
```

### 2. Google Cloud Platform Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Gmail API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Authorized redirect URIs: `http://localhost:3003/api/email-providers/google/callback`
   - For production: `https://yourdomain.com/api/email-providers/google/callback`
5. Copy the Client ID and Client Secret to your `.env.local`

**Required Scopes:**
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/userinfo.email`

### 3. Microsoft Azure Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" → "App registrations"
3. Click "New registration"
   - Name: "SAM AI Platform Email Integration"
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: `http://localhost:3003/api/email-providers/microsoft/callback`
   - For production: `https://yourdomain.com/api/email-providers/microsoft/callback`
4. Copy the "Application (client) ID" to `MICROSOFT_CLIENT_ID`
5. Create a client secret:
   - Go to "Certificates & secrets"
   - Click "New client secret"
   - Copy the secret value to `MICROSOFT_CLIENT_SECRET`
6. Configure API permissions:
   - Go to "API permissions"
   - Add permissions: Microsoft Graph
   - Select delegated permissions:
     - `Mail.Read`
     - `Mail.Send`
     - `User.Read`

**Required Scopes:**
- `https://graph.microsoft.com/Mail.Read`
- `https://graph.microsoft.com/Mail.Send`
- `https://graph.microsoft.com/User.Read`

## Database Schema

The email providers are stored in the `email_providers` table:

```sql
CREATE TABLE email_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_type text NOT NULL CHECK (provider_type IN ('google', 'microsoft', 'smtp')),
    provider_name text NOT NULL,
    email_address text NOT NULL,
    status text NOT NULL DEFAULT 'disconnected',
    
    -- OAuth fields
    oauth_access_token text,
    oauth_refresh_token text,
    oauth_token_expires_at timestamp with time zone,
    oauth_scopes text[],
    
    -- SMTP fields
    smtp_host text,
    smtp_port integer,
    smtp_username text,
    smtp_password_encrypted text,
    smtp_use_tls boolean DEFAULT true,
    
    config jsonb DEFAULT '{}',
    last_sync timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    UNIQUE(user_id, email_address, provider_type)
);
```

## API Endpoints

### List Email Providers
```
GET /api/email-providers
```

Returns all email providers for the authenticated user.

### Add Email Provider (SMTP)
```
POST /api/email-providers
Content-Type: application/json

{
  "provider_type": "smtp",
  "provider_name": "Custom SMTP",
  "email_address": "your-email@domain.com",
  "config": {
    "host": "smtp.gmail.com",
    "port": 587,
    "username": "your-email@domain.com",
    "password": "your-app-password",
    "use_tls": true,
    "use_ssl": false
  }
}
```

### Delete Email Provider
```
DELETE /api/email-providers/[id]
```

### Google OAuth Flow
1. **Initiate**: `GET /api/email-providers/google/auth`
2. **Callback**: `GET /api/email-providers/google/callback?code=...&state=...`

### Microsoft OAuth Flow
1. **Initiate**: `GET /api/email-providers/microsoft/auth`
2. **Callback**: `GET /api/email-providers/microsoft/callback?code=...&state=...`

## Usage in UI

The email providers modal can be accessed from:
1. Settings menu → "Email Integration"
2. Campaign creation → Select email account

### Adding an Account

**Google/Microsoft OAuth:**
1. Click "Add Account" button
2. Select "Google" or "Microsoft"
3. You'll be redirected to the OAuth consent screen
4. Grant permissions
5. You'll be redirected back with the account connected

**SMTP:**
1. Click "Add Account" button
2. Select "SMTP"
3. Fill in the form:
   - Email address
   - SMTP host (e.g., `smtp.gmail.com`)
   - Port (usually 587 for TLS, 465 for SSL)
   - Username
   - Password (use app-specific password for Gmail)
   - Enable TLS/SSL as needed
4. Click "Add SMTP Account"

### Gmail App Passwords

For SMTP connections to Gmail:
1. Enable 2-factor authentication on your Google account
2. Go to [App Passwords](https://myaccount.google.com/apppasswords)
3. Generate a new app password for "Mail"
4. Use this password in the SMTP configuration

## Security Considerations

⚠️ **Important Security Notes:**

1. **Token Encryption**: In production, OAuth tokens and SMTP passwords should be encrypted at rest
2. **Environment Variables**: Never commit `.env.local` to version control
3. **HTTPS**: Always use HTTPS in production for OAuth callbacks
4. **App Passwords**: Use app-specific passwords, not main account passwords
5. **Scope Minimization**: Request only the OAuth scopes you need

## Troubleshooting

### Google OAuth Issues

**Error: "redirect_uri_mismatch"**
- Ensure the redirect URI in Google Cloud Console exactly matches your environment variable
- Check for trailing slashes
- Verify the protocol (http vs https)

**Error: "invalid_grant"**
- The authorization code may have expired
- Try the OAuth flow again

### Microsoft OAuth Issues

**Error: "AADSTS50011: The reply URL specified in the request does not match"**
- Verify the redirect URI in Azure Portal matches your environment variable
- Ensure the URI is added to the app registration

### SMTP Issues

**Connection Timeout**
- Check firewall settings
- Verify SMTP host and port are correct
- Try different ports (587, 465, 25)

**Authentication Failed**
- For Gmail, use an app-specific password
- Verify username and password are correct
- Check if "Less secure app access" is enabled (not recommended)

## Testing

To test the email providers integration:

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open the app** at `http://localhost:3003`

3. **Sign in** to your account

4. **Navigate to Settings** and click "Email Integration"

5. **Add a test account:**
   - For OAuth: Follow the OAuth flow
   - For SMTP: Use a test SMTP server like Mailtrap

6. **Verify** the account appears in the list with "connected" status

## Future Enhancements

- [ ] Token refresh automation
- [ ] Email sending rate limiting
- [ ] Account health monitoring
- [ ] Automatic failover between accounts
- [ ] Email warm-up sequences
- [ ] SPF/DKIM/DMARC verification
- [ ] Bounce and complaint handling

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review server logs for error messages
3. Verify environment variables are set correctly
4. Ensure database migrations have been run
