# Fix Duplicate LinkedIn Posts - IMMEDIATE ACTION REQUIRED

**Date**: November 24, 2025
**Issue**: Posts from LinkedIn showing up multiple times in UI
**Root Cause**: Migration `012-prevent-duplicate-posts.sql` not yet applied to production Supabase
**Status**: 🚨 CRITICAL - User confirmed duplicates visible in UI

---

## 🎯 Quick Fix (5 Minutes)

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
2. Click "SQL Editor" in left sidebar
3. Click "New query"

### Step 2: Check for Existing Duplicates
Copy and paste this query to see how many duplicates exist:

```sql
-- Count duplicates by URL
SELECT
  share_url,
  workspace_id,
  COUNT(*) as duplicate_count
FROM linkedin_posts_discovered
GROUP BY share_url, workspace_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Count duplicates by social_id
SELECT
  social_id,
  workspace_id,
  COUNT(*) as duplicate_count
FROM linkedin_posts_discovered
WHERE social_id IS NOT NULL
GROUP BY social_id, workspace_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;
```

### Step 3: Clean Up Duplicates
**WARNING**: This will delete duplicate posts. Make sure you reviewed Step 2 results first!

```sql
-- Delete duplicates (keeps the oldest post for each URL)
DELETE FROM linkedin_posts_discovered
WHERE id NOT IN (
  SELECT MIN(id)
  FROM linkedin_posts_discovered
  GROUP BY share_url, workspace_id
);
```

### Step 4: Apply Prevention Migration
Copy the ENTIRE contents of `sql/migrations/012-prevent-duplicate-posts.sql` and run it:

```sql
-- Drop existing indexes if they exist
DROP INDEX IF EXISTS linkedin_posts_discovered_share_url_workspace_idx;
DROP INDEX IF EXISTS linkedin_posts_discovered_social_id_workspace_idx;

-- Add unique index on share_url per workspace
CREATE UNIQUE INDEX linkedin_posts_discovered_share_url_workspace_idx
ON linkedin_posts_discovered (share_url, workspace_id);

-- Add unique index on social_id per workspace
CREATE UNIQUE INDEX linkedin_posts_discovered_social_id_workspace_idx
ON linkedin_posts_discovered (social_id, workspace_id)
WHERE social_id IS NOT NULL;

-- Add check constraint
ALTER TABLE linkedin_posts_discovered
ADD CONSTRAINT linkedin_posts_discovered_identifier_check
CHECK (
  share_url IS NOT NULL OR social_id IS NOT NULL
);

-- Create index for faster duplicate checks
CREATE INDEX IF NOT EXISTS linkedin_posts_discovered_monitor_url_idx
ON linkedin_posts_discovered (monitor_id, share_url);
```

### Step 5: Verify Fix
Run this to confirm no duplicates remain:

```sql
SELECT
  'Duplicates by URL' as check_type,
  COUNT(*) as remaining_duplicates
FROM (
  SELECT share_url, workspace_id, COUNT(*) as cnt
  FROM linkedin_posts_discovered
  GROUP BY share_url, workspace_id
  HAVING COUNT(*) > 1
) sub

UNION ALL

SELECT
  'Duplicates by social_id' as check_type,
  COUNT(*) as remaining_duplicates
FROM (
  SELECT social_id, workspace_id, COUNT(*) as cnt
  FROM linkedin_posts_discovered
  WHERE social_id IS NOT NULL
  GROUP BY social_id, workspace_id
  HAVING COUNT(*) > 1
) sub;
```

**Expected Result**: Both counts should be `0`

---

## ✅ Verification

After applying the fix:

1. **Refresh the UI** - Posts should now appear only once
2. **Test discovery** - Run post discovery again, verify no new duplicates
3. **Check logs** - Should see: `⚠️ Some posts already exist (duplicate prevented by database constraint)`

---

## 🔍 Technical Details

**How Duplicates Occurred:**
- Post discovery API calls Unipile multiple times
- Same posts fetched in different API calls
- No database constraints prevented duplicate inserts
- Application-level duplicate checking wasn't sufficient

**How Fix Works:**
- **Layer 1**: Application checks for existing posts (already in code)
- **Layer 2**: Database unique constraints (prevents duplicates at DB level)
- **Layer 3**: Graceful error handling (catches duplicate attempts, logs warning)

**Files Involved:**
- Migration: `sql/migrations/012-prevent-duplicate-posts.sql`
- Cleanup: `scripts/cleanup-duplicate-posts.sql`
- API: `app/api/linkedin-commenting/discover-posts-apify/route.ts` (lines 205-226)
- Docs: `docs/DUPLICATE_POST_PREVENTION.md`

---

## 🚨 If Migration Fails

**Error: "duplicate key value violates unique constraint"**
- This means duplicates still exist
- Go back to Step 3 and run cleanup queries again
- Then retry Step 4

**Error: "constraint already exists"**
- Migration already partially applied
- Safe to continue - constraint is idempotent

**Error: "column does not exist"**
- Check table name is correct: `linkedin_posts_discovered`
- Verify workspace_id column exists

---

## 📊 Expected Outcome

**Before Fix:**
```
Post A - ID: 123
Post A - ID: 456  ← Duplicate
Post B - ID: 789
Post B - ID: 101  ← Duplicate
```

**After Fix:**
```
Post A - ID: 123
Post B - ID: 789
(Duplicates prevented by unique constraint)
```

---

## ⏱️ Estimated Time: 5 minutes

1. Check duplicates (30 seconds)
2. Clean up duplicates (1 minute)
3. Apply migration (2 minutes)
4. Verify fix (1 minute)
5. Test in UI (30 seconds)

---

**Status After Fix**: ✅ Duplicates removed, prevention enabled, UI clean
