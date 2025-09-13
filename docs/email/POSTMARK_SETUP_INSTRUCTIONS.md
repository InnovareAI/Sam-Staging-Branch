# 📧 Postmark + Supabase Invitation Setup

## 🔧 **Step 1: Configure SMTP in Supabase Dashboard**

1. Go to your Supabase project: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
2. Navigate to: **Authentication → Email Templates**
3. Click **"Settings"** tab
4. Click **"Enable custom SMTP"**

### SMTP Configuration:
```
SMTP Host: smtp.postmarkapp.com
SMTP Port: 587 (with STARTTLS)
SMTP Username: bf9e070d-eec7-4c41-8fb5-1d37fe384723
SMTP Password: bf9e070d-eec7-4c41-8fb5-1d37fe384723
Sender Email: sp@innovareai.com
Sender Name: Sarah Powell - SAM AI
```

## 📝 **Step 2: Customize Invitation Email Template**

1. In Supabase Dashboard, go to: **Authentication → Email Templates**
2. Click on **"Invite user"** template
3. Replace the default template with this HTML:

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

        <p><strong>{{ .Data.invited_by_email }}</strong> has invited you to join <strong>{{ .Data.organization_name }}</strong> on the SAM AI Platform.</p>

        <div class="organization-info">
            <h3 style="margin: 0 0 10px 0; color: #7c3aed;">🏢 Organization Details</h3>
            <p style="margin: 0;"><strong>Organization:</strong> {{ .Data.organization_name }}</p>
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

## 🔗 **Step 3: Update Site URL**

1. In Supabase Dashboard, go to: **Authentication → URL Configuration**
2. Set **Site URL** to: `http://localhost:3001` (or your deployed URL)
3. Add **Redirect URLs**:
   - `http://localhost:3001/auth/callback`
   - `https://your-deployed-url.com/auth/callback`

## ✅ **Step 4: Test the System**

1. Go to `/admin` in your app
2. Select an organization (e.g., "3cubed")
3. Add a test email address:
   ```
   test@example.com Test User
   ```
4. Click "Send All Invitations"
5. Check that the invitation email is sent via Postmark

## 🚨 **Important Notes:**

- **Postmark Token**: Already configured as `bf9e070d-eec7-4c41-8fb5-1d37fe384723`
- **From Email**: `sp@innovareai.com` (Sarah Powell - SAM AI)
- **Callback URL**: Points to `/auth/callback` which handles organization assignment
- **Email Template**: Uses custom HTML with SAM AI branding

## 🔧 **Troubleshooting:**

- If emails aren't sending, check Postmark dashboard for bounces/errors
- If invitation links don't work, verify the Site URL matches your domain
- Test with a real email address you can access
- Check browser console for any JavaScript errors during callback

The system is now ready for production-quality email invitations! 📧✨