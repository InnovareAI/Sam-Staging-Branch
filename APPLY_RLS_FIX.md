# Apply RLS Policy Fix - Instructions

## Problem
"Access denied to workspace" error when creating/launching campaigns.

## Solution
Apply SQL fix to correct Row Level Security (RLS) policies.

## Steps to Apply

### 1. Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql
2. Click "New Query"

### 2. Copy and Run the SQL Fix

1. Open the file: `sql/FIX_WORKSPACE_ACCESS_RLS.sql`
2. Copy the ENTIRE contents
3. Paste into Supabase SQL Editor
4. Click "Run" (or press Cmd/Ctrl + Enter)

### 3. Verify the Fix Worked

After running the SQL, you should see:
- ✅ "Success. No rows returned" (policies applied successfully)

Then run the verification queries at the bottom of the SQL file:

**Query 1: Check your memberships**
```sql
SELECT 
  workspace_id, 
  role, 
  status,
  joined_at
FROM workspace_members 
WHERE user_id = auth.uid();
```
Expected: Should return at least 1 row with your workspace membership

**Query 2: Check your campaigns**
```sql
SELECT 
  c.id,
  c.name,
  c.status,
  c.workspace_id
FROM campaigns c
WHERE c.workspace_id IN (
  SELECT workspace_id 
  FROM workspace_members 
  WHERE user_id = auth.uid() AND status = 'active'
)
ORDER BY c.created_at DESC
LIMIT 5;
```
Expected: Should return your campaigns (if you have any)

### 4. Test Campaign Creation

1. Log in to the app: https://app.meet-sam.com
2. Navigate to Campaign Hub
3. Try to create a new campaign
4. Try to launch an existing campaign

Expected: No more "Access denied to workspace" errors

## If Something Goes Wrong

Revert to restore point:
```bash
git reset --hard 6ba7ee82
git push --force
```

## What This Fix Does

1. **workspace_members table**: Allows users to see their own memberships and other members in their workspaces
2. **campaigns table**: Allows workspace members to create, read, update, and delete campaigns
3. **campaign_prospects table**: Allows workspace members to manage prospects in their campaigns
4. **service_role policies**: Ensures admin operations always work (bypass RLS)

## Technical Details

RLS (Row Level Security) policies act as database-level filters. When you query with an authenticated user context:
- Supabase checks: "Does this user have permission to see this row?"
- If no matching policy: Returns empty result
- If policy matches: Returns the data

The previous policies were either missing or incorrectly configured, causing legitimate access to be denied.

This fix applies the proven policies that were working on Nov 6, 2025.
