# Authentication & Session Audit Report
## "Access denied to workspace" Error Analysis

**Date:** 2025-11-07
**Audited By:** Claude Sonnet 4.5
**Focus:** Authentication flow, session management, workspace context propagation

---

## Executive Summary

The "Access denied to workspace" error originates from **RLS policy enforcement gaps** combined with **missing or null workspace_id context** during API requests. The system has multiple authentication patterns, but workspace context is not consistently propagated from login → session → API requests.

### Key Findings

1. **No workspace_id in session/cookies** - Authentication sets user session but does NOT store workspace_id
2. **Race condition in workspace loading** - Frontend loads workspaces AFTER auth completes, creating timing gap
3. **Inconsistent workspace access validation** - Some routes use `lib/auth.ts`, others query directly
4. **RLS policies block admin routes** - Even super admins are blocked by RLS when workspace_members has no record
5. **current_workspace_id column exists but not populated** - Database migration added column but trigger may not be firing

---

## 1. Session Management Analysis

### How Session is Created After Login

**File:** `/app/api/auth/signin/route.ts` (lines 38-84)

```typescript
// Sign in with Supabase Auth (this will set the session cookies)
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (data.session && data.user) {
  console.log('User signed in successfully:', data.user.id);

  // Create response with user data
  const response = NextResponse.json({
    message: 'Sign-in successful!',
    user: {
      id: data.user.id,
      email: data.user.email,
      firstName: data.user.user_metadata?.first_name,
      lastName: data.user.user_metadata?.last_name
    }
  });

  return response;
}
```

**CRITICAL GAP:** No workspace_id is added to:
- Session metadata
- User metadata
- Response cookies
- JWT token claims

### Session Endpoint

**File:** `/app/api/auth/session/route.ts` (lines 32-69)

```typescript
// Get current session
const { data: { session }, error } = await supabase.auth.getSession();

return NextResponse.json({
  user: {
    id: session.user.id,
    email: session.user.email,
    firstName: session.user.user_metadata?.first_name,
    lastName: session.user.user_metadata?.last_name,
    lastSignInAt: session.user.last_sign_in_at
  },
  session: {
    accessToken: session.access_token,
    expiresAt: session.expires_at,
    refreshToken: session.refresh_token
  },
  authenticated: true
});
```

**CRITICAL GAP:** Session response does NOT include:
- `workspace_id`
- `current_workspace_id`
- Any workspace context

---

## 2. Cookie and Token Handling

### Cookies Stored After Login

Supabase Auth automatically stores these cookies:
- `sb-<project-id>-auth-token` - Access token (JWT)
- `sb-<project-id>-auth-token-code-verifier` - PKCE verifier
- `sb-<project-id>-refresh-token` - Refresh token

**ANALYSIS:** None of these cookies contain `workspace_id`. The JWT token includes:
- `sub` (user ID)
- `email`
- `user_metadata` (first_name, last_name)
- `role` (authenticated)
- `aal` (authentication assurance level)

**WORKSPACE_ID IS MISSING FROM JWT**

### Middleware Cookie Handling

**File:** `/middleware.ts` (lines 17-33)

```typescript
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      }
    }
  }
);
```

**FINDING:** Middleware correctly forwards cookies but does NOT extract or validate workspace_id.

---

## 3. Frontend Workspace Context

### Workspace Loading Flow

**File:** `/app/page.tsx` (lines 1913-2112)

```typescript
const loadWorkspaces = async (userId: string, isAdmin?: boolean, userEmail?: string) => {
  // 🚨 SECURITY: Force strict tenant separation
  const isTrueSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(finalEmail);
  const shouldLoadAllWorkspaces = isTrueSuperAdmin && (isAdmin ?? isSuperAdmin);

  if (shouldLoadAllWorkspaces) {
    // Super admin - load all workspaces via /api/admin/workspaces
    const response = await fetch('/api/admin/workspaces', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      setWorkspaces(data.workspaces || []);

      // CRITICAL FIX: Use currentWorkspaceId from API response
      if (data.currentWorkspaceId) {
        setSelectedWorkspaceId(data.currentWorkspaceId);
      }
    }
  } else {
    // Regular user - load only their workspaces
    await loadUserWorkspaces(userId);
  }
};
```

**CRITICAL ISSUES:**

1. **Race Condition:** `loadWorkspaces()` is called in `useEffect` AFTER auth completes:
   ```typescript
   // Line 1113
   await loadWorkspaces(user.id, isAdmin, user.email || session?.user?.email);
   ```
   This creates a gap where API requests might fire BEFORE workspaces load.

2. **No Workspace Context in Initial Render:** The component initializes with:
   ```typescript
   const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(() => {
     if (typeof window !== 'undefined') {
       const saved = localStorage.getItem('selectedWorkspaceId');
       return saved;
     }
     return null;
   });
   ```
   **RESULT:** If localStorage is empty, `selectedWorkspaceId` is `null` until `loadWorkspaces()` completes.

3. **Current Workspace Computed from State:**
   ```typescript
   const currentWorkspace = useMemo(() => {
     if (!selectedWorkspaceId) return null;
     return workspaces.find(ws => ws.id === selectedWorkspaceId) || null;
   }, [selectedWorkspaceId, workspaces]);
   ```
   **RESULT:** If `selectedWorkspaceId` is null or workspaces haven't loaded, `currentWorkspace` is `null`.

---

## 4. API Route Authentication

### Pattern 1: Using `lib/auth.ts` (Enterprise-Grade)

**File:** `/lib/auth.ts` (lines 31-90)

```typescript
export async function verifyAuth(request: NextRequest): Promise<AuthContext> {
  // Extract Authorization header
  const authHeader = request.headers.get('authorization');
  const token = authHeader.slice(7);

  // Verify JWT token with Supabase Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  // Extract workspace ID from headers (validated against user access)
  const workspaceId = request.headers.get('x-workspace-id');
  if (!workspaceId) {
    throw {
      code: 'UNAUTHORIZED',
      message: 'Missing workspace ID header',
      statusCode: 401
    } as AuthError;
  }

  // Verify user has access to the workspace
  const { data: workspaceMember, error: memberError } = await supabase
    .from('workspace_members')
    .select(`
      role,
      permissions,
      workspace:workspaces!inner(id, name, status)
    `)
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (memberError || !workspaceMember) {
    throw {
      code: 'WORKSPACE_ACCESS_DENIED',
      message: 'Access denied to workspace',
      statusCode: 403
    } as AuthError;
  }
}
```

**USED BY:** This pattern is used in some newer API routes but NOT consistently.

**CRITICAL REQUIREMENT:** Requires `x-workspace-id` header to be present in request.

### Pattern 2: Direct Supabase Query (Most Common)

**Example:** `/app/api/linkedin/workspace-connect/route.ts` (lines 36-46)

```typescript
// Verify workspace access
const { data: workspaceAccess, error: accessError } = await supabase
  .from('workspace_members')
  .select('role')
  .eq('workspace_id', workspace_id)
  .eq('user_id', session.user.id)
  .single();

if (accessError || !workspaceAccess) {
  return NextResponse.json({
    error: 'Access denied to workspace'
  }, { status: 403 });
}
```

**USED BY:** Most API routes use this pattern:
- `/app/api/campaigns/upload-prospects/route.ts` (line 69-77)
- `/app/api/campaigns/linkedin/execute-via-n8n/route.ts` (line 680-687)
- `/app/api/campaigns/messages/approval/route.ts` (line 26-32)
- `/app/api/signup-intelligence/route.ts` (line 53-59)
- Many more...

**CRITICAL FINDING:** This query will FAIL if:
1. User is not in `workspace_members` table for the workspace
2. RLS policies block the query
3. `workspace_id` is null or invalid

### Pattern 3: Admin Bypass (Super Admin Routes)

**File:** `/app/api/admin/workspaces/route.ts` (lines 17-19)

```typescript
// Create Supabase admin client (uses service role key)
const adminSupabase = supabaseAdmin();
```

**FINDING:** Admin routes use service role client which **BYPASSES RLS**, but the calling API still requires user to be in `workspace_members` for non-admin routes.

---

## 5. RLS Policy Impact

### Current RLS Policies

**File:** `/docs/database/fix-rls-policies.sql`

```sql
-- Workspaces access policy
CREATE POLICY "Users can select workspaces they own or are members of"
  ON workspaces FOR SELECT
  USING (
    owner_id = auth.uid() OR
    id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Workspace members access policy
CREATE POLICY "Users can view workspace members they own"
  ON workspace_members FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    ) OR
    user_id = auth.uid()
  );

-- Super admins can manage all workspaces
CREATE POLICY "Super admins can manage all workspaces"
  ON workspaces FOR ALL
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );
```

**CRITICAL FINDINGS:**

1. **Super admin policy uses auth.email()** - This should work but requires JWT to have email claim
2. **Circular dependency risk** - Workspace policy checks workspace_members, which checks workspaces (owner_id check)
3. **No grace period for new users** - If user is created but not added to workspace_members, they have NO access

### RLS Blocking Scenario

**When "Access denied to workspace" occurs:**

```
1. User logs in → JWT created with user.id and email
2. Frontend calls API with workspace_id from state
3. API route queries workspace_members:
   .eq('workspace_id', workspace_id)
   .eq('user_id', user.id)
   .single()
4. RLS policy checks: Is user.id in workspace_members for this workspace?
5. If NO → Query returns empty (accessError or !workspaceAccess)
6. API returns: { error: 'Access denied to workspace' }, status: 403
```

**ROOT CAUSES:**

1. **User not in workspace_members table** - Most common
2. **workspace_id is null/undefined** - Frontend race condition
3. **RLS policy too restrictive** - Blocks legitimate access
4. **Super admin email not in JWT** - Email claim missing

---

## 6. Differences Between Admin Routes and Regular Routes

### Admin Routes (Super Admin Only)

**File:** `/middleware.ts` (lines 36-82)

```typescript
if (request.nextUrl.pathname.startsWith('/admin')) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  // Check if user is a member of InnovareAI workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role, status')
    .eq('workspace_id', INNOVARE_AI_WORKSPACE_ID)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (memberError || !membership) {
    return new NextResponse(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Access to admin routes is restricted to InnovareAI workspace members only.'
      }),
      { status: 403 }
    );
  }
}
```

**CRITICAL FINDING:** Even super admins (tl@innovareai.com, cl@innovareai.com) must be in `workspace_members` for InnovareAI workspace to access `/admin` routes.

**HARDCODED WORKSPACE ID:**
```typescript
const INNOVARE_AI_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
```

### Regular Routes (All Users)

- Use anon key (RLS enforced)
- Require workspace_id from request body/params
- Check workspace_members table directly
- No special bypass for admins

**INCONSISTENCY:** Admin users can access `/admin` routes but may still get "Access denied" on regular API routes if:
1. They're accessing a workspace they're not a member of
2. workspace_id is null/undefined
3. RLS blocks the query

---

## 7. Database Migration Issues

### current_workspace_id Column

**File:** `/migrations/fix_current_workspace_id.sql`

```sql
-- Add current_workspace_id column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS current_workspace_id UUID;

-- Set current_workspace_id for existing users
UPDATE users u
SET current_workspace_id = (
  SELECT wm.workspace_id
  FROM workspace_members wm
  WHERE wm.user_id = u.id
  ORDER BY wm.joined_at ASC
  LIMIT 1
)
WHERE current_workspace_id IS NULL;
```

**File:** `/migrations/auto_assign_workspace_trigger.sql`

```sql
-- Auto-assign workspace when membership is created
CREATE OR REPLACE FUNCTION auto_assign_user_workspace()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET current_workspace_id = NEW.workspace_id
  WHERE id = NEW.user_id
  AND current_workspace_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_assign_workspace
  AFTER INSERT ON workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_user_workspace();
```

**CRITICAL FINDINGS:**

1. **Trigger only fires on INSERT** - Existing users need manual update
2. **Only updates if current_workspace_id IS NULL** - Won't update if set to wrong workspace
3. **No validation that workspace exists** - Could set to deleted workspace
4. **Not used in auth flow** - Session doesn't include current_workspace_id

---

## 8. Specific Code Changes Needed

### Fix 1: Add workspace_id to Session (HIGHEST PRIORITY)

**File:** `/app/api/auth/signin/route.ts`

**Current code (lines 68-84):**
```typescript
if (data.session && data.user) {
  console.log('User signed in successfully:', data.user.id);

  const response = NextResponse.json({
    message: 'Sign-in successful!',
    user: {
      id: data.user.id,
      email: data.user.email,
      firstName: data.user.user_metadata?.first_name,
      lastName: data.user.user_metadata?.last_name
    }
  });

  return response;
}
```

**REQUIRED CHANGE:**
```typescript
if (data.session && data.user) {
  console.log('User signed in successfully:', data.user.id);

  // CRITICAL: Get user's current workspace
  const { data: userData } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', data.user.id)
    .single();

  // If no current workspace, get first workspace membership
  let workspaceId = userData?.current_workspace_id;
  if (!workspaceId) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', data.user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single();

    workspaceId = membership?.workspace_id;

    // Update users table with this workspace
    if (workspaceId) {
      await supabase
        .from('users')
        .update({ current_workspace_id: workspaceId })
        .eq('id', data.user.id);
    }
  }

  const response = NextResponse.json({
    message: 'Sign-in successful!',
    user: {
      id: data.user.id,
      email: data.user.email,
      firstName: data.user.user_metadata?.first_name,
      lastName: data.user.user_metadata?.last_name,
      workspaceId: workspaceId  // CRITICAL: Include workspace
    }
  });

  return response;
}
```

### Fix 2: Include workspace_id in Session Endpoint

**File:** `/app/api/auth/session/route.ts`

**Add to response (line 55-69):**
```typescript
// Get user's current workspace
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
    workspaceId: userData?.current_workspace_id  // CRITICAL: Add this
  },
  session: {
    accessToken: session.access_token,
    expiresAt: session.expires_at,
    refreshToken: session.refresh_token
  },
  authenticated: true
});
```

### Fix 3: Update Frontend to Use workspace_id from Session

**File:** `/app/page.tsx`

**Current useEffect (lines 1060-1120):**
```typescript
useEffect(() => {
  const initAuth = async () => {
    // ... auth check ...
    if (session) {
      setUser(session.user);
      setSession(session);

      // Load workspaces
      await loadWorkspaces(user.id, isAdmin, user.email);
    }
  };

  initAuth();
}, []);
```

**REQUIRED CHANGE:**
```typescript
useEffect(() => {
  const initAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      setUser(session.user);
      setSession(session);

      // CRITICAL: Set workspace from session FIRST
      if (session.user.user_metadata?.workspaceId) {
        setSelectedWorkspaceId(session.user.user_metadata.workspaceId);
      }

      // Then load full workspace list
      await loadWorkspaces(session.user.id, isAdmin, session.user.email);
    }
  };

  initAuth();
}, []);
```

### Fix 4: Update Supabase JWT to Include workspace_id

**Database Function:**
```sql
-- Add custom claims to JWT
CREATE OR REPLACE FUNCTION auth.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  claims jsonb;
  user_workspace_id uuid;
BEGIN
  -- Get user's current workspace
  SELECT current_workspace_id INTO user_workspace_id
  FROM public.users
  WHERE id = (event->>'user_id')::uuid;

  -- Add to claims
  claims := event->'claims';
  claims := jsonb_set(claims, '{workspace_id}', to_jsonb(user_workspace_id));
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION auth.custom_access_token_hook TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION auth.custom_access_token_hook TO postgres;
GRANT EXECUTE ON FUNCTION auth.custom_access_token_hook TO service_role;
```

**Then enable in Supabase Dashboard:**
1. Go to Authentication → Hooks
2. Enable "Custom Access Token Hook"
3. Set function name: `auth.custom_access_token_hook`

### Fix 5: Update RLS Policies to Allow Super Admins

**File:** `/docs/database/fix-rls-policies.sql`

**Add to workspace_members policies:**
```sql
-- Super admins can always view workspace members
CREATE POLICY "Super admins bypass RLS for workspace members"
  ON workspace_members FOR SELECT
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );
```

### Fix 6: Ensure Users are Added to workspace_members on Signup

**File:** `/app/api/auth/signup/route.ts` (not shown, but needs to be checked)

**Required logic:**
```typescript
// After user is created
if (data.user) {
  // Create a default workspace for new user
  const { data: workspace } = await supabase
    .from('workspaces')
    .insert({
      name: `${firstName}'s Workspace`,
      owner_id: data.user.id,
      slug: `${firstName.toLowerCase()}-workspace`,
      status: 'active'
    })
    .select()
    .single();

  // Add user to workspace_members
  await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: data.user.id,
      role: 'owner',
      status: 'active'
    });

  // Set current_workspace_id
  await supabase
    .from('users')
    .update({ current_workspace_id: workspace.id })
    .eq('id', data.user.id);
}
```

---

## 9. Summary of Root Causes

### Workspace Context Flow Breakdown

```
LOGIN
  ↓
[✅] Supabase creates session with JWT
[❌] JWT does NOT include workspace_id  ← ROOT CAUSE #1
  ↓
[✅] Frontend receives session
[❌] No workspace_id in session response  ← ROOT CAUSE #2
  ↓
[⚠️] Frontend loads workspaces (async, race condition)  ← ROOT CAUSE #3
[❌] selectedWorkspaceId may be null during this time
  ↓
[❌] API request fires with null workspace_id  ← ROOT CAUSE #4
  ↓
[❌] API route queries workspace_members with null workspace_id
  ↓
[❌] RLS policy blocks query OR query returns empty  ← ROOT CAUSE #5
  ↓
[❌] ERROR: "Access denied to workspace"
```

### The 5 Root Causes

1. **JWT does not include workspace_id claim**
   - Solution: Add custom access token hook

2. **Session endpoint does not return workspace_id**
   - Solution: Query users.current_workspace_id and include in response

3. **Race condition in frontend workspace loading**
   - Solution: Set workspace_id from session BEFORE making any API calls

4. **API requests may not include workspace_id**
   - Solution: Enforce workspace_id in all API route handlers

5. **RLS policies block access when user not in workspace_members**
   - Solution: Ensure all users are in workspace_members + add super admin bypass

---

## 10. Testing Checklist

### After Implementing Fixes

- [ ] **Login Flow**
  - [ ] Sign in and verify workspace_id in session response
  - [ ] Check JWT token includes workspace_id claim
  - [ ] Verify no console errors about null workspace

- [ ] **API Routes**
  - [ ] Test campaign creation with workspace context
  - [ ] Test LinkedIn integration routes
  - [ ] Test prospect upload routes
  - [ ] Verify super admin can access any workspace

- [ ] **RLS Policies**
  - [ ] Verify regular users can only see their workspaces
  - [ ] Verify super admins can see all workspaces
  - [ ] Test with new user (no workspace_members record yet)

- [ ] **Edge Cases**
  - [ ] User with no workspaces
  - [ ] User with multiple workspaces
  - [ ] Super admin accessing other workspaces
  - [ ] Deleted workspace scenario

---

## 11. Recommended Implementation Order

1. **Phase 1: Database Setup (1 hour)**
   - Run `fix_current_workspace_id.sql` migration
   - Run `auto_assign_workspace_trigger.sql` migration
   - Add custom JWT hook function
   - Update RLS policies for super admin bypass

2. **Phase 2: Auth Flow (2 hours)**
   - Update `/app/api/auth/signin/route.ts` to fetch and return workspace_id
   - Update `/app/api/auth/session/route.ts` to include workspace_id
   - Update `/app/api/auth/signup/route.ts` to create workspace and membership

3. **Phase 3: Frontend (1 hour)**
   - Update `/app/page.tsx` to use workspace_id from session
   - Remove race condition by setting workspace before async load
   - Add fallback handling for null workspace

4. **Phase 4: Testing (2 hours)**
   - Test login flow with existing users
   - Test signup flow with new users
   - Test super admin access
   - Test regular user access
   - Test edge cases

5. **Phase 5: Monitoring (ongoing)**
   - Add logging to track workspace context
   - Monitor for "Access denied" errors
   - Check database triggers are firing
   - Verify JWT claims include workspace_id

---

## 12. Files Requiring Changes

### Critical Files
1. `/app/api/auth/signin/route.ts` - Add workspace_id to signin response
2. `/app/api/auth/session/route.ts` - Add workspace_id to session response
3. `/app/page.tsx` - Use workspace_id from session, fix race condition
4. `/lib/auth.ts` - Update to handle workspace_id from JWT claims
5. `/migrations/fix_current_workspace_id.sql` - Already exists, needs to be run
6. `/migrations/auto_assign_workspace_trigger.sql` - Already exists, needs to be run

### Database Changes
1. Add custom JWT hook function to Supabase
2. Update RLS policies with super admin bypass
3. Backfill current_workspace_id for existing users

### Optional Enhancements
1. Add workspace_id validation middleware
2. Create workspace switcher API endpoint
3. Add workspace_id to all API route logs
4. Create admin endpoint to manually assign users to workspaces

---

## Conclusion

The "Access denied to workspace" error is caused by a **broken workspace context chain** from login to API requests. Workspace_id is never added to the session, so the frontend and API routes don't have a reliable way to know which workspace the user is operating in.

The fix requires:
1. Adding workspace_id to JWT claims (custom hook)
2. Returning workspace_id in auth responses
3. Using workspace_id from session in frontend
4. Ensuring all users are in workspace_members table
5. Adding super admin bypass in RLS policies

Once these changes are implemented, workspace context will flow seamlessly from login → session → frontend → API requests, eliminating the "Access denied" error.

---

**End of Report**
