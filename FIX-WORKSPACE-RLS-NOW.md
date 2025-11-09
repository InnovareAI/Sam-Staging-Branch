# 🚨 IMMEDIATE FIX: Workspace RLS Circular Dependency

## Problem Identified

The `workspace_members` table has a **circular dependency** in its RLS policy:

```sql
-- BROKEN POLICY (lines 61-72 in 20250923160000_create_workspace_tables.sql)
CREATE POLICY "Users can view workspace memberships..." ON workspace_members
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members  -- ❌ CIRCULAR!
            WHERE user_id = auth.uid()
        )
    );
```

**Why it fails:** The policy tries to query `workspace_members` to check if you can query `workspace_members`. This creates an infinite loop that returns 0 rows.

## Solution

Simple, non-circular policy: **Users can see their own memberships directly.**

## Apply Fix NOW

### Step 1: Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
2. Click **SQL Editor** in left sidebar
3. Create new query

### Step 2: Run This SQL

Copy and paste this entire script:

```sql
-- FIX WORKSPACE_MEMBERS RLS CIRCULAR DEPENDENCY

-- Drop ALL existing problematic policies
DROP POLICY IF EXISTS "Users can view workspace memberships for workspaces they have access to" ON workspace_members;
DROP POLICY IF EXISTS "Workspace owners and admins can manage members" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_view" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_admin_manage" ON workspace_members;
DROP POLICY IF EXISTS "workspace_isolation_workspace_members" ON workspace_members;
DROP POLICY IF EXISTS "emergency_admin_access_workspace_members" ON workspace_members;
DROP POLICY IF EXISTS "service_role_full_access_workspace_members" ON workspace_members;

-- Create simple, non-circular SELECT policy
CREATE POLICY "Users can view their own memberships" ON workspace_members
    FOR SELECT
    USING (user_id = auth.uid());

-- Allow workspace owners to see all members
CREATE POLICY "Workspace owners can view all members" ON workspace_members
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

-- Insert/Update/Delete for owners only
CREATE POLICY "Workspace owners can manage members" ON workspace_members
    FOR ALL
    USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

-- Service role bypass
CREATE POLICY "Service role full access" ON workspace_members
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Verify RLS is enabled
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
```

### Step 3: Click "RUN" (or press Cmd+Enter)

You should see:

```
Success. No rows returned
```

### Step 4: Verify Fix Worked

Run this query to check your memberships are now visible:

```sql
SELECT
    workspace_id,
    user_id,
    role,
    status
FROM workspace_members
WHERE user_id = 'f6885ff3-deef-4781-8721-93011c990b1b';
```

**Expected result:** Should return 1 row showing your workspace IA1 membership.

### Step 5: Test in Browser

1. Go to: https://app.meet-sam.com
2. Hard refresh (Cmd+Shift+R)
3. Check browser console

**Expected logs:**
```
[workspace/list] Query result: {
  membershipCount: 1,
  memberError: null
}
✅ [WORKSPACE LOAD] API returned 1 workspaces
✅ Auto-selecting workspace from API: IA1
```

## Why This Fix Works

### Before (Broken):
```
User queries workspace_members
  → RLS checks: "Is user in workspace_members?"
    → Queries workspace_members again
      → RLS checks: "Is user in workspace_members?"
        → Queries workspace_members again...
          → INFINITE LOOP → Returns 0 rows
```

### After (Fixed):
```
User queries workspace_members
  → RLS checks: "Is user_id = auth.uid()?"
    → YES → Returns row immediately ✅
```

## Files Modified

- Created: `/sql/fix-workspace-members-rls.sql` (backup copy of fix)
- Created: This instructions file

## No Code Deploy Needed

This is a **database-only fix**. No code changes required. The existing API code will work once RLS policies are fixed.

## Verification Checklist

After applying SQL fix:

- [ ] SQL executed successfully (no errors)
- [ ] Verification query returns 1 row
- [ ] Browser shows workspace loaded
- [ ] Console shows `membershipCount: 1`
- [ ] Can access workspace features (campaigns, etc.)

## If Still Not Working

Check these:

1. **Wrong user ID?**
   ```sql
   -- Check your actual user ID
   SELECT auth.uid();
   ```

2. **Membership status not 'active'?**
   ```sql
   -- Update status if needed
   UPDATE workspace_members
   SET status = 'active'
   WHERE user_id = 'f6885ff3-deef-4781-8721-93011c990b1b';
   ```

3. **Wrong workspace_id format?**
   ```sql
   -- Check workspace exists
   SELECT id, name, slug FROM workspaces WHERE slug IN ('IA1', 'IA01');
   ```

## Success Criteria

✅ Workspace loads without errors
✅ Console shows 1+ workspaces returned
✅ Can access campaigns, prospects, etc.
✅ No "No Workspace Selected" error

---

**Created:** 2025-11-09
**Issue:** RLS circular dependency on workspace_members
**Fix:** Simple user_id = auth.uid() policy
**Impact:** CRITICAL - blocks all workspace access
**Urgency:** IMMEDIATE - apply now
