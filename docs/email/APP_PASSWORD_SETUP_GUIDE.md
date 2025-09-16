# 📧 App Password Setup Guide for Campaign Emails

**⚠️ CRITICAL:** Google and Microsoft no longer support regular passwords for SMTP authentication. You **MUST** use app-specific passwords instead of OAuth for campaign email sending.

## 🔐 Why App Passwords Are Required

- **OAuth limitations**: OAuth tokens expire and require complex refresh flows
- **SMTP compatibility**: App passwords work with standard SMTP libraries
- **Security**: App passwords are scoped and can be revoked independently
- **Reliability**: No token expiration issues during campaigns

---

## 📮 Gmail/Google Workspace Setup

### Prerequisites
- ✅ Google account with 2-Factor Authentication enabled
- ✅ Gmail or Google Workspace email address

### Step-by-Step Instructions

#### 1. Enable 2-Factor Authentication
- Go to [Google Account Security](https://myaccount.google.com/security)
- Under "Signing in to Google", enable **2-Step Verification**
- Complete the setup with your phone number

#### 2. Generate App Password
- In Google Account Settings, go to **Security**
- Under "Signing in to Google", click **App passwords**
- You may need to sign in again
- Select **Mail** from the dropdown
- Choose **Other (Custom name)** and enter: "SAM AI Campaign Email"
- Click **Generate**

#### 3. Copy the App Password
- Google will show a **16-character password** (like: `abcd efgh ijkl mnop`)
- **Copy this exactly** - this is what you'll use as the password
- ⚠️ **Never use your regular Gmail password**

#### 4. Configure in SAM AI
```json
{
  "emailAddress": "your-email@gmail.com",
  "displayName": "Your Name - Company",
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "smtpUsername": "your-email@gmail.com",
  "smtpPassword": "abcd efgh ijkl mnop",
  "smtpUseTls": true,
  "providerType": "gmail"
}
```

---

## 📧 Outlook/Office365/Hotmail Setup  

### Prerequisites
- ✅ Microsoft account with 2-Factor Authentication enabled
- ✅ Outlook.com, Hotmail.com, or Office365 email address

### Step-by-Step Instructions

#### 1. Enable 2-Factor Authentication
- Go to [Microsoft Account Security](https://account.microsoft.com/security)
- Under **Sign-in options**, enable **Two-step verification**
- Complete setup with your phone number or authenticator app

#### 2. Generate App Password
- In Microsoft Account, go to **Security**
- Click **Advanced security options**
- Under **App passwords**, click **Create a new app password**
- Enter name: "SAM AI Campaign Email"
- Click **Next**

#### 3. Copy the App Password
- Microsoft will show a **16-character password**
- **Copy this exactly** - this is your SMTP password
- ⚠️ **Never use your regular Outlook password**

#### 4. Configure in SAM AI
```json
{
  "emailAddress": "your-email@outlook.com",
  "displayName": "Your Name - Company", 
  "smtpHost": "smtp-mail.outlook.com",
  "smtpPort": 587,
  "smtpUsername": "your-email@outlook.com",
  "smtpPassword": "your-16-char-app-password",
  "smtpUseTls": true,
  "providerType": "outlook"
}
```

---

## 🏢 Custom Business Email Setup

### For Business Email Providers (Not Gmail/Outlook)

Most business email providers still accept regular passwords, but check with your IT team:

#### Common Business SMTP Settings
```json
{
  "emailAddress": "sales@yourcompany.com",
  "displayName": "Sales Team - Your Company",
  "smtpHost": "mail.yourcompany.com",
  "smtpPort": 587,
  "smtpUsername": "sales@yourcompany.com", 
  "smtpPassword": "your-email-password",
  "smtpUseTls": true,
  "providerType": "custom"
}
```

#### Popular Business Email Providers
- **GoDaddy**: `smtpout.secureserver.net:465` (SSL) or `:587` (TLS)
- **Bluehost**: `mail.yourdomain.com:587` (TLS)
- **HostGator**: `mail.yourdomain.com:587` (TLS)
- **Namecheap**: `mail.privateemail.com:587` (TLS)

---

## 🔧 Testing Your Configuration

### Using SAM AI's Built-in Test
1. Configure your email account via: `POST /api/campaign/email-accounts`
2. The system will automatically test the SMTP connection
3. If successful, account is marked as **verified**
4. If failed, you'll get specific error details

### Manual Testing with Test Email
```bash
curl -X POST http://localhost:3000/api/campaign/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "your-workspace-id",
    "emailAccountId": "your-account-id", 
    "recipientEmail": "test@yourdomain.com",
    "recipientName": "Test User",
    "subjectLine": "Test Campaign Email",
    "messageBody": "<p>This is a test email from SAM AI campaign system.</p>"
  }'
```

---

## ❌ Common Issues & Solutions

### Gmail Issues
**Error: "Username and Password not accepted"**
- ✅ Make sure 2FA is enabled
- ✅ Use app password, not regular password  
- ✅ Username must be full email address
- ✅ Check that app password was copied correctly (no spaces)

**Error: "Less secure app access"**
- ✅ Google disabled this - you MUST use app passwords now
- ✅ Cannot use regular Gmail password anymore

### Outlook Issues  
**Error: "Authentication failed"**
- ✅ Enable 2FA first, then create app password
- ✅ Use smtp-mail.outlook.com (not smtp.live.com)
- ✅ Port 587 with STARTTLS
- ✅ Username must be full email address

**Error: "SMTP not enabled"**
- ✅ Some Outlook accounts have SMTP disabled
- ✅ Go to Outlook settings > Mail > Sync email
- ✅ Enable "IMAP/SMTP settings"

### Rate Limiting Issues
**Error: "Daily send limit exceeded"**
- ✅ Gmail: 500 emails/day limit (2000 for Workspace)  
- ✅ Outlook: 300 emails/day limit
- ✅ Use multiple accounts or reduce sending rate

---

## 🛡️ Security Best Practices

### App Password Management
- ✅ **Create unique app passwords** for each application
- ✅ **Use descriptive names** like "SAM AI Campaign Tool"
- ✅ **Revoke unused app passwords** regularly
- ✅ **Never share app passwords** - they're account-specific

### Account Security
- ✅ **Enable 2FA** on all email accounts used for campaigns
- ✅ **Use dedicated email accounts** for outreach (not personal)
- ✅ **Monitor bounce/complaint rates** to maintain reputation
- ✅ **Set up SPF/DKIM records** for better deliverability

### Campaign Email Best Practices
- ✅ **Start with low volume** (50-100 emails/day) to build reputation
- ✅ **Warm up new email accounts** gradually
- ✅ **Monitor delivery rates** and adjust if needed
- ✅ **Use professional email signatures** and unsubscribe links

---

## 📞 Getting Help

If you're still having issues:

1. **Check SAM AI logs** for specific error messages
2. **Test SMTP settings** with an email client first
3. **Verify 2FA and app passwords** are set up correctly
4. **Contact your email provider** for business email issues
5. **Consider using a dedicated email service** like Postmark or SendGrid for high volume

---

**✅ Once configured correctly, your campaign emails will send reliably through your chosen email provider with proper authentication and tracking!**