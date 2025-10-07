# Password Reset Flow - Verification Guide

**Date**: October 7, 2025
**Issue**: User reports "link is not valid" error

---

## ✅ Current Implementation Status

### Code Implementation
- ✅ API endpoint: `/api/auth/reset-password`
- ✅ Reset page: `/reset-password`
- ✅ Postmark email sending
- ✅ Supabase admin link generation
- ✅ Token validation on reset page
- ✅ Password update logic

### Environment Variables
- ✅ `NEXT_PUBLIC_SUPABASE_URL`: https://latxadqrvrrrcvkktrog.supabase.co
- ✅ `SUPABASE_SERVICE_ROLE_KEY`: Configured
- ✅ `POSTMARK_INNOVAREAI_API_KEY`: Configured
- ✅ `POSTMARK_3CUBEDAI_API_KEY`: Configured
- ✅ `NEXT_PUBLIC_SITE_URL`: https://app.meet-sam.com

---

## 🔍 Password Reset Flow

### Step 1: User Requests Reset

**Endpoint**: `POST /api/auth/reset-password`

**Request**:
```json
{
  "email": "user@company.com"
}
```

**What Happens**:
1. Check if user exists in Supabase Auth
2. Generate recovery link using Supabase Admin API
3. Send email via Postmark with reset link

**Recovery Link Format**:
```
https://app.meet-sam.com/reset-password#access_token=XXX&refresh_token=YYY&type=recovery
```

### Step 2: Email Sent

**From**: Sarah Powell <sp@innovareai.com> or Sophia Caldwell <sophia@3cubed.ai>
**Subject**: 🔑 Reset Your SAM AI Password
**Contains**:
- Reset link with Supabase tokens in hash fragment
- 24-hour expiration notice

### Step 3: User Clicks Link

**URL**: `https://app.meet-sam.com/reset-password#access_token=...`

**Reset Page Logic** (`/app/reset-password/page.tsx`):
1. Extract `access_token`, `refresh_token`, `type` from URL hash
2. Call `supabase.auth.setSession()` to establish session
3. If session valid → Show password form
4. If session invalid → Show error + "request new reset" link

### Step 4: User Submits New Password

**Action**: `supabase.auth.updateUser({ password: newPassword })`

**Success**:
- Password updated
- User automatically signed in
- Redirect to dashboard

---

## ⚠️ Common Issues & Fixes

### Issue 1: "Link is not valid"

**Cause**: Supabase redirect URL not whitelisted

**Fix**: Add to Supabase Dashboard → Authentication → URL Configuration:

**Redirect URLs**:
```
https://app.meet-sam.com/reset-password
https://app.meet-sam.com/**
http://localhost:3000/reset-password (for dev)
```

**Site URL**:
```
https://app.meet-sam.com
```

### Issue 2: Link Expired

**Cause**: Recovery links expire after 24 hours

**Fix**: User must request a new password reset

### Issue 3: Wrong Email Domain

**Cause**: Email routing issue (InnovareAI vs 3cubed)

**Check**:
- InnovareAI users → uses `POSTMARK_INNOVAREAI_API_KEY`
- 3cubed users → uses `POSTMARK_3CUBEDAI_API_KEY`

### Issue 4: Email Not Received

**Possible causes**:
- Spam folder
- Postmark API key invalid
- Email bounced

**Check Postmark Activity**:
https://account.postmarkapp.com/servers/[server-id]/activity

---

## 🧪 Testing the Flow

### Test 1: Request Password Reset

```bash
curl -X POST https://app.meet-sam.com/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Password reset email sent! Check your email and click the link to reset your password."
}
```

### Test 2: Check Email

1. Check inbox for "🔑 Reset Your SAM AI Password"
2. Verify sender is correct (Sarah or Sophia)
3. Click reset link

### Test 3: Verify Reset Page

1. Should land on `/reset-password` with tokens in URL hash
2. Page should show "Validating reset link..." briefly
3. Then show password reset form

### Test 4: Reset Password

1. Enter new password (min 6 chars)
2. Confirm password
3. Click "Update Password"
4. Should see: "✅ Password updated successfully!"
5. Should redirect to dashboard

### Test 5: Sign In with New Password

1. Go to sign in page
2. Use new password
3. Should successfully sign in

---

## 🔧 Manual Verification Checklist

### Supabase Configuration

**Go to**: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/auth/url-configuration

- [ ] Site URL = `https://app.meet-sam.com`
- [ ] Redirect URLs includes:
  - [ ] `https://app.meet-sam.com/reset-password`
  - [ ] `https://app.meet-sam.com/**`
- [ ] Auth Email Templates enabled
- [ ] Password recovery enabled

### Postmark Configuration

**InnovareAI Server**:
- [ ] API Key: `bf9e070d-eec7-4c41-8fb5-1d37fe384723`
- [ ] From: sp@innovareai.com
- [ ] Domain verified

**3cubed Server**:
- [ ] API Key: `77cdd228-d19f-4e18-9373-a1bc8f4a4a22`
- [ ] From: sophia@3cubed.ai
- [ ] Domain verified

### Code Verification

- [ ] `/app/api/auth/reset-password/route.ts` exists
- [ ] Uses `supabaseAdmin.auth.admin.generateLink()`
- [ ] Sends email via Postmark
- [ ] Returns Supabase action_link (contains tokens)

- [ ] `/app/reset-password/page.tsx` exists
- [ ] Extracts tokens from URL hash (`#access_token=...`)
- [ ] Calls `supabase.auth.setSession()`
- [ ] Updates password with `supabase.auth.updateUser()`

---

## 🐛 Debugging Steps

### Check if User Exists

```bash
# In Supabase dashboard SQL editor:
SELECT id, email, created_at, confirmed_at
FROM auth.users
WHERE email = 'user@company.com';
```

### Check Reset Email Logs

**Postmark Activity**: Check recent sends for password reset emails

### Inspect Reset Link

**The link should look like**:
```
https://app.meet-sam.com/reset-password#access_token=eyJhbGci...&refresh_token=XXX&type=recovery
```

**NOT like**:
```
https://app.meet-sam.com/reset-password?email=user@company.com&recovery=true
```

(Old format won't work with current implementation)

### Check Browser Console

When user clicks reset link:
1. Open DevTools → Console
2. Look for errors like:
   - "Session error: ..."
   - "Invalid or expired reset link"

### Server Logs

Check production logs for:
```
Sending password reset to: user@company.com
✅ Password reset email sent via Postmark successfully
```

Or errors:
```
Password reset generation error: ...
Email send failed: ...
```

---

## 📝 User Instructions (Support Response)

**Email to Sophia**:

```
Hi Sophia,

I've checked the password reset system. The link saying "not valid" is most likely one of these issues:

1. **The link expired** (they expire after 24 hours)
   → Please request a NEW password reset

2. **Configuration issue** (I'm checking now)
   → I'll verify the Supabase settings

To request a new reset:
1. Go to https://app.meet-sam.com
2. Click "Sign In"
3. Click "Forgot Password?"
4. Enter your email
5. Check your inbox for the NEW reset email

The new link should work. If it still doesn't, please:
- Check your spam folder
- Try a different browser
- Let me know the exact error message

I'm also verifying the backend configuration to prevent this in the future.

Thanks for your patience!
```

---

## 🔨 Quick Fix Commands

### Regenerate Reset Link Manually

```bash
curl -X POST https://app.meet-sam.com/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email": "sophia@example.com"}'
```

### Check Supabase Auth Config

Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/auth/url-configuration

Verify redirect URLs are correct.

---

## ✅ Expected Behavior (Working Flow)

1. User requests reset → Gets email within 1 minute
2. User clicks link → Redirected to `/reset-password` with tokens
3. Page validates tokens → Shows password form
4. User enters new password → Password updated successfully
5. Auto-redirected to dashboard → User is signed in

**Total time**: <2 minutes

---

## 🚨 If Still Not Working

**Check these in order**:

1. **Supabase redirect URLs** (most common issue)
2. **Link expiration** (24 hours)
3. **Email delivery** (check Postmark activity)
4. **Browser issues** (try incognito)
5. **User account status** (check Supabase dashboard)

**Last resort**: Manually reset password via Supabase dashboard

---

**Created**: October 7, 2025
**Status**: Verification guide ready
**Next**: Check Supabase redirect URL configuration
