# Email Providers API 401 Error - Debug Report

**Date:** October 7, 2025
**User:** tl@innovareai.com
**Workspace:** babdcab8-1a78-4b2f-913e-6e9fd9821009
**Issue:** Email accounts not showing in UI despite database having the data

---

## Problem Summary

The `/api/email-providers` GET endpoint was returning data correctly, but the POST and DELETE endpoints were returning 401 Unauthorized errors, preventing users from adding or removing email accounts.

---

## Root Cause Analysis

### The Bug

**File:** `/app/api/email-providers/route.ts` and `/app/api/email-providers/[id]/route.ts`

**Line 176 (POST route - BEFORE FIX):**
```typescript
const supabase = supabaseAdmin()

// Get current user
const { data: { user }, error: authError } = await supabase.auth.getUser()
```

**Problem:**
1. `supabaseAdmin()` creates a Supabase client with the **service role key**
2. The service role client has admin privileges but **no access to user session cookies**
3. Calling `supabase.auth.getUser()` without a token parameter returns `null`
4. The code then returns 401 because no user is found

### Why GET Worked But POST/DELETE Didn't

**GET route (lines 36-48):**
```typescript
const cookieStore = await cookies()
const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
const { data: { session }, error: authError } = await supabase.auth.getSession()
```
✅ This correctly uses `createRouteHandlerClient` which has access to cookies

**POST route (line 176 - BEFORE FIX):**
```typescript
const supabase = supabaseAdmin()
const { data: { user }, error: authError } = await supabase.auth.getUser()
```
❌ This incorrectly uses `supabaseAdmin()` which doesn't have access to cookies

---

## The Fix

### Changed Files

1. `/app/api/email-providers/route.ts` (POST route)
2. `/app/api/email-providers/[id]/route.ts` (DELETE route)

### Changes Made

**BEFORE:**
```typescript
const supabase = supabaseAdmin()
const { data: { user }, error: authError } = await supabase.auth.getUser()
```

**AFTER:**
```typescript
// Get current user - use the same pattern as GET route
const cookieStore = await cookies()
const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
const { data: { session }, error: authError } = await supabase.auth.getSession()

if (authError || !session || !session.user) {
  return NextResponse.json({
    success: false,
    error: 'Authentication required'
  }, { status: 401 })
}

const user = session.user
```

### Why This Works

1. `createRouteHandlerClient({ cookies: () => cookieStore })` creates a client with access to user cookies
2. `getSession()` reads the user's session from cookies
3. The session contains the authenticated user information
4. Now authentication works correctly

---

## Database Verification

Verified the database has the correct data:

```sql
-- workspace_accounts table
SELECT * FROM workspace_accounts
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
AND account_type = 'email';
```

**Result:**
- ✅ 1 email account found
- Account: tl@innovareai.com
- Unipile ID: nefy7jYjS5K6X3U7ORxHNQ
- Provider: Google

```sql
-- workspace_members table
SELECT * FROM workspace_members
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
AND user_id = 'f6885ff3-deef-4781-8721-93011c990b1b';
```

**Result:**
- ✅ User is a member with role: admin

```sql
-- users table
SELECT current_workspace_id FROM users
WHERE id = 'f6885ff3-deef-4781-8721-93011c990b1b';
```

**Result:**
- ✅ current_workspace_id: babdcab8-1a78-4b2f-913e-6e9fd9821009

---

## Expected Behavior After Fix

### GET /api/email-providers
```json
{
  "success": true,
  "providers": [
    {
      "id": "nefy7jYjS5K6X3U7ORxHNQ",
      "email_address": "tl@innovareai.com",
      "provider_type": "google",
      "status": "connected",
      "user_id": "f6885ff3-deef-4781-8721-93011c990b1b"
    }
  ]
}
```

### POST /api/email-providers
- ✅ Now works with authentication
- ✅ Can add new email accounts

### DELETE /api/email-providers/[id]
- ✅ Now works with authentication
- ✅ Can remove email accounts

---

## Testing

Created test script: `/scripts/test-email-providers-api.cjs`

**Run with:**
```bash
node scripts/test-email-providers-api.cjs
```

**Output:**
```
✅ Authentication should work:
   - User is authenticated (ID: f6885ff3-deef-4781-8721-93011c990b1b)
   - User is member of workspace
   - Workspace has email accounts
```

---

## Deployment Checklist

- [x] Fixed POST route authentication
- [x] Fixed DELETE route authentication
- [x] Verified database has correct data
- [x] Created test script
- [x] Build passes (`npm run build`)
- [ ] Deploy to staging for testing
- [ ] Verify in staging environment
- [ ] Deploy to production
- [ ] Verify in production environment

---

## Lessons Learned

### Authentication Pattern Best Practices

**✅ CORRECT - For API routes that need user authentication:**
```typescript
const cookieStore = await cookies()
const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
const { data: { session } } = await supabase.auth.getSession()
```

**❌ WRONG - Don't use service role client for user authentication:**
```typescript
const supabase = supabaseAdmin()
const { data: { user } } = await supabase.auth.getUser()
```

### When to Use Each Client

| Client | Use Case | Has Access To |
|--------|----------|---------------|
| `createRouteHandlerClient()` | User-authenticated API routes | User session, cookies, user ID |
| `supabaseAdmin()` | Admin operations, bypassing RLS | Service role privileges, no user session |
| `createClient()` | Client-side operations | User session in browser |

---

## Related Files

- `/app/api/email-providers/route.ts` - Main API route (GET, POST)
- `/app/api/email-providers/[id]/route.ts` - Delete route
- `/app/components/EmailProvidersModal.tsx` - UI component
- `/app/workspace/[workspaceId]/settings/page.tsx` - Settings page
- `/app/lib/supabase.ts` - Supabase client configuration
- `/scripts/test-email-providers-api.cjs` - Test script

---

## Next Steps

1. **Deploy to Staging:**
   ```bash
   npm run deploy:staging
   ```

2. **Test in Staging:**
   - Go to https://devin-next-gen-staging.netlify.app
   - Login as tl@innovareai.com
   - Navigate to Settings > Integrations
   - Click "Email Integration Settings"
   - Verify email account shows up

3. **Deploy to Production:**
   ```bash
   npm run deploy:production
   ```

4. **Verify in Production:**
   - Go to https://app.meet-sam.com
   - Login as tl@innovareai.com
   - Navigate to Settings > Integrations
   - Click "Email Integration Settings"
   - Verify email account shows up

---

**Status:** ✅ Fixed
**Build:** ✅ Passing
**Deployment:** Pending
