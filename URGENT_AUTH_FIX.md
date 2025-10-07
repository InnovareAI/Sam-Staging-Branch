# 🚨 URGENT: Fix Production Authentication Issues

**Date**: 2025-10-06
**Status**: CRITICAL - Users locked out

---

## Problem Summary

1. ❌ Users being logged out unexpectedly
2. ❌ Password reset emails not working
3. ❌ Magic link emails not working

**Root Cause**: Supabase redirect URLs misconfigured for production

---

## ✅ IMMEDIATE FIX - Supabase Dashboard

### Step 1: Update Site URL (5 min)

1. Go to [Supabase Dashboard](https://app.supabase.com/project/latxadqrvrrrcvkktrog)
2. **Authentication** → **URL Configuration**
3. Set these exact values:

```
Site URL: https://app.meet-sam.com
```

### Step 2: Update Redirect URLs (5 min)

In the same **URL Configuration** section, add these to **Redirect URLs**:

```
https://app.meet-sam.com
https://app.meet-sam.com/reset-password
https://app.meet-sam.com/auth/callback
https://app.meet-sam.com/signup/innovareai
https://app.meet-sam.com/signup/3cubed
http://localhost:3000 (for local dev)
http://localhost:3000/reset-password (for local dev)
```

### Step 3: Update Email Templates (10 min)

Go to **Authentication** → **Email Templates**

#### **Confirm signup (Magic Link)**

Replace the template with:

```html
<h2>Confirm your signup</h2>

<p>Follow this link to confirm your account:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a></p>

<p>Or copy and paste this URL into your browser:</p>
<p>{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email</p>
```

#### **Magic Link**

Replace the template with:

```html
<h2>Magic Link</h2>

<p>Follow this link to sign in:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink">Sign In</a></p>

<p>Or copy and paste this URL into your browser:</p>
<p>{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink</p>
```

#### **Reset Password**

Replace the template with:

```html
<h2>Reset Password</h2>

<p>Follow this link to reset your password:</p>
<p><a href="{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery">Reset Password</a></p>

<p>Or copy and paste this URL into your browser:</p>
<p>{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery</p>

<p>If you didn't request this, you can safely ignore this email.</p>
```

---

## ✅ ADDITIONAL FIX - Session Timeout (Optional)

If users are still being logged out after fixing redirect URLs:

### Step 4: Extend Session Duration

1. **Authentication** → **Settings**
2. Set:
   - **JWT expiry limit**: 604800 seconds (7 days)
   - **Refresh token expiry**: 2592000 seconds (30 days)

---

## 🧪 Testing After Fix

### Test Magic Link:
1. Go to https://app.meet-sam.com
2. Click "Sign in with magic link"
3. Enter email
4. Check email and click link
5. Should redirect to app and log in ✅

### Test Password Reset:
1. Go to https://app.meet-sam.com
2. Click "Forgot password?"
3. Enter email
4. Check email and click link
5. Should redirect to /reset-password page ✅
6. Enter new password
7. Should redirect back and log in ✅

---

## 🔍 Debugging

If still having issues, check browser console for errors:

```javascript
// Expected URL format for magic link:
https://app.meet-sam.com/auth/confirm?token_hash=ABC123&type=magiclink

// Expected URL format for password reset:
https://app.meet-sam.com/reset-password?token_hash=ABC123&type=recovery
```

**Common Issues**:
- ❌ URL shows `localhost` instead of `app.meet-sam.com`
- ❌ URL is missing `token_hash` parameter
- ❌ Browser console shows CORS errors
- ❌ Supabase session not being set

---

## 📋 Checklist

- [ ] Site URL set to `https://app.meet-sam.com`
- [ ] All redirect URLs added (including /reset-password)
- [ ] Magic link email template updated
- [ ] Password reset email template updated
- [ ] Confirm signup email template updated
- [ ] Tested magic link login
- [ ] Tested password reset
- [ ] Verified users stay logged in

---

## ⏱️ Time to Fix

**Total**: 15-20 minutes

---

**Last Updated**: 2025-10-06
**Priority**: CRITICAL - Fix immediately
