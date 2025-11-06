# Auth/Session Fix - Quick Reference
## Fast lookup for "Access denied to workspace" error

---

## The Problem in 60 Seconds

**Error:** `{ error: 'Access denied to workspace' }, status: 403`

**Root Cause:** Workspace ID never makes it from login → session → API requests

**Why It Happens:**
1. User logs in ✅
2. JWT created with user.id and email ✅
3. JWT does NOT include workspace_id ❌
4. Frontend loads workspaces (async, creates race condition) ⚠️
5. API request fires with null/undefined workspace_id ❌
6. Query fails: `workspace_members.eq('workspace_id', null)` ❌
7. Returns: "Access denied to workspace" ❌

---

## Where the Error Occurs (Files)

```
app/api/linkedin/workspace-connect/route.ts:45
app/api/campaigns/upload-prospects/route.ts:77
app/api/campaigns/linkedin/execute-via-n8n/route.ts:687
app/api/campaigns/messages/approval/route.ts:32
app/api/signup-intelligence/route.ts:59
lib/auth.ts:86
```

**Common Pattern:**
```typescript
const { data: member } = await supabase
  .from('workspace_members')
  .select('role')
  .eq('workspace_id', workspace_id)  // ← This is null/undefined
  .eq('user_id', user.id)
  .single();

if (!member) {
  return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
}
```

---

## Quick Fix Checklist

### 1. Database Setup (Run These SQLs in Supabase)

**Step 1:** Add custom JWT hook
```sql
CREATE OR REPLACE FUNCTION auth.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  claims jsonb;
  user_workspace_id uuid;
BEGIN
  SELECT current_workspace_id INTO user_workspace_id
  FROM public.users
  WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';
  claims := jsonb_set(claims, '{workspace_id}', to_jsonb(user_workspace_id));
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION auth.custom_access_token_hook TO supabase_auth_admin;
```

**Step 2:** Enable hook in Supabase Dashboard
- Go to: Authentication → Hooks
- Enable: "Custom Access Token Hook"
- Function: `auth.custom_access_token_hook`

**Step 3:** Run existing migrations
```bash
# Already exist, just need to be executed
migrations/fix_current_workspace_id.sql
migrations/auto_assign_workspace_trigger.sql
```

**Step 4:** Add super admin RLS bypass
```sql
CREATE POLICY "Super admins bypass workspace_members RLS"
  ON workspace_members FOR SELECT
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );
```

### 2. Auth API Changes

**File:** `/app/api/auth/signin/route.ts`

**Add after line 68:**
```typescript
if (data.session && data.user) {
  // CRITICAL: Get user's workspace
  const { data: userData } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', data.user.id)
    .single();

  let workspaceId = userData?.current_workspace_id;

  // Fallback: Get first workspace membership
  if (!workspaceId) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', data.user.id)
      .limit(1)
      .single();

    workspaceId = membership?.workspace_id;

    // Update users table
    if (workspaceId) {
      await supabase
        .from('users')
        .update({ current_workspace_id: workspaceId })
        .eq('id', data.user.id);
    }
  }

  return NextResponse.json({
    message: 'Sign-in successful!',
    user: {
      id: data.user.id,
      email: data.user.email,
      firstName: data.user.user_metadata?.first_name,
      lastName: data.user.user_metadata?.last_name,
      workspaceId: workspaceId  // ← ADD THIS
    }
  });
}
```

**File:** `/app/api/auth/session/route.ts`

**Add before line 54 (return statement):**
```typescript
// Get user's workspace
const { data: userData } = await supabase
  .from('users')
  .select('current_workspace_id')
  .eq('id', session.user.id)
  .single();

return NextResponse.json({
  user: {
    id: session.user.id,
    email: session.user.email,
    firstName: session.user.user_metadata?.first_name,
    lastName: session.user.user_metadata?.last_name,
    lastSignInAt: session.user.last_sign_in_at,
    workspaceId: userData?.current_workspace_id  // ← ADD THIS
  },
  // ... rest of response
});
```

### 3. Frontend Changes

**File:** `/app/page.tsx`

**Find the auth initialization useEffect (around line 1060-1120)**

**Change from:**
```typescript
useEffect(() => {
  const initAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
      setSession(session);
      await loadWorkspaces(session.user.id, isAdmin, session.user.email);
    }
  };
  initAuth();
}, []);
```

**Change to:**
```typescript
useEffect(() => {
  const initAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
      setSession(session);

      // CRITICAL: Set workspace BEFORE loading workspaces (prevents race condition)
      const workspaceId = session.user.user_metadata?.workspaceId;
      if (workspaceId) {
        setSelectedWorkspaceId(workspaceId);
        console.log('✅ Set workspace from session:', workspaceId);
      }

      // Then load full workspace list (async, won't block)
      await loadWorkspaces(session.user.id, isAdmin, session.user.email);
    }
  };
  initAuth();
}, []);
```

---

## Testing Steps

### Test 1: Check JWT Contains workspace_id

**In browser console after login:**
```javascript
// Get session
const { data: { session } } = await supabase.auth.getSession();

// Decode JWT
const payload = JSON.parse(atob(session.access_token.split('.')[1]));
console.log('JWT workspace_id:', payload.workspace_id);
// Should show: "babdcab8-1a78-4b2f-913e-6e9fd9821009" or similar
```

### Test 2: Check Session Response

**In Network tab, look at response from `/api/auth/session`:**
```json
{
  "user": {
    "id": "...",
    "email": "...",
    "workspaceId": "babdcab8-1a78-4b2f-913e-6e9fd9821009"  // ← Should be here
  }
}
```

### Test 3: Check Frontend State

**In React DevTools, check state:**
```javascript
// Should be set immediately after login
selectedWorkspaceId: "babdcab8-1a78-4b2f-913e-6e9fd9821009"
currentWorkspace: { id: "...", name: "..." }
```

### Test 4: Check API Requests

**In Network tab, check any API request headers:**
```
x-workspace-id: babdcab8-1a78-4b2f-913e-6e9fd9821009
```

**Or check request body:**
```json
{
  "workspace_id": "babdcab8-1a78-4b2f-913e-6e9fd9821009",
  ...
}
```

---

## Verification Queries

### Check if user has workspace

```sql
SELECT
  u.id,
  u.email,
  u.current_workspace_id,
  w.name as workspace_name
FROM users u
LEFT JOIN workspaces w ON u.current_workspace_id = w.id
WHERE u.email = 'your-email@example.com';
```

### Check if user is in workspace_members

```sql
SELECT
  wm.workspace_id,
  wm.role,
  wm.status,
  w.name as workspace_name
FROM workspace_members wm
JOIN workspaces w ON wm.workspace_id = w.id
WHERE wm.user_id = 'user-uuid-here';
```

### Check if trigger is working

```sql
-- Insert test membership
INSERT INTO workspace_members (workspace_id, user_id, role, status)
VALUES ('workspace-uuid', 'user-uuid', 'member', 'active');

-- Check if current_workspace_id was updated
SELECT current_workspace_id FROM users WHERE id = 'user-uuid';
-- Should show the workspace_id you just inserted
```

---

## Troubleshooting

### Error still occurs after fix

**Check 1:** Is workspace_id in JWT?
```javascript
const payload = JSON.parse(atob(session.access_token.split('.')[1]));
console.log('workspace_id in JWT:', payload.workspace_id);
```
- If `undefined`: Custom JWT hook not working
- If `null`: User's current_workspace_id is null in database

**Check 2:** Is user in workspace_members?
```sql
SELECT * FROM workspace_members
WHERE user_id = 'user-uuid' AND workspace_id = 'workspace-uuid';
```
- If empty: User not added to workspace, need to insert record

**Check 3:** RLS policies blocking?
```sql
-- Test as super admin
SET LOCAL jwt.claims.email = 'tl@innovareai.com';
SELECT * FROM workspace_members WHERE workspace_id = 'workspace-uuid';
-- Should return results
```

**Check 4:** Frontend race condition?
```javascript
// Add to useEffect
console.log('🔍 Auth init:', {
  hasSession: !!session,
  workspaceId: session?.user?.user_metadata?.workspaceId,
  selectedWorkspaceId: selectedWorkspaceId
});
```
- If workspaceId exists but selectedWorkspaceId is null: Frontend not setting state

---

## Common Scenarios

### Scenario 1: New user signup

**What should happen:**
1. User signs up
2. Signup API creates workspace
3. Signup API adds user to workspace_members
4. Trigger sets current_workspace_id
5. Login returns workspaceId
6. User can access workspace immediately

**If it doesn't:**
- Check `/app/api/auth/signup/route.ts` creates workspace and membership
- Verify trigger is enabled: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_auto_assign_workspace'`

### Scenario 2: Existing user without workspace

**What should happen:**
1. User logs in
2. Signin API checks current_workspace_id (null)
3. Signin API queries workspace_members for first workspace
4. Signin API updates current_workspace_id
5. Signin API returns workspaceId
6. User can access workspace

**If it doesn't:**
- Manually update: `UPDATE users SET current_workspace_id = (SELECT workspace_id FROM workspace_members WHERE user_id = users.id LIMIT 1) WHERE id = 'user-uuid'`

### Scenario 3: Super admin accessing any workspace

**What should happen:**
1. Super admin logs in
2. Gets their default workspace in JWT
3. Can query any workspace via admin API
4. RLS bypass allows access to all workspace_members records

**If it doesn't:**
- Check RLS policy exists: `SELECT * FROM pg_policies WHERE policyname LIKE '%Super admin%'`
- Verify email in JWT: `auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')`

---

## Emergency Hotfix (If can't deploy full fix)

**Option 1:** Disable workspace check temporarily (NOT RECOMMENDED FOR PRODUCTION)

```typescript
// In API route, comment out workspace check
// const { data: member } = await supabase
//   .from('workspace_members')
//   .select('role')
//   .eq('workspace_id', workspace_id)
//   .eq('user_id', user.id)
//   .single();
//
// if (!member) {
//   return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
// }

// TEMPORARY: Log warning but allow access
console.warn('⚠️ SECURITY: Workspace check disabled for debugging');
```

**Option 2:** Use admin client for specific routes

```typescript
import { supabaseAdmin } from '@/app/lib/supabase';
const adminSupabase = supabaseAdmin();

// Bypass RLS for this query only
const { data: member } = await adminSupabase
  .from('workspace_members')
  .select('role')
  .eq('workspace_id', workspace_id)
  .eq('user_id', user.id)
  .single();
```

---

## Related Files

**Documentation:**
- `/docs/AUTH_SESSION_AUDIT_REPORT.md` - Full detailed analysis
- `/docs/WORKSPACE_ISOLATION_FIX.md` - Historical workspace isolation work
- `/docs/SUPER_ADMIN_IMPLEMENTATION.md` - Super admin architecture

**Code:**
- `/app/api/auth/signin/route.ts` - Login endpoint
- `/app/api/auth/session/route.ts` - Session endpoint
- `/app/page.tsx` - Main frontend app
- `/lib/auth.ts` - Enterprise auth utilities
- `/middleware.ts` - Route protection

**Database:**
- `/migrations/fix_current_workspace_id.sql` - Add workspace column
- `/migrations/auto_assign_workspace_trigger.sql` - Auto-assign trigger
- `/docs/database/fix-rls-policies.sql` - RLS policy fixes

---

**Last Updated:** 2025-11-07
**Status:** Ready for implementation
**Priority:** CRITICAL - Blocks user access to workspaces
