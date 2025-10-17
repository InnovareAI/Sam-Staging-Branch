# 🚨 URGENT: Search Privacy Fix

**Date**: October 17, 2025
**Severity**: HIGH - Privacy Issue
**Status**: Fix Ready - Needs Database Migration

---

## 🔴 Problem

**Users can see each other's searches within the same workspace!**

Charissa (workspace member) can see your prospect searches because the database RLS policy allows **all workspace members** to view **all prospect approval sessions** in the workspace.

---

## 🔍 Root Cause

**File**: `supabase/migrations/20251002000000_create_prospect_approval_system.sql`

**Current RLS Policy (WRONG):**
```sql
CREATE POLICY "Users can view their workspace sessions"
    ON prospect_approval_sessions FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );
```

**Problem**: This returns ALL sessions where `workspace_id` matches, not filtering by `user_id`!

**Result**: All workspace members see each other's:
- Prospect searches
- Data approval sessions
- Campaign prospects
- "New Campaigns" tab content

---

## ✅ Solution

**New RLS Policy (CORRECT):**
```sql
CREATE POLICY "Users can view only their own sessions"
    ON prospect_approval_sessions FOR SELECT
    USING (
        user_id = auth.uid()
        AND workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );
```

**This ensures**: Users can ONLY see their own searches, even within shared workspaces.

---

## 🚀 How to Apply Fix

### Step 1: Open Supabase Dashboard

```
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
```

### Step 2: Run This SQL

```sql
-- FIX: Prospect Approval Sessions - User Privacy
-- DROP old policy
DROP POLICY IF EXISTS "Users can view their workspace sessions" ON prospect_approval_sessions;

-- CREATE new policy - users can ONLY see their OWN sessions
CREATE POLICY "Users can view only their own sessions"
    ON prospect_approval_sessions FOR SELECT
    USING (
        user_id = auth.uid()
        AND workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );
```

### Step 3: Verify Fix

After running the SQL:

**Test 1: Check Your Searches**
1. Log in as yourself
2. Go to Campaign Hub → "New Campaigns" tab
3. You should ONLY see YOUR searches

**Test 2: Check Charissa's View**
1. Have Charissa log in
2. She goes to Campaign Hub → "New Campaigns" tab
3. She should ONLY see HER searches (not yours)

---

## 🧪 Testing Commands

### Before Fix (Check Current State):
```sql
-- See all sessions in workspace (shows privacy issue)
SELECT
  id,
  campaign_name,
  user_id,
  workspace_id,
  created_at
FROM prospect_approval_sessions
WHERE workspace_id = '<your_workspace_id>'
ORDER BY created_at DESC;
```

**Expected Before Fix**: Shows ALL users' sessions

### After Fix (Verify Privacy):
```sql
-- Should only show YOUR sessions
SELECT
  id,
  campaign_name,
  user_id,
  workspace_id,
  created_at
FROM prospect_approval_sessions
WHERE workspace_id = '<your_workspace_id>'
ORDER BY created_at DESC;
```

**Expected After Fix**: Shows ONLY your sessions (filtered by RLS policy)

---

## 📊 Impact

### Before Fix:
```
Workspace: InnovareAI
  ├── User 1 (You): Searches for "CTOs in SF"
  │     ↓
  ├── User 2 (Charissa): Can see "CTOs in SF" search ❌
  │
  └── User 3: Can see ALL searches ❌
```

### After Fix:
```
Workspace: InnovareAI
  ├── User 1 (You): Searches for "CTOs in SF"
  │     ↓
  │     Sees ONLY: "CTOs in SF" (own search) ✅
  │
  ├── User 2 (Charissa): Searches for "VPs in Austin"
  │     ↓
  │     Sees ONLY: "VPs in Austin" (own search) ✅
  │
  └── User 3: Sees ONLY their own searches ✅
```

---

## ⚠️ Important Notes

1. **No Data Loss**: This only affects WHO can see sessions, not the data itself
2. **Existing Sessions**: All existing sessions remain intact
3. **Immediate Effect**: Changes apply immediately after running SQL
4. **No Code Changes**: The API code was already correct (filtering by user_id)
5. **Backward Compatible**: No application code needs to change

---

## 🔄 Alternative: Use Supabase CLI

If you prefer CLI:

```bash
# Navigate to project
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7

# Apply migration
supabase db push

# Or run migration file directly
psql $DATABASE_URL -f supabase/migrations/20251017_fix_prospect_session_privacy.sql
```

---

## 📝 Migration File

**Location**: `supabase/migrations/20251017_fix_prospect_session_privacy.sql`

**Contents**:
```sql
-- FIX: Prospect Approval Sessions - User Privacy
-- DATE: 2025-10-17
-- ISSUE: Users can see ALL workspace sessions instead of just their own
-- SOLUTION: Update RLS policy to filter by user_id

-- Drop old policy
DROP POLICY IF EXISTS "Users can view their workspace sessions" ON prospect_approval_sessions;

-- Create new policy - users can ONLY see their OWN sessions
CREATE POLICY "Users can view only their own sessions"
    ON prospect_approval_sessions FOR SELECT
    USING (
        user_id = auth.uid()
        AND workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Verify the policy change
COMMENT ON POLICY "Users can view only their own sessions" ON prospect_approval_sessions IS
'Users can only see their own prospect approval sessions. This ensures search privacy within workspaces.';
```

---

## ✅ Success Criteria

After applying the fix:

1. ✅ You log in → See ONLY your searches
2. ✅ Charissa logs in → Sees ONLY her searches
3. ✅ No cross-user visibility
4. ✅ "New Campaigns" tab shows correct counts
5. ✅ Data Approval panel shows correct prospects

---

## 🆘 If Issues Occur

### Problem: Searches disappear after fix
**Solution**: They're not gone, just filtered. Each user now sees only their own.

### Problem: "New Campaigns" count is wrong
**Solution**: Refresh the page. React Query cache may show old data.

### Problem: RLS policy error
**Solution**: Check that the old policy name matches:
```sql
SELECT policyname FROM pg_policies
WHERE tablename = 'prospect_approval_sessions';
```

---

## 🎯 Ready to Apply?

**Run the SQL in Supabase Dashboard SQL Editor now!**

File: `supabase/migrations/20251017_fix_prospect_session_privacy.sql`

---

**Priority**: 🔴 HIGH - Apply ASAP to protect user privacy
