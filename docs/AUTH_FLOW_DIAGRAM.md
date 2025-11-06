# Authentication & Workspace Context Flow Diagram

## Current Broken Flow (Where Error Occurs)

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LOGS IN                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/auth/signin                                          │
│  - email: user@example.com                                      │
│  - password: ********                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Supabase Auth                                                  │
│  ✅ Creates session                                             │
│  ✅ Generates JWT with:                                         │
│     - sub: user-uuid                                            │
│     - email: user@example.com                                   │
│     - role: authenticated                                       │
│  ❌ NO workspace_id in JWT                  ← PROBLEM #1        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Response to Frontend                                           │
│  {                                                              │
│    user: {                                                      │
│      id: "user-uuid",                                           │
│      email: "user@example.com",                                 │
│      firstName: "John",                                         │
│      lastName: "Doe"                                            │
│    }                                                            │
│  }                                                              │
│  ❌ NO workspaceId in response              ← PROBLEM #2        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (app/page.tsx)                                        │
│  ✅ setUser(session.user)                                       │
│  ✅ setSession(session)                                         │
│  ⚠️  selectedWorkspaceId: null (from localStorage)              │
│  ⚠️  Calls loadWorkspaces() async          ← RACE CONDITION     │
└─────────────────────────────────────────────────────────────────┘
                    ↓                        ↓
              (User clicks)            (loadWorkspaces)
         "Create Campaign" button      fetching...
                    ↓                        ↓
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/campaigns/create                                     │
│  {                                                              │
│    workspace_id: null,                     ← PROBLEM #3         │
│    name: "My Campaign"                                          │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  API Route Handler                                              │
│  const { data: member } = await supabase                        │
│    .from('workspace_members')                                   │
│    .select('role')                                              │
│    .eq('workspace_id', null)               ← PROBLEM #4         │
│    .eq('user_id', user.id)                                      │
│    .single();                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Supabase Query with RLS                                        │
│  - RLS Policy checks: Is user in workspace_members?             │
│  - Query result: EMPTY (workspace_id is null)                   │
│  ❌ RLS blocks or returns no rows          ← PROBLEM #5         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  if (!member) {                                                 │
│    return NextResponse.json(                                    │
│      { error: 'Access denied to workspace' },                   │
│      { status: 403 }                                            │
│    );                                                           │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                     ❌ ERROR SHOWN TO USER
                  "Access denied to workspace"
```

---

## Fixed Flow (After Implementation)

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LOGS IN                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/auth/signin                                          │
│  - email: user@example.com                                      │
│  - password: ********                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  API: Get User's Workspace                                      │
│  const { data: userData } = await supabase                      │
│    .from('users')                                               │
│    .select('current_workspace_id')                              │
│    .eq('id', user.id)                                           │
│    .single();                                                   │
│  ✅ workspaceId: "babdcab8-1a78-4b2f-913e-6e9fd9821009"         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Supabase Auth                                                  │
│  ✅ Creates session                                             │
│  ✅ Custom JWT Hook adds workspace_id:                          │
│     {                                                           │
│       sub: "user-uuid",                                         │
│       email: "user@example.com",                                │
│       role: "authenticated",                                    │
│       workspace_id: "babdcab8-1a78-..."  ← FIX #1               │
│     }                                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Response to Frontend                                           │
│  {                                                              │
│    user: {                                                      │
│      id: "user-uuid",                                           │
│      email: "user@example.com",                                 │
│      firstName: "John",                                         │
│      lastName: "Doe",                                           │
│      workspaceId: "babdcab8-1a78-..."    ← FIX #2               │
│    }                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (app/page.tsx)                                        │
│  ✅ setUser(session.user)                                       │
│  ✅ setSession(session)                                         │
│  ✅ setSelectedWorkspaceId(user.workspaceId)  ← FIX #3          │
│  ✅ Workspace set BEFORE any API calls                          │
│  ⚠️  Still calls loadWorkspaces() for full list (non-blocking)  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                        (User clicks)
                   "Create Campaign" button
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/campaigns/create                                     │
│  {                                                              │
│    workspace_id: "babdcab8-1a78-...",      ← FIX #4             │
│    name: "My Campaign"                                          │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  API Route Handler                                              │
│  const { data: member } = await supabase                        │
│    .from('workspace_members')                                   │
│    .select('role')                                              │
│    .eq('workspace_id', 'babdcab8-1a78-...')  ← FIX #5           │
│    .eq('user_id', user.id)                                      │
│    .single();                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Supabase Query with RLS                                        │
│  - RLS Policy checks: Is user in workspace_members?             │
│  - Query result: { role: 'owner', status: 'active' }            │
│  ✅ RLS allows, returns membership record   ← FIX #6            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  if (member) {                                                  │
│    // Proceed with campaign creation                            │
│    const { data: campaign } = await supabase                    │
│      .from('campaigns')                                         │
│      .insert({ ... })                                           │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                     ✅ SUCCESS
                 Campaign created successfully
```

---

## Database Trigger Flow (Auto-Assign Workspace)

```
┌─────────────────────────────────────────────────────────────────┐
│  User Signs Up                                                  │
│  POST /api/auth/signup                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  1. Create User in auth.users                                   │
│     INSERT INTO auth.users (email, ...)                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. Create User in public.users                                 │
│     INSERT INTO public.users (id, email, ...)                   │
│     ⚠️  current_workspace_id: NULL                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. Create Workspace                                            │
│     INSERT INTO workspaces (name, owner_id, ...)                │
│     RETURNS workspace_id: "new-workspace-uuid"                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. Add User to workspace_members                               │
│     INSERT INTO workspace_members (                             │
│       workspace_id: "new-workspace-uuid",                       │
│       user_id: "user-uuid",                                     │
│       role: "owner"                                             │
│     )                                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ⚡ TRIGGER FIRES ⚡
┌─────────────────────────────────────────────────────────────────┐
│  auto_assign_user_workspace()                                   │
│  - Detects: NEW workspace_members record                        │
│  - Checks: Is user's current_workspace_id NULL?                 │
│  - Action: UPDATE users                                         │
│            SET current_workspace_id = NEW.workspace_id          │
│            WHERE id = NEW.user_id                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Result:                                                        │
│  users.current_workspace_id = "new-workspace-uuid"              │
│  ✅ User now has default workspace                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Next Login:                                                    │
│  - JWT will include workspace_id                                │
│  - Session will include workspaceId                             │
│  - Frontend will have immediate workspace context               │
└─────────────────────────────────────────────────────────────────┘
```

---

## RLS Policy Flow (Before Fix)

```
┌─────────────────────────────────────────────────────────────────┐
│  API Query: workspace_members                                   │
│  .eq('workspace_id', null)                                      │
│  .eq('user_id', 'user-uuid')                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  RLS Policy: "Users can view workspace members they own"        │
│  USING (                                                        │
│    workspace_id IN (                                            │
│      SELECT id FROM workspaces WHERE owner_id = auth.uid()      │
│    )                                                            │
│    OR user_id = auth.uid()                                      │
│  )                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Evaluation:                                                    │
│  1. Check: Is workspace_id IN (owned workspaces)?               │
│     → workspace_id is NULL                                      │
│     → NULL IN (...) = FALSE                                     │
│  2. Check: Is user_id = auth.uid()?                             │
│     → user_id from query = 'user-uuid'                          │
│     → auth.uid() = 'user-uuid'                                  │
│     → TRUE                                                      │
│  ✅ RLS ALLOWS (because of user_id check)                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Query Result:                                                  │
│  - Returns all workspace_members where user_id = 'user-uuid'    │
│  - BUT .single() expects exactly 1 row                          │
│  - If user has multiple workspaces: ERROR                       │
│  - If workspace_id is NULL: Returns wrong workspace             │
│  ❌ Result is incorrect or error                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## RLS Policy Flow (After Fix)

```
┌─────────────────────────────────────────────────────────────────┐
│  API Query: workspace_members                                   │
│  .eq('workspace_id', 'babdcab8-1a78-...')  ← CORRECT            │
│  .eq('user_id', 'user-uuid')                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  RLS Policy: "Users can view workspace members they own"        │
│  USING (                                                        │
│    workspace_id IN (                                            │
│      SELECT id FROM workspaces WHERE owner_id = auth.uid()      │
│    )                                                            │
│    OR user_id = auth.uid()                                      │
│  )                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Evaluation:                                                    │
│  1. Check: Is 'babdcab8-...' IN (owned workspaces)?             │
│     → SELECT id FROM workspaces WHERE owner_id = 'user-uuid'    │
│     → Result: ['babdcab8-...']                                  │
│     → TRUE ✅                                                   │
│  2. No need to check user_id (already passed)                   │
│  ✅ RLS ALLOWS                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Query Result:                                                  │
│  {                                                              │
│    workspace_id: 'babdcab8-...',                                │
│    user_id: 'user-uuid',                                        │
│    role: 'owner',                                               │
│    status: 'active'                                             │
│  }                                                              │
│  ✅ Exactly 1 row, .single() succeeds                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Super Admin Access Flow (Special Case)

```
┌─────────────────────────────────────────────────────────────────┐
│  Super Admin Logs In                                            │
│  email: tl@innovareai.com                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  JWT includes:                                                  │
│  - email: tl@innovareai.com                                     │
│  - workspace_id: 'innovareai-workspace-uuid'                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Admin accesses /admin/workspaces                               │
│  GET /api/admin/workspaces                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  API uses supabaseAdmin() (service role)                        │
│  - BYPASSES RLS                                                 │
│  - Can query all workspaces                                     │
│  - Can query all workspace_members                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Admin accesses regular API route                               │
│  POST /api/campaigns/create                                     │
│  { workspace_id: 'some-other-workspace-uuid' }                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  API uses regular supabase client (anon key)                    │
│  - RLS ENFORCED                                                 │
│  - Query: workspace_members                                     │
│    .eq('workspace_id', 'some-other-workspace-uuid')             │
│    .eq('user_id', 'admin-uuid')                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  RLS Policy: "Super admins bypass workspace_members RLS"        │
│  USING (                                                        │
│    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')   │
│  )                                                              │
│  → TRUE ✅                                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Query Result:                                                  │
│  - Returns workspace_members record even if admin not member    │
│  - OR returns empty if no record exists (admin still allowed)   │
│  ✅ Super admin can access any workspace                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend Race Condition Visualization

### Before Fix (Race Condition)

```
Timeline →

t=0ms    User clicks "Sign In"
         ↓
t=100ms  POST /api/auth/signin
         ↓
t=300ms  Response: { user: {...}, NO workspaceId }
         ↓
t=310ms  setUser()
         setSession()
         selectedWorkspaceId = null ← PROBLEM
         ↓
t=320ms  loadWorkspaces() starts (async)
         ↓
t=330ms  User sees dashboard, clicks "Create Campaign"
         ↓
t=340ms  POST /api/campaigns/create
         { workspace_id: null } ← PROBLEM
         ↓
t=350ms  ❌ ERROR: "Access denied to workspace"
         ↓
t=500ms  loadWorkspaces() completes
         selectedWorkspaceId = 'workspace-uuid'
         (Too late, error already shown)
```

### After Fix (No Race Condition)

```
Timeline →

t=0ms    User clicks "Sign In"
         ↓
t=100ms  POST /api/auth/signin
         (Queries users.current_workspace_id)
         ↓
t=300ms  Response: { user: {...}, workspaceId: 'workspace-uuid' } ✅
         ↓
t=310ms  setUser()
         setSession()
         setSelectedWorkspaceId('workspace-uuid') ← FIX
         ↓
t=320ms  loadWorkspaces() starts (async, for full list)
         ↓
t=330ms  User sees dashboard, clicks "Create Campaign"
         ↓
t=340ms  POST /api/campaigns/create
         { workspace_id: 'workspace-uuid' } ✅
         ↓
t=350ms  ✅ SUCCESS: Campaign created
         ↓
t=500ms  loadWorkspaces() completes
         (Adds more workspace details, but not blocking)
```

---

## Component State Flow

```
app/page.tsx (React Component)

State Variables:
├─ user: User | null
│  └─ Set from: session.user
├─ session: Session | null
│  └─ Set from: supabase.auth.getSession()
├─ selectedWorkspaceId: string | null
│  ├─ Initialized from: localStorage (may be null)
│  └─ Set from: user.workspaceId (FIX)
├─ workspaces: Workspace[]
│  └─ Set from: loadWorkspaces() (async)
└─ currentWorkspace: Workspace | null
   └─ Computed from: workspaces.find(ws => ws.id === selectedWorkspaceId)

Flow:
1. Component mounts
   ↓
2. useEffect: Check auth
   - getSession()
   - If session exists:
     ↓
3. Set user, session
   ↓
4. ❌ BEFORE FIX: selectedWorkspaceId = null
   ✅ AFTER FIX: selectedWorkspaceId = user.workspaceId
   ↓
5. loadWorkspaces() (async, non-blocking)
   ↓
6. User can now interact with UI
   - currentWorkspace is available immediately (FIX)
   - No "Access denied" errors
```

---

## Summary Table: What Gets Fixed Where

| Problem | Location | Fix |
|---------|----------|-----|
| JWT missing workspace_id | Supabase Auth | Add custom JWT hook |
| Session response missing workspace_id | `/app/api/auth/signin/route.ts` | Query users table, add to response |
| Session response missing workspace_id | `/app/api/auth/session/route.ts` | Query users table, add to response |
| Frontend has null workspace | `/app/page.tsx` | Set from session.user.workspaceId |
| Race condition on load | `/app/page.tsx` | Set workspace BEFORE loadWorkspaces() |
| API gets null workspace_id | All API routes | Frontend now sends correct ID |
| RLS blocks admin queries | Database RLS policies | Add super admin bypass policy |
| New users have no workspace | `/migrations/auto_assign_workspace_trigger.sql` | Trigger auto-assigns on membership |
| Existing users missing workspace | `/migrations/fix_current_workspace_id.sql` | Backfill current_workspace_id |

---

**Visual Key:**
- ✅ = Working correctly
- ❌ = Error/problem
- ⚠️ = Warning/potential issue
- ← = Indicates where problem occurs
- ↓ = Flow direction
- ⚡ = Automatic trigger

---

**Last Updated:** 2025-11-07
**Status:** Ready for implementation
