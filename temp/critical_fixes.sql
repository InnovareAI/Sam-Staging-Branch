-- ============================================
-- SAM AI DATABASE CRITICAL FIXES
-- Generated: November 25, 2025
-- ============================================
-- IMPORTANT: Review each fix before executing
-- Test in staging environment first if possible
-- ============================================

BEGIN;

-- ============================================
-- P0-2: Delete Duplicate Prospects (12 records)
-- ============================================
-- Campaign 9fcfcab0-7007-4628-b49b-1636ba5f781f has same prospect 20 times
-- This fix keeps the one with best status, deletes the rest

WITH ranked_duplicates AS (
  SELECT
    id,
    campaign_id,
    linkedin_user_id,
    status,
    ROW_NUMBER() OVER (
      PARTITION BY campaign_id, linkedin_user_id
      ORDER BY CASE
        WHEN status IN ('connected', 'connection_request_sent') THEN 1
        WHEN status IN ('replied', 'messaging') THEN 2
        WHEN status = 'contacted' THEN 3
        ELSE 4
      END,
      created_at ASC
    ) as rn
  FROM campaign_prospects
  WHERE linkedin_user_id IS NOT NULL
)
DELETE FROM campaign_prospects
WHERE id IN (
  SELECT id FROM ranked_duplicates WHERE rn > 1
);
-- Expected: DELETE 12 rows (keeps 1 of each duplicate set)

-- ============================================
-- P1-4: Delete Orphaned Workspace Member (1 record)
-- ============================================
-- This member references a user_id that doesn't exist

DELETE FROM workspace_members
WHERE id IN (
  SELECT wm.id
  FROM workspace_members wm
  WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = wm.user_id
  )
);
-- Expected: DELETE 1 row

-- ============================================
-- P1-6: Assign Default Tier to Workspaces (9 workspaces)
-- ============================================
-- Workspaces without tiers cannot enforce feature limits or bill customers

INSERT INTO workspace_tiers (
  workspace_id,
  tier_name,
  features,
  created_at,
  updated_at
)
SELECT
  w.id as workspace_id,
  'startup' as tier_name,
  '{
    "max_campaigns": 5,
    "max_prospects_per_campaign": 100,
    "linkedin_accounts": 1,
    "email_accounts": 1,
    "ai_credits_per_month": 1000
  }'::jsonb as features,
  NOW() as created_at,
  NOW() as updated_at
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_tiers wt WHERE wt.workspace_id = w.id
);
-- Expected: INSERT 9 rows

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify no duplicates remain
SELECT
  campaign_id,
  linkedin_user_id,
  COUNT(*) as count
FROM campaign_prospects
WHERE linkedin_user_id IS NOT NULL
GROUP BY campaign_id, linkedin_user_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- Verify no orphaned workspace members
SELECT COUNT(*)
FROM workspace_members wm
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE u.id = wm.user_id
);
-- Expected: 0 rows

-- Verify all workspaces have tiers
SELECT COUNT(*)
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_tiers wt WHERE wt.workspace_id = w.id
);
-- Expected: 0 rows

-- ============================================
-- NOTES
-- ============================================
-- 1. P0-1 (138 missing linkedin_user_id) requires script, not SQL
-- 2. P0-3 (stuck queue) requires cron investigation, not SQL
-- 3. P1-8 (workspace_id type change) is risky - test in staging first
-- 4. Run verification queries after executing fixes
