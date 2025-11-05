# Workspace Isolation Security Fix

## Problem Summary

Users can access workspaces they're not members of due to:
1. localStorage persisting workspace selection across logout/login
2. Missing validation that user has access to selected workspace
3. Inconsistent RLS enforcement across API endpoints

## Solution Implementation

### 1. Client-Side: Validate Workspace on Auth Change

**File:** `app/providers/AuthProvider.tsx` or wherever auth state is managed

```typescript
// On auth state change (login/logout/session refresh)
useEffect(() => {
  async function validateWorkspace() {
    if (!user) {
      // User logged out - clear workspace selection
      localStorage.removeItem('selectedWorkspaceId');
      return;
    }

    // User logged in - validate stored workspace
    const storedWorkspaceId = localStorage.getItem('selectedWorkspaceId');

    if (storedWorkspaceId) {
      // Check if user has access to stored workspace
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('workspace_id', storedWorkspaceId)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        console.warn('⚠️ User does not have access to stored workspace, clearing...');
        localStorage.removeItem('selectedWorkspaceId');

        // Auto-select first available workspace
        const { data: userWorkspaces } = await supabase
          .from('workspace_members')
          .select('workspace_id, workspaces(name)')
          .eq('user_id', user.id)
          .limit(1);

        if (userWorkspaces && userWorkspaces.length > 0) {
          localStorage.setItem('selectedWorkspaceId', userWorkspaces[0].workspace_id);
        }
      }
    }
  }

  validateWorkspace();
}, [user]);
```

### 2. Server-Side: Enforce Workspace Membership Consistently

**Pattern for ALL workspace-scoped API routes:**

```typescript
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request
    const body = await req.json();
    const { workspace_id, ...otherData } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // 3. CRITICAL: Verify workspace membership BEFORE any operations
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      console.error('Access denied:', { workspace_id, user_id: user.id, error: membershipError });
      return NextResponse.json({
        error: 'Access denied to workspace'
      }, { status: 403 });
    }

    // 4. Proceed with operation (RLS will double-check)
    // ... rest of your logic
  } catch (error) {
    // ... error handling
  }
}
```

### 3. Database: Audit and Fix RLS Policies

**Run this audit to find tables without proper RLS:**

```sql
-- Find all tables with workspace_id but no RLS policy
SELECT
  schemaname,
  tablename,
  (SELECT COUNT(*)
   FROM pg_policies
   WHERE schemaname = t.schemaname
   AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
  AND EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = t.schemaname
      AND c.table_name = t.tablename
      AND c.column_name = 'workspace_id'
  )
ORDER BY policy_count ASC;
```

**Standard RLS policy template:**

```sql
-- Enable RLS on table
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access rows in workspaces they're members of
CREATE POLICY "workspace_member_access" ON your_table
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );
```

### 4. Middleware: Add Global Workspace Validation

**File:** `middleware.ts` (if not already exists)

```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If user is authenticated, validate workspace access for API routes
  if (session && req.nextUrl.pathname.startsWith('/api/')) {
    const workspaceId = req.headers.get('x-workspace-id') ||
                        req.nextUrl.searchParams.get('workspace_id');

    if (workspaceId) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', session.user.id)
        .single();

      if (!membership) {
        return NextResponse.json(
          { error: 'Access denied to workspace' },
          { status: 403 }
        );
      }
    }
  }

  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
```

### 5. Frontend: Workspace Selector Component

```typescript
// Ensure workspace selector shows only user's workspaces
const WorkspaceSelector = () => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);

  useEffect(() => {
    async function loadWorkspaces() {
      if (!user) return;

      // Get ONLY workspaces user is a member of
      const { data } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, workspaces(id, name)')
        .eq('user_id', user.id);

      setWorkspaces(data || []);

      // Validate stored selection
      const storedId = localStorage.getItem('selectedWorkspaceId');
      const hasAccess = data?.some(w => w.workspace_id === storedId);

      if (hasAccess) {
        setSelectedWorkspace(storedId);
      } else if (data && data.length > 0) {
        // Auto-select first workspace
        const firstWorkspace = data[0].workspace_id;
        setSelectedWorkspace(firstWorkspace);
        localStorage.setItem('selectedWorkspaceId', firstWorkspace);
      }
    }

    loadWorkspaces();
  }, [user]);

  return (
    <select
      value={selectedWorkspace || ''}
      onChange={(e) => {
        setSelectedWorkspace(e.target.value);
        localStorage.setItem('selectedWorkspaceId', e.target.value);
      }}
    >
      {workspaces.map(w => (
        <option key={w.workspace_id} value={w.workspace_id}>
          {w.workspaces.name} ({w.role})
        </option>
      ))}
    </select>
  );
};
```

## Implementation Priority

### Phase 1: Critical Security (Do First)
1. ✅ Add workspace membership check to ALL API routes
2. ✅ Audit all RLS policies
3. ✅ Add client-side validation on auth state change

### Phase 2: User Experience
1. Clear localStorage on logout
2. Improve workspace selector UX
3. Add "Access Denied" error handling in UI

### Phase 3: Monitoring
1. Add logging for workspace access attempts
2. Create alerts for 403 errors
3. Dashboard for workspace access patterns

## Testing Checklist

- [ ] Login as user A with workspace X
- [ ] Logout
- [ ] Login as user B (no access to workspace X)
- [ ] Verify localStorage cleared or workspace changed
- [ ] Attempt to access workspace X via API
- [ ] Verify 403 error returned
- [ ] Verify UI shows only accessible workspaces

## Migration Script

Run this to ensure all users have proper workspace access:

```sql
-- Find users without any workspace membership
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN workspace_members wm ON wm.user_id = u.id
WHERE wm.id IS NULL
ORDER BY u.created_at DESC;

-- Optionally auto-assign orphaned users to default workspace
-- (Only run if you have a default workspace policy)
```

## Rollback Plan

If issues arise:
1. Revert middleware changes
2. Keep RLS policies (they're always safe)
3. Keep client-side validation (improves UX)
4. Investigate specific API endpoint causing issues

## Related Files to Update

- [ ] `app/providers/AuthProvider.tsx` - Auth state validation
- [ ] `middleware.ts` - Global workspace validation
- [ ] `app/api/campaigns/route.ts` - Add membership check
- [ ] `app/api/campaigns/[id]/route.ts` - Add membership check
- [ ] All other `/api/campaigns/*` endpoints
- [ ] All other workspace-scoped API routes
- [ ] `app/components/WorkspaceSelector.tsx` - Filter workspaces by membership
