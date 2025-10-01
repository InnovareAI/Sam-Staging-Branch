# OAuth Setup Guide for Email Providers

This guide will walk you through setting up OAuth authentication for Google and Microsoft email integrations.

---

## 🎯 Overview

You need to create OAuth applications in:
1. **Google Cloud Console** - for Gmail/Google Workspace
2. **Azure Portal** - for Outlook/Microsoft 365

Both setups take about 10 minutes each.

---

## 📧 Part 1: Google OAuth Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click **"Select a project"** dropdown at the top
4. Click **"NEW PROJECT"**
5. Enter project name: `SAM Email Integration`
6. Click **"CREATE"**
7. Wait for project creation, then select it from the dropdown

### Step 2: Enable Gmail API

1. In the left sidebar, click **"APIs & Services"** → **"Library"**
2. Search for **"Gmail API"**
3. Click on **"Gmail API"**
4. Click **"ENABLE"**
5. Wait for it to enable (~30 seconds)

### Step 3: Configure OAuth Consent Screen

1. In the left sidebar, click **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"External"** (unless you have a Google Workspace account, then choose Internal)
3. Click **"CREATE"**

4. **Fill in App Information:**
   - **App name:** `SAM AI Platform`
   - **User support email:** Your email address
   - **App logo:** (Optional) Upload your logo
   - **Application home page:** `http://localhost:3003` (or your production URL)
   - **Authorized domains:** Add `localhost` for development
   - **Developer contact email:** Your email address
   
5. Click **"SAVE AND CONTINUE"**

6. **Scopes Page:**
   - Click **"ADD OR REMOVE SCOPES"**
   - Filter for and select these scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/userinfo.email`
   - Click **"UPDATE"**
   - Click **"SAVE AND CONTINUE"**

7. **Test Users (if External):**
   - Click **"ADD USERS"**
   - Add email addresses that will test the integration
   - Click **"ADD"**
   - Click **"SAVE AND CONTINUE"**

8. Click **"BACK TO DASHBOARD"**

### Step 4: Create OAuth Credentials

1. In the left sidebar, click **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**

4. **Configure OAuth Client:**
   - **Application type:** Select **"Web application"**
   - **Name:** `SAM Email OAuth Client`
   
5. **Authorized redirect URIs:**
   - Click **"+ ADD URI"**
   - For **development**, add:
     ```
     http://localhost:3003/api/email-providers/google/callback
     ```
   - For **production**, add:
     ```
     https://yourdomain.com/api/email-providers/google/callback
     ```
   - Click **"CREATE"**

6. **Save Your Credentials:**
   - A popup will appear with your credentials
   - **Copy the Client ID** - starts with something like `123456789-abc...googleusercontent.com`
   - **Copy the Client Secret** - looks like `GOCSPX-abc123...`
   - Click **"OK"**

### Step 5: Add to Environment Variables

Add these to your `.env.local` file:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3003/api/email-providers/google/callback
```

For production (Netlify/Vercel), add these same variables to your deployment environment variables.

---

## 🔷 Part 2: Microsoft OAuth Setup

### Step 1: Access Azure Portal

1. Go to [Azure Portal](https://portal.azure.com/)
2. Sign in with your Microsoft account
3. If you don't have an Azure account, create one (free tier available)

### Step 2: Register a New Application

1. In the search bar at the top, type **"Azure Active Directory"**
2. Click on **"Azure Active Directory"**
3. In the left sidebar, click **"App registrations"**
4. Click **"+ New registration"** at the top

### Step 3: Configure Application

1. **Name:** `SAM AI Platform Email Integration`

2. **Supported account types:** Select:
   - **"Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts"**
   - This allows both personal Outlook.com and business Microsoft 365 accounts

3. **Redirect URI:**
   - Select **"Web"** from the dropdown
   - For **development**, enter:
     ```
     http://localhost:3003/api/email-providers/microsoft/callback
     ```
   - You can add production URI later

4. Click **"Register"**

### Step 4: Copy Application (Client) ID

1. You'll be redirected to the app's Overview page
2. **Copy the "Application (client) ID"** - it's a UUID like `12345678-1234-1234-1234-123456789abc`
3. Save this - you'll need it for `MICROSOFT_CLIENT_ID`

### Step 5: Create Client Secret

1. In the left sidebar, click **"Certificates & secrets"**
2. Click on the **"Client secrets"** tab
3. Click **"+ New client secret"**
4. **Description:** `SAM Platform OAuth Secret`
5. **Expires:** Select **"24 months"** (or your preferred duration)
6. Click **"Add"**
7. **IMPORTANT:** Immediately copy the **"Value"** (not the Secret ID!)
   - This is shown only once - you cannot retrieve it later
   - It looks like: `abc123~xyz789...`
8. Save this - you'll need it for `MICROSOFT_CLIENT_SECRET`

### Step 6: Configure API Permissions

1. In the left sidebar, click **"API permissions"**
2. Click **"+ Add a permission"**
3. Select **"Microsoft Graph"**
4. Select **"Delegated permissions"**
5. Search for and select these permissions:
   - `Mail.Read` - Read user mail
   - `Mail.Send` - Send mail as a user
   - `User.Read` - Sign in and read user profile
6. Click **"Add permissions"**
7. Click **"Grant admin consent for [Your Organization]"** (if available)
8. Click **"Yes"** to confirm

### Step 7: Add Production Redirect URI (Optional)

1. In the left sidebar, click **"Authentication"**
2. Under **"Platform configurations"**, find your Web platform
3. Click **"Add URI"**
4. Add your production callback URL:
   ```
   https://yourdomain.com/api/email-providers/microsoft/callback
   ```
5. Click **"Save"** at the bottom

### Step 8: Add to Environment Variables

Add these to your `.env.local` file:

```bash
# Microsoft OAuth
MICROSOFT_CLIENT_ID=your_application_client_id_here
MICROSOFT_CLIENT_SECRET=your_client_secret_value_here
MICROSOFT_REDIRECT_URI=http://localhost:3003/api/email-providers/microsoft/callback
```

For production, add these same variables to your deployment environment variables.

---

## 🧪 Part 3: Testing Your Setup

### Step 1: Verify Environment Variables

Run this command to check your configuration:

```bash
node test-oauth-setup.cjs
```

You should see:
```
✅ All OAuth credentials are configured!
🎉 You can now connect Google and Microsoft accounts
```

### Step 2: Start Your Development Server

```bash
npm run dev
```

### Step 3: Test OAuth Flow

1. Open your app at `http://localhost:3003`
2. Sign in to your account
3. Navigate to **Settings** → **Email Integration**
4. Click **"Google"** or **"Microsoft"** button
5. You should be redirected to the OAuth consent screen
6. Grant permissions
7. You'll be redirected back to your app
8. The email account should now appear in "Connected Email Accounts"

---

## 🚀 Part 4: Production Deployment

### For Netlify:

1. Go to your Netlify dashboard
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Add all 6 environment variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` (use production URL)
   - `MICROSOFT_CLIENT_ID`
   - `MICROSOFT_CLIENT_SECRET`
   - `MICROSOFT_REDIRECT_URI` (use production URL)

5. Update redirect URIs in both Google and Microsoft consoles to use production URLs:
   - Google: `https://yourdomain.com/api/email-providers/google/callback`
   - Microsoft: `https://yourdomain.com/api/email-providers/microsoft/callback`

6. Redeploy your site

---

## ⚠️ Common Issues & Solutions

### Issue: "redirect_uri_mismatch" Error

**Solution:** 
- Make sure the redirect URI in your OAuth app configuration exactly matches the one in your environment variables
- Check for trailing slashes
- Verify the protocol (http vs https)

### Issue: "invalid_client" Error

**Solution:**
- Verify your Client ID and Client Secret are correct
- Make sure there are no extra spaces when copying credentials
- Check that the credentials are for the correct environment (dev vs prod)

### Issue: "access_denied" Error

**Solution:**
- User declined permissions
- Try the flow again
- Make sure all required scopes are added in the OAuth app configuration

### Issue: Microsoft - "AADSTS50011" Error

**Solution:**
- The reply URL doesn't match
- Go to Azure Portal → Your App → Authentication
- Verify the redirect URI is exactly correct

### Issue: Google - "This app isn't verified"

**Solution:**
- This is normal during development
- Click "Advanced" → "Go to SAM AI Platform (unsafe)"
- For production, submit your app for Google verification

---

## 📝 Security Best Practices

1. **Never commit credentials to Git**
   - Use `.env.local` for local development
   - Add `.env.local` to `.gitignore`

2. **Use different credentials for dev and production**
   - Create separate OAuth apps for each environment

3. **Rotate secrets regularly**
   - Change client secrets every 6-12 months

4. **Limit scope permissions**
   - Only request the permissions you actually need

5. **Enable 2FA on cloud accounts**
   - Protect your Google Cloud Console and Azure Portal accounts

---

## 🎉 Success!

Once configured, users can:
- ✅ Connect Google Gmail/Workspace accounts via OAuth
- ✅ Connect Microsoft Outlook/365 accounts via OAuth  
- ✅ Add custom SMTP accounts (no OAuth needed)
- ✅ Manage multiple email accounts for campaigns
- ✅ See real-time connection status

The OAuth tokens are automatically refreshed when they expire, so users don't need to re-authenticate!

---

## 📞 Need Help?

- Google OAuth Docs: https://developers.google.com/identity/protocols/oauth2
- Microsoft OAuth Docs: https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow
- Check server logs for detailed error messages
- Review the setup documentation: `docs/email-providers-setup.md`
