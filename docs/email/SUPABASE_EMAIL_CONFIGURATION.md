# 📧 SUPABASE EMAIL CONFIGURATION GUIDE

## CONFIGURE CUSTOM SMTP IN SUPABASE

### 🔗 Dashboard Access
**Supabase Project**: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/auth/settings

---

## ⚙️ SMTP CONFIGURATION SETTINGS

### Navigate to Authentication Settings:
1. Go to Supabase Dashboard
2. Select your project: `latxadqrvrrrcvkktrog`
3. Navigate to: **Authentication > Settings**
4. Scroll to **Email Auth** section
5. Click **"Enable custom SMTP"**

### SMTP Server Settings:
```
SMTP Host: smtp.postmarkapp.com
SMTP Port: 587
SMTP User: bf9e070d-eec7-4c41-8fb5-1d37fe384723
SMTP Pass: bf9e070d-eec7-4c41-8fb5-1d37fe384723
SMTP Sender Name: Sarah Powell - SAM AI
SMTP Sender Email: sp@innovareai.com
```

### Advanced Settings:
```
Enable TLS: ✅ Yes
Enable SSL: ❌ No (use TLS instead)
Connection Timeout: 30 seconds
```

---

## 📝 EMAIL TEMPLATES CONFIGURATION

### Navigate to Email Templates:
1. In Supabase Dashboard: **Authentication > Email Templates**
2. Configure each template:

### 1. Invite User Template:
**Subject**: `You're invited to join SAM AI Platform`

**HTML Template**:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>You're Invited to SAM AI Platform</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; }
        .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 32px; font-weight: bold; color: #7c3aed; margin-bottom: 10px; }
        .invite-button { display: inline-block; background: linear-gradient(135deg, #7c3aed, #a855f7); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3); }
        .organization-info { background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🤖 SAM AI</div>
            <h1 style="color: #1e293b; margin: 0;">You're Invited!</h1>
        </div>

        <p>Hi there!</p>

        <p>You've been invited to join the SAM AI Platform.</p>

        <div class="organization-info">
            <h3 style="margin: 0 0 10px 0; color: #7c3aed;">🏢 Organization Details</h3>
            <p style="margin: 0;"><strong>Invited to:</strong> {{ .Data.organization_name }}</p>
            <p style="margin: 0;"><strong>Role:</strong> {{ .Data.role | title }}</p>
            <p style="margin: 0;"><strong>Invited by:</strong> {{ .Data.invited_by_email }}</p>
        </div>

        <div style="text-align: center;">
            <a href="{{ .ConfirmationURL }}" class="invite-button">
                🚀 Accept Invitation & Join SAM AI
            </a>
        </div>

        <p>Welcome to the future of AI-powered sales! 🎉</p>

        <div style="margin-top: 30px; text-align: center; color: #64748b; font-size: 14px;">
            <p>SAM AI Platform | Powered by InnovareAI</p>
            <p>This invitation was sent to {{ .Email }}</p>
        </div>
    </div>
</body>
</html>
```

### 2. Confirm Signup Template:
**Subject**: `Confirm your SAM AI account`

**HTML Template**:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Confirm Your SAM AI Account</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; }
        .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 32px; font-weight: bold; color: #7c3aed; margin-bottom: 10px; }
        .confirm-button { display: inline-block; background: linear-gradient(135deg, #7c3aed, #a855f7); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🤖 SAM AI</div>
            <h1 style="color: #1e293b; margin: 0;">Confirm Your Account</h1>
        </div>

        <p>Hi {{ .Data.first_name }}!</p>

        <p>Thanks for signing up for SAM AI! Please confirm your email address to activate your account.</p>

        <div style="text-align: center;">
            <a href="{{ .ConfirmationURL }}" class="confirm-button">
                ✅ Confirm Email Address
            </a>
        </div>

        <p>If you didn't create this account, you can safely ignore this email.</p>

        <div style="margin-top: 30px; text-align: center; color: #64748b; font-size: 14px;">
            <p>SAM AI Platform | Powered by InnovareAI</p>
            <p>This email was sent to {{ .Email }}</p>
        </div>
    </div>
</body>
</html>
```

### 3. Password Recovery Template:
**Subject**: `Reset your SAM AI password`

**HTML Template**: 
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reset Your SAM AI Password</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; }
        .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 32px; font-weight: bold; color: #7c3aed; margin-bottom: 10px; }
        .reset-button { display: inline-block; background: linear-gradient(135deg, #7c3aed, #a855f7); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🤖 SAM AI</div>
            <h1 style="color: #1e293b; margin: 0;">Reset Your Password</h1>
        </div>

        <p>Hi there!</p>

        <p>You requested to reset your SAM AI account password. Click the button below to set a new password:</p>

        <div style="text-align: center;">
            <a href="{{ .ConfirmationURL }}" class="reset-button">
                🔑 Reset Password
            </a>
        </div>

        <p>If you didn't request this password reset, you can safely ignore this email.</p>
        
        <p><strong>This link will expire in 1 hour for security reasons.</strong></p>

        <div style="margin-top: 30px; text-align: center; color: #64748b; font-size: 14px;">
            <p>SAM AI Platform | Powered by InnovareAI</p>
            <p>This email was sent to {{ .Email }}</p>
        </div>
    </div>
</body>
</html>
```

---

## 🔧 URL CONFIGURATION

### Site URL Settings:
1. Go to **Authentication > URL Configuration**
2. Set the following URLs:

```
Site URL: https://app.meet-sam.com
Additional Redirect URLs:
- http://localhost:3001/auth/callback  
- https://app.meet-sam.com/auth/callback
```

---

## ✅ TESTING THE CONFIGURATION

### Test SMTP Connection:
1. Save SMTP settings
2. Click **"Send Test Email"** button
3. Check if test email arrives in inbox (not spam)

### Test Invitation Flow:
1. Go to admin panel in your app
2. Send a test invitation
3. Check recipient's email (inbox and spam folder)
4. Verify template renders correctly
5. Test confirmation URL functionality

---

## 🚨 TROUBLESHOOTING

### If emails still don't arrive:
1. Check Postmark dashboard for delivery status
2. Verify DNS records are propagated (allow 30 minutes)
3. Check spam folders in recipient email
4. Test with multiple email providers (Gmail, Outlook)

### Common Issues:
- **Template variables not rendering**: Check template syntax
- **Emails in spam**: Verify DKIM/SPF DNS records
- **SMTP connection failed**: Double-check credentials
- **Slow delivery**: DNS propagation may still be in progress

---

**Configuration completed successfully should result in:**
✅ Custom SMTP using Postmark
✅ Professional email templates  
✅ Proper authentication headers
✅ Improved inbox delivery rates