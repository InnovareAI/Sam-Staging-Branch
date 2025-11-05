# Super Admin Account Implementation

## Overview

Implement a super admin system that allows platform administrators to access all workspaces without needing individual workspace memberships.

## Architecture

### 1. Database Schema Changes

```sql
-- Add super admin flag to users table (if not exists)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_super_admin ON users(is_super_admin) WHERE is_super_admin = TRUE;

-- Set tl@innovareai.com as super admin
UPDATE users
SET is_super_admin = TRUE
WHERE email = 'tl@innovareai.com';

-- Create helper function to check super admin
CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT is_super_admin
    FROM public.users
    WHERE id = auth.uid()
  ) = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Update ALL RLS Policies

**Pattern: Add super admin bypass to every policy**

```sql
-- Example: campaigns table
DROP POLICY IF EXISTS "Users can access workspace campaigns" ON campaigns;

CREATE POLICY "Users can access workspace campaigns" ON campaigns
  USING (
    -- Super admin can access all campaigns
    auth.is_super_admin() = TRUE
    OR
    -- Regular users can only access their workspace campaigns
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Super admin can modify all campaigns
    auth.is_super_admin() = TRUE
    OR
    -- Regular users can only modify their workspace campaigns
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );
```

### 3. API Route Changes

**Update middleware/helpers to respect super admin:**

```typescript
// lib/check-workspace-access.ts
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

export async function checkWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<{ hasAccess: boolean; isSuperAdmin: boolean; role?: string }> {
  const supabase = await createSupabaseRouteClient();

  // Check if super admin
  const { data: user } = await supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', userId)
    .single();

  if (user?.is_super_admin) {
    return { hasAccess: true, isSuperAdmin: true, role: 'super_admin' };
  }

  // Check workspace membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  return {
    hasAccess: !!membership,
    isSuperAdmin: false,
    role: membership?.role
  };
}
```

**Use in API routes:**

```typescript
// app/api/campaigns/route.ts
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { workspace_id } = await req.json();

  // Check access (respects super admin)
  const { hasAccess, isSuperAdmin } = await checkWorkspaceAccess(user.id, workspace_id);

  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Super admin indicator for logging
  if (isSuperAdmin) {
    console.log('🔐 Super admin access:', { user_email: user.email, workspace_id });
  }

  // Proceed with operation...
}
```

### 4. Frontend Changes

**Show all workspaces for super admin:**

```typescript
// app/providers/WorkspaceProvider.tsx
async function loadWorkspaces(userId: string) {
  const supabase = createClient();

  // Check if super admin
  const { data: userData } = await supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', userId)
    .single();

  if (userData?.is_super_admin) {
    console.log('🔐 Super admin detected - loading all workspaces');

    // Load ALL workspaces
    const { data: allWorkspaces } = await supabase
      .from('workspaces')
      .select('id, name, created_at')
      .order('name');

    return allWorkspaces?.map(w => ({
      workspace_id: w.id,
      role: 'super_admin',
      workspaces: w
    })) || [];
  }

  // Regular user - load only memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name, created_at)')
    .eq('user_id', userId);

  return memberships || [];
}
```

**Super admin indicator in UI:**

```typescript
// app/components/WorkspaceSelector.tsx
{isSuperAdmin && (
  <div className="text-xs text-orange-500 font-semibold">
    🔐 SUPER ADMIN MODE
  </div>
)}

<select
  value={selectedWorkspace}
  onChange={handleWorkspaceChange}
>
  {workspaces.map(w => (
    <option key={w.workspace_id} value={w.workspace_id}>
      {w.workspaces.name}
      {isSuperAdmin ? ' [Admin Access]' : ` (${w.role})`}
    </option>
  ))}
</select>
```

### 5. Audit Logging

**Log all super admin actions:**

```typescript
// lib/audit-log.ts
export async function logSuperAdminAction(
  action: string,
  workspaceId: string,
  userId: string,
  details?: any
) {
  const supabase = await createSupabaseRouteClient();

  await supabase
    .from('audit_logs')
    .insert({
      action,
      user_id: userId,
      workspace_id: workspaceId,
      details: {
        is_super_admin_action: true,
        ...details
      },
      created_at: new Date().toISOString()
    });
}
```

## Migration Script

```sql
-- Run this in Supabase SQL Editor

-- 1. Add column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- 2. Set super admins (update emails as needed)
UPDATE users
SET is_super_admin = TRUE
WHERE email IN (
  'tl@innovareai.com',
  'mg@innovareai.com'  -- Add other platform admins
);

-- 3. Create helper function
CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (SELECT is_super_admin FROM public.users WHERE id = auth.uid()),
    FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update all RLS policies (example for common tables)

-- campaigns
DROP POLICY IF EXISTS "Users can access workspace campaigns" ON campaigns;
CREATE POLICY "Users can access workspace campaigns" ON campaigns
  USING (
    auth.is_super_admin() = TRUE OR
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- campaign_prospects
DROP POLICY IF EXISTS "workspace_member_access" ON campaign_prospects;
CREATE POLICY "workspace_member_access" ON campaign_prospects
  USING (
    auth.is_super_admin() = TRUE OR
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- workspace_prospects
DROP POLICY IF EXISTS "Users can access workspace prospects" ON workspace_prospects;
CREATE POLICY "Users can access workspace prospects" ON workspace_prospects
  USING (
    auth.is_super_admin() = TRUE OR
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- knowledge_base
DROP POLICY IF EXISTS "Users can view knowledge base items in their workspace" ON knowledge_base;
CREATE POLICY "Users can view knowledge base items in their workspace" ON knowledge_base
  FOR SELECT USING (
    auth.is_super_admin() = TRUE OR
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- Add more tables as needed...

-- 5. Verify super admin setup
SELECT
  email,
  is_super_admin,
  created_at
FROM users
WHERE is_super_admin = TRUE;
```

## Tables Requiring RLS Policy Updates

Run this query to find all tables with `workspace_id`:

```sql
SELECT
  t.table_name,
  COUNT(p.policyname) as policy_count
FROM information_schema.tables t
LEFT JOIN pg_policies p ON p.tablename = t.table_name
WHERE t.table_schema = 'public'
  AND EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_name = t.table_name
      AND c.column_name = 'workspace_id'
  )
GROUP BY t.table_name
ORDER BY policy_count ASC;
```

Expected tables to update:
- ✅ campaigns
- ✅ campaign_prospects
- ✅ campaign_messages
- ✅ campaign_replies
- ✅ workspace_prospects
- ✅ knowledge_base
- ✅ knowledge_base_sections
- ✅ prospect_approval_sessions
- ✅ prospect_approval_data
- ✅ enrichment_jobs
- ✅ campaign_schedules
- ✅ workspace_accounts
- ... (all workspace-scoped tables)

## Security Considerations

1. **Who should be super admin?**
   - Platform owners only (tl@innovareai.com, mg@innovareai.com)
   - NOT service accounts (tl+bll@innovareai.com)
   - NOT client users

2. **Audit everything**
   - Log all super admin actions
   - Alert on suspicious activity
   - Regular access reviews

3. **Limit super admin actions**
   - Read-only by default
   - Require explicit confirmation for destructive actions
   - Consider MFA for super admin accounts

4. **Emergency access**
   - Keep service role key secure
   - Document emergency access procedures
   - Test regularly

## Testing Checklist

- [ ] Super admin sees all workspaces in dropdown
- [ ] Super admin can access any campaign
- [ ] Super admin can create campaigns in any workspace
- [ ] Regular user only sees their workspaces
- [ ] Regular user cannot access other workspaces
- [ ] Super admin indicator shows in UI
- [ ] Audit logs capture super admin actions
- [ ] RLS policies work for both super admin and regular users

## Rollback Plan

If issues arise:

```sql
-- Disable super admin temporarily
UPDATE users SET is_super_admin = FALSE WHERE is_super_admin = TRUE;

-- Or revert specific user
UPDATE users SET is_super_admin = FALSE WHERE email = 'user@example.com';
```

RLS policies will fall back to regular membership checks.

## Future Enhancements

1. **Role-based super admin**
   - `super_admin_readonly` - can view but not modify
   - `super_admin_full` - can view and modify
   - `super_admin_support` - can view + impersonate users

2. **Workspace-level permissions**
   - Some super admins only see certain workspace groups
   - Example: `tl@innovareai.com` sees all, `support@innovareai.com` sees only active clients

3. **Time-limited access**
   - Grant super admin for X hours
   - Auto-revoke after time limit
   - Useful for temporary support access

4. **Audit dashboard**
   - View all super admin actions
   - Alert on unusual patterns
   - Export for compliance
