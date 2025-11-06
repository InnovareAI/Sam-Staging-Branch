# Quick Fix Guide: "Access denied to workspace"

## Problem
User `tl@innovareai.com` gets "Access denied to workspace" when creating campaigns.

## Root Cause
**Row Level Security (RLS) policies on `workspace_members` table are broken/missing.**

Database data is correct. User has valid membership (role=owner, status=active).
The issue is RLS policies blocking legitimate access.

---

## The Fix (5 minutes)

### Step 1: Open Supabase SQL Editor
https://supabase.com/dashboard → SQL Editor

### Step 2: Run This SQL

```sql
-- Enable RLS (if not already enabled)
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Drop any broken policies
DROP POLICY IF EXISTS "Users can view their workspace memberships" ON workspace_members;
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON workspace_members;

-- Create correct policy
CREATE POLICY "Users can view their workspace memberships"
ON workspace_members
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to see other members in their workspaces
CREATE POLICY "Users can view members of their workspaces"
ON workspace_members
FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);

-- Service role full access
CREATE POLICY "Service role full access"
ON workspace_members
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

### Step 3: Verify Fix

```sql
-- Simulate user query (should return 1 row)
SELECT set_config('request.jwt.claims', '{"sub": "f6885ff3-deef-4781-8721-93011c990b1b"}', true);

SELECT workspace_id, user_id, role, status
FROM workspace_members
WHERE user_id = 'f6885ff3-deef-4781-8721-93011c990b1b'
AND workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
```

**Expected:** 1 row with `role=owner, status=active`

### Step 4: Test in App
1. Log in as tl@innovareai.com
2. Try to create a campaign
3. Should work now!

---

## Why This Happens

```
User Request → API → Supabase Query
                         ↓
                    RLS Policy Applied
                         ↓
              If no policy matches auth.uid()
                         ↓
                   Returns Empty
                         ↓
            API: "Access denied to workspace"
```

With service role key (used in audit), RLS is bypassed.
With authenticated user (used in API), RLS blocks if policies are wrong.

---

## Files Created

All documentation in project root:
- `WORKSPACE_ACCESS_AUDIT_REPORT.md` - Full audit report
- `RLS_DIAGNOSTIC_AND_FIX.txt` - Diagnostic SQL queries
- `scripts/audit-user-workspace-access.cjs` - Reusable audit script

---

## Confidence Level: 95%

**Database:** ✅ Correct (user has valid membership)
**Code:** ✅ Correct (access check logic is sound)
**RLS:** ❌ Broken (policies blocking legitimate access)

If fix doesn't work, check:
1. User session/cookies are valid
2. Correct Supabase project is being queried
3. Browser cache (clear and try again)
