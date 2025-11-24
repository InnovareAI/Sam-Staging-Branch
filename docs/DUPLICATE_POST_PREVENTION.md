# Duplicate Post Prevention

**Date**: November 24, 2025
**Status**: Ready to deploy

## Problem

The LinkedIn post discovery system could potentially store the same post multiple times if:
- The endpoint is called multiple times in quick succession
- Network issues cause retries
- Multiple monitors track the same profile
- A post URL or social_id changes

## Solution

Implemented three layers of duplicate prevention:

### Layer 1: Application-Level Check (Already Exists)
- Before inserting, query for existing posts by URL and social_id
- Filter out any posts that already exist
- Located in: `/app/api/linkedin-commenting/discover-posts-apify/route.ts` (lines 159-179)

### Layer 2: Database Unique Constraints (NEW)
- Unique index on `(share_url, workspace_id)` - prevents same URL twice per workspace
- Unique index on `(social_id, workspace_id)` - prevents same social_id twice per workspace
- Check constraint - ensures at least one identifier (URL or social_id) exists

### Layer 3: Graceful Error Handling (NEW)
- Catches duplicate key errors (PostgreSQL error code `23505`)
- Logs warning instead of failing
- Continues processing remaining posts
- Located in: `/app/api/linkedin-commenting/discover-posts-apify/route.ts` (lines 205-226)

## Migration Instructions

### 1. Run the SQL Migration

Open Supabase SQL Editor and run:

```sql
-- File: sql/migrations/012-prevent-duplicate-posts.sql

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

### 2. Verify Migration

Check that indexes were created:

```sql
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'linkedin_posts_discovered'
ORDER BY indexname;
```

Expected output should include:
- `linkedin_posts_discovered_share_url_workspace_idx`
- `linkedin_posts_discovered_social_id_workspace_idx`
- `linkedin_posts_discovered_monitor_url_idx`

### 3. Clean Up Existing Duplicates (Optional)

If you have existing duplicates, clean them up first:

```sql
-- Find duplicates by URL
SELECT share_url, workspace_id, COUNT(*)
FROM linkedin_posts_discovered
GROUP BY share_url, workspace_id
HAVING COUNT(*) > 1;

-- Keep only the oldest post for each duplicate URL
DELETE FROM linkedin_posts_discovered
WHERE id NOT IN (
  SELECT MIN(id)
  FROM linkedin_posts_discovered
  GROUP BY share_url, workspace_id
);

-- Find duplicates by social_id
SELECT social_id, workspace_id, COUNT(*)
FROM linkedin_posts_discovered
WHERE social_id IS NOT NULL
GROUP BY social_id, workspace_id
HAVING COUNT(*) > 1;

-- Keep only the oldest post for each duplicate social_id
DELETE FROM linkedin_posts_discovered
WHERE id NOT IN (
  SELECT MIN(id)
  FROM linkedin_posts_discovered
  WHERE social_id IS NOT NULL
  GROUP BY social_id, workspace_id
);
```

### 4. Deploy Updated Code

The code changes are already in place:
- Enhanced duplicate checking (lines 159-179)
- Graceful error handling (lines 205-226)

No deployment needed if code is already on main branch.

## Testing

### Test 1: Verify Duplicate Prevention

```bash
# Run discovery twice in quick succession
curl -X POST http://localhost:3000/api/linkedin-commenting/discover-posts-apify

# Wait 2 seconds
sleep 2

# Run again
curl -X POST http://localhost:3000/api/linkedin-commenting/discover-posts-apify
```

Expected: Second run should report "0 new posts discovered" (all already exist)

### Test 2: Check Database Counts

```sql
-- Before first run
SELECT COUNT(*) FROM linkedin_posts_discovered;

-- After first run (should increase)
SELECT COUNT(*) FROM linkedin_posts_discovered;

-- After second run (should stay the same)
SELECT COUNT(*) FROM linkedin_posts_discovered;
```

### Test 3: Verify Error Handling

Try to manually insert a duplicate:

```sql
-- This should fail with unique constraint violation
INSERT INTO linkedin_posts_discovered (
  workspace_id,
  monitor_id,
  share_url,
  social_id,
  post_content,
  author_name,
  author_profile_id,
  post_date,
  status
)
SELECT
  workspace_id,
  monitor_id,
  share_url,
  social_id,
  post_content,
  author_name,
  author_profile_id,
  post_date,
  status
FROM linkedin_posts_discovered
LIMIT 1;
```

Expected error: `duplicate key value violates unique constraint`

## Monitoring

### Check for Duplicate Attempts

Look for these log messages in Netlify logs:

```
⚠️ Some posts already exist (duplicate prevented by database constraint)
✅ Stored X new posts (duplicates skipped)
```

### Verify No Duplicates

Run this query periodically:

```sql
-- Check for duplicate URLs
SELECT share_url, workspace_id, COUNT(*)
FROM linkedin_posts_discovered
GROUP BY share_url, workspace_id
HAVING COUNT(*) > 1;

-- Check for duplicate social_ids
SELECT social_id, workspace_id, COUNT(*)
FROM linkedin_posts_discovered
WHERE social_id IS NOT NULL
GROUP BY social_id, workspace_id
HAVING COUNT(*) > 1;
```

Both queries should return 0 rows.

## Rollback Plan

If issues occur, drop the constraints:

```sql
-- Remove unique indexes
DROP INDEX linkedin_posts_discovered_share_url_workspace_idx;
DROP INDEX linkedin_posts_discovered_social_id_workspace_idx;

-- Remove check constraint
ALTER TABLE linkedin_posts_discovered
DROP CONSTRAINT linkedin_posts_discovered_identifier_check;

-- Keep the non-unique index (it's helpful for performance)
-- CREATE INDEX IF NOT EXISTS linkedin_posts_discovered_monitor_url_idx
-- ON linkedin_posts_discovered (monitor_id, share_url);
```

## Impact

### Performance
- **Positive**: Faster duplicate checks with indexes
- **Minimal**: Unique constraint checking adds ~1ms per insert
- **Positive**: Prevents wasted storage from duplicates

### Data Integrity
- **Positive**: Guarantees no duplicate posts
- **Positive**: Multi-tenant safe (uniqueness per workspace)
- **Positive**: Handles both URL and social_id changes

### Error Handling
- **Positive**: Graceful degradation on duplicate attempts
- **Positive**: Continues processing other posts
- **Positive**: Clear log messages for monitoring

## Files Changed

1. `/sql/migrations/012-prevent-duplicate-posts.sql` - Database migration (NEW)
2. `/app/api/linkedin-commenting/discover-posts-apify/route.ts` - Enhanced duplicate checking and error handling
3. `/docs/DUPLICATE_POST_PREVENTION.md` - This documentation (NEW)

## Status

- ✅ Code changes complete
- ⏳ Migration ready to apply
- ⏳ Needs testing in Supabase
- ⏳ Needs deployment verification

## Next Steps

1. Apply migration in Supabase SQL Editor
2. Clean up any existing duplicates (optional)
3. Test discovery endpoint runs correctly
4. Monitor logs for duplicate prevention warnings
5. Verify no duplicates with SQL queries
