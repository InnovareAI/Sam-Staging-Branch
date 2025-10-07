# Google & Microsoft Email Integration
**Status:** ✅ FULLY IMPLEMENTED AND PRODUCTION READY
**Date:** October 7, 2025

---

## 🎉 INTEGRATION STATUS

**Google Gmail** and **Microsoft Outlook** email integration via Unipile is **ALREADY COMPLETE**!

No additional development work needed - the system is fully functional and ready to use.

---

## 🔧 HOW IT WORKS

### Architecture:
```
User (SAM UI)
    ↓
EmailProvidersModal Component
    ↓
POST /api/unipile/hosted-auth
    provider: "GOOGLE" or "OUTLOOK"
    ↓
Unipile Hosted Auth (OAuth)
    https://auth.meet-sam.com (white-labeled)
    ↓
Google/Microsoft OAuth Consent
    ↓
Unipile Callback
    ↓
POST /api/unipile/hosted-auth/callback
    ↓
Save to user_unipile_accounts table
    ↓
✅ Email Account Connected
```

---

## 📁 KEY FILES

### 1. **UI Component**
**File:** `/app/components/EmailProvidersModal.tsx`

```typescript
// Google OAuth (lines 95-119)
const connectGoogle = async () => {
  const response = await fetch('/api/unipile/hosted-auth', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'GOOGLE',
      type: 'MESSAGING',
    }),
  });
  // Redirects to Google OAuth via auth.meet-sam.com
};

// Microsoft OAuth (lines 122-146)
const connectMicrosoft = async () => {
  const response = await fetch('/api/unipile/hosted-auth', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'OUTLOOK',
      type: 'MESSAGING',
    }),
  });
  // Redirects to Microsoft OAuth via auth.meet-sam.com
};
```

### 2. **Hosted Auth API**
**File:** `/app/api/unipile/hosted-auth/route.ts`

**Purpose:** Generates OAuth URL via Unipile API

**Supports:**
- `GOOGLE` - Gmail accounts
- `OUTLOOK` - Microsoft 365, Outlook.com
- `LINKEDIN` - LinkedIn messaging

**White-labeling:**
- Replaces `account.unipile.com` → `auth.meet-sam.com`
- Custom domain configured with SSL
- Branded authentication experience

### 3. **OAuth Callback**
**File:** `/app/api/unipile/hosted-auth/callback/route.ts`

**Purpose:** Saves connected account after OAuth

**Saves to:** `user_unipile_accounts` table
- `user_id` - User who connected
- `unipile_account_id` - Unipile account ID
- `platform` - `GOOGLE`, `OUTLOOK`, or `LINKEDIN`
- `account_email` - Connected email address
- `account_name` - Display name
- `connection_status` - `active`, `disconnected`, `error`

---

## 🗄️ DATABASE SCHEMA

### Table: `user_unipile_accounts`

```sql
CREATE TABLE user_unipile_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  unipile_account_id TEXT UNIQUE NOT NULL,
  platform TEXT NOT NULL, -- 'GOOGLE', 'OUTLOOK', 'LINKEDIN'
  account_name TEXT,
  account_email TEXT,
  connection_status TEXT DEFAULT 'active',
  linkedin_public_identifier TEXT,
  linkedin_profile_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_unipile_accounts_user_id
  ON user_unipile_accounts(user_id);

CREATE INDEX idx_user_unipile_accounts_platform
  ON user_unipile_accounts(platform);
```

---

## 🚀 USER WORKFLOW

### **Connecting Google:**

1. User goes to **Settings → Integrations**
2. Clicks **"Connect Google"** button
3. Redirected to `https://auth.meet-sam.com/...`
4. Sees Google OAuth consent screen
5. Grants permissions:
   - ✅ Read email
   - ✅ Send email
   - ✅ Manage email
6. Redirected back to SAM
7. ✅ Google account connected!

### **Connecting Microsoft:**

1. User goes to **Settings → Integrations**
2. Clicks **"Connect Microsoft"** button
3. Redirected to `https://auth.meet-sam.com/...`
4. Sees Microsoft OAuth consent screen
5. Grants permissions:
   - ✅ Read email
   - ✅ Send email
   - ✅ Manage email
6. Redirected back to SAM
7. ✅ Microsoft account connected!

---

## 🔐 REQUIRED PERMISSIONS

### **Google OAuth Scopes:**
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.modify`

### **Microsoft OAuth Scopes:**
- `https://graph.microsoft.com/Mail.Read`
- `https://graph.microsoft.com/Mail.Send`
- `https://graph.microsoft.com/Mail.ReadWrite`

**Note:** Unipile handles OAuth scopes automatically

---

## ✅ VERIFICATION

### **Check Connected Accounts:**

```sql
-- View all connected email accounts
SELECT
  u.email as user_email,
  uua.platform,
  uua.account_email,
  uua.account_name,
  uua.connection_status,
  uua.created_at
FROM user_unipile_accounts uua
JOIN auth.users u ON u.id = uua.user_id
WHERE uua.platform IN ('GOOGLE', 'OUTLOOK')
ORDER BY uua.created_at DESC;
```

### **Test Email Sending:**

```typescript
// Use UnipileSender service
import { unipileSender } from '@/lib/services/unipile-sender';

const result = await unipileSender.sendEmail({
  accountId: 'unipile_account_id_here',
  recipientEmail: 'prospect@example.com',
  subject: 'Test Email',
  messageBody: 'Hello from SAM!'
});

console.log(result.success ? 'Sent!' : result.error);
```

---

## 🎯 USE CASES

### **1. Email Campaigns**
Send personalized email campaigns using connected Gmail/Outlook accounts:
- Higher deliverability (user's own domain)
- No shared IP reputation issues
- Personal email address (more trustworthy)

### **2. Reply Management**
Handle prospect replies via connected email:
- Replies go to user's actual inbox
- SAM can read and process via Unipile
- HITL workflow for approval

### **3. Multi-Account Support**
Users can connect multiple email accounts:
- Personal Gmail
- Work Microsoft 365
- Multiple domains
- Choose which account for each campaign

---

## 🐛 TROUBLESHOOTING

### **Issue: "Failed to connect Google account"**

**Check:**
```bash
# 1. Verify environment variables
echo $UNIPILE_DSN
echo $UNIPILE_API_KEY

# 2. Check Unipile API status
curl https://${UNIPILE_DSN}/api/v1/accounts \
  -H "X-API-KEY: ${UNIPILE_API_KEY}"

# 3. Verify custom domain
curl -I https://auth.meet-sam.com
# Should return 200 OK
```

**Common Causes:**
- Missing `UNIPILE_DSN` or `UNIPILE_API_KEY`
- Unipile API down
- Custom domain not configured
- User denied OAuth permissions

---

### **Issue: "Account shows as 'disconnected'"**

**Fix:**
```sql
-- Check account status
SELECT * FROM user_unipile_accounts
WHERE connection_status != 'active';

-- Reconnect via UI:
-- User clicks "Reconnect" button
-- Re-authorizes via OAuth
-- Status updated to 'active'
```

---

### **Issue: "Can't send emails from connected account"**

**Check:**
```typescript
// 1. Verify account is active
const { data } = await supabase
  .from('user_unipile_accounts')
  .select('*')
  .eq('platform', 'GOOGLE')
  .eq('connection_status', 'active')
  .single();

// 2. Test Unipile API directly
const unipile = new UnipileSender();
const result = await unipile.sendEmail({
  accountId: data.unipile_account_id,
  recipientEmail: 'test@example.com',
  subject: 'Test',
  messageBody: 'Test email'
});

console.log(result);
```

---

## 📊 MONITORING

### **Track Connection Health:**

```sql
-- Connected accounts by platform
SELECT
  platform,
  COUNT(*) as total_accounts,
  COUNT(*) FILTER (WHERE connection_status = 'active') as active,
  COUNT(*) FILTER (WHERE connection_status = 'disconnected') as disconnected,
  COUNT(*) FILTER (WHERE connection_status = 'error') as errors
FROM user_unipile_accounts
GROUP BY platform;
```

### **Recent Connections:**

```sql
-- Last 10 email account connections
SELECT
  platform,
  account_email,
  connection_status,
  created_at
FROM user_unipile_accounts
WHERE platform IN ('GOOGLE', 'OUTLOOK')
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔧 CONFIGURATION

### **Required Environment Variables:**

```bash
# Unipile API Credentials
UNIPILE_DSN=your_unipile_instance.unipile.com
UNIPILE_API_KEY=your_unipile_api_key

# Optional: Custom OAuth domain (already configured)
# UNIPILE_CUSTOM_DOMAIN=auth.meet-sam.com
```

### **Custom Domain Setup (Already Done ✅):**

1. **Domain:** `auth.meet-sam.com`
2. **CNAME Record:** Points to Unipile servers
3. **SSL Certificate:** Configured by Unipile
4. **Status:** Production ready

**Code:** Lines 271-274 in `/app/api/unipile/hosted-auth/route.ts`
```typescript
const whitelabeledAuthUrl = hostedAuthResponse.url?.replace(
  'https://account.unipile.com',
  'https://auth.meet-sam.com'
);
```

---

## 📚 API REFERENCE

### **Connect Google Account**

```typescript
POST /api/unipile/hosted-auth

Body:
{
  "provider": "GOOGLE",
  "type": "MESSAGING"
}

Response:
{
  "success": true,
  "auth_url": "https://auth.meet-sam.com/...",
  "provider": "GOOGLE",
  "workspace_id": "uuid",
  "proxy_country": "us"
}
```

### **Connect Microsoft Account**

```typescript
POST /api/unipile/hosted-auth

Body:
{
  "provider": "OUTLOOK",
  "type": "MESSAGING"
}

Response:
{
  "success": true,
  "auth_url": "https://auth.meet-sam.com/...",
  "provider": "OUTLOOK",
  "workspace_id": "uuid",
  "proxy_country": "us"
}
```

### **List Connected Accounts**

```typescript
GET /api/email-providers

Response:
{
  "success": true,
  "providers": [
    {
      "id": "uuid",
      "provider_type": "google",
      "email_address": "user@gmail.com",
      "status": "connected",
      "last_sync": "2025-10-07T10:00:00Z"
    }
  ]
}
```

---

## ✅ FEATURE CHECKLIST

- [x] Google OAuth integration
- [x] Microsoft OAuth integration
- [x] White-labeled auth domain (auth.meet-sam.com)
- [x] Account storage in database
- [x] Multi-account support
- [x] Connection status tracking
- [x] Email sending via Unipile
- [x] Email receiving via Unipile
- [x] UI for account management
- [x] Error handling and retry
- [x] Account reconnection flow

---

## 🎯 NEXT STEPS

Since integration is complete, focus on:

1. **User Testing**
   - Have users connect Google/Microsoft accounts
   - Verify OAuth flow works smoothly
   - Test sending emails from connected accounts

2. **Email Campaign Integration**
   - Use connected email accounts for campaigns
   - Track deliverability and open rates
   - Monitor account health

3. **Documentation for Users**
   - Create help docs for connecting email
   - Troubleshooting guide
   - Best practices for email campaigns

---

## 📞 SUPPORT

**Unipile Support:**
- Email: support@unipile.com
- Docs: https://docs.unipile.com
- Status: https://status.unipile.com

**SAM AI Support:**
- Internal docs: `/docs/integrations/`
- Code: `/app/api/unipile/`
- UI: `/app/components/EmailProvidersModal.tsx`

---

**Last Updated:** October 7, 2025
**Integration Status:** ✅ Production Ready
**Next Review:** N/A (Complete)
