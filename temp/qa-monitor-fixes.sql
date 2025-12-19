-- QA Monitor Fixes - December 19, 2025
-- Fixes for issues identified in QA Monitor Resolution Report

-- ============================================
-- FIX 1: Clean up failed queue items from archived messenger campaign
-- ============================================
-- Campaign: 281feb3b-9d07-4844-9fe0-221665f0bb92 (archived, 100% error rate)
-- Error: "Cannot POST /api/v1/messages/send" (404)
-- Resolution: Delete failed items - campaign is already archived
-- ============================================

DELETE FROM send_queue
WHERE campaign_id = '281feb3b-9d07-4844-9fe0-221665f0bb92'
AND status = 'failed';

-- Expected: Deletes 4 failed queue items


-- ============================================
-- FIX 2: Identify misconfigured email/LinkedIn campaign
-- ============================================
-- Campaign: ea13b4fe-4c0f-43d5-9efe-45a506c75445 (paused, 40% error rate)
-- Error: "Invalid account type: EMAIL. LinkedIn campaigns require a LinkedIn account."
-- Resolution: Get campaign details for manual review
-- ============================================

-- Step 1: Get campaign details
SELECT
  id,
  campaign_name,
  campaign_type,
  linkedin_account_id,
  status
FROM campaigns
WHERE id = 'ea13b4fe-4c0f-43d5-9efe-45a506c75445';

-- Step 2: Get account type
SELECT
  ua.id,
  ua.display_name,
  ua.email,
  ua.provider,
  ua.unipile_account_id
FROM user_unipile_accounts ua
WHERE ua.id = (
  SELECT linkedin_account_id
  FROM campaigns
  WHERE id = 'ea13b4fe-4c0f-43d5-9efe-45a506c75445'
);

-- Step 3a: IF this should be email-only campaign - clear linkedin_account_id
-- UNCOMMENT AFTER MANUAL CONFIRMATION:
/*
UPDATE campaigns
SET linkedin_account_id = NULL
WHERE id = 'ea13b4fe-4c0f-43d5-9efe-45a506c75445'
AND campaign_type = 'email';
*/

-- Step 3b: IF this should be LinkedIn campaign - change campaign_type
-- UNCOMMENT AFTER MANUAL CONFIRMATION AND ASSIGN LINKEDIN ACCOUNT:
/*
UPDATE campaigns
SET
  campaign_type = 'linkedin_only',
  linkedin_account_id = '<LINKEDIN_ACCOUNT_ID_HERE>'
WHERE id = 'ea13b4fe-4c0f-43d5-9efe-45a506c75445';
*/


-- ============================================
-- FIX 3: Investigate active messenger campaign with NULL recipient IDs
-- ============================================
-- Campaign: c243c82d-12fc-4b49-b5b2-c52a77708bf1 (active, 26.5% error rate)
-- Error: "Cannot POST /api/v1/messages/send" (404) - but root cause is NULL recipient_profile_id
-- Resolution: Investigate why recipient_profile_id is NULL
-- ============================================

-- Step 1: Check campaign details
SELECT
  id,
  campaign_name,
  campaign_type,
  linkedin_account_id,
  status
FROM campaigns
WHERE id = 'c243c82d-12fc-4b49-b5b2-c52a77708bf1';

-- Step 2: Find queue items with NULL recipient_profile_id
SELECT
  id,
  prospect_id,
  campaign_id,
  status,
  recipient_profile_id,
  error_message,
  created_at
FROM send_queue
WHERE campaign_id = 'c243c82d-12fc-4b49-b5b2-c52a77708bf1'
AND status = 'failed'
LIMIT 20;

-- Step 3: Check if prospects have valid LinkedIn profile IDs
SELECT
  cp.id,
  cp.first_name,
  cp.last_name,
  cp.linkedin_url,
  cp.linkedin_user_id,
  sq.recipient_profile_id,
  sq.status,
  sq.error_message
FROM campaign_prospects cp
JOIN send_queue sq ON sq.prospect_id = cp.id
WHERE sq.campaign_id = 'c243c82d-12fc-4b49-b5b2-c52a77708bf1'
AND sq.status = 'failed'
LIMIT 10;

-- Step 4: Option A - Delete failed items and pause campaign for investigation
-- UNCOMMENT AFTER MANUAL CONFIRMATION:
/*
-- Pause campaign first
UPDATE campaigns
SET status = 'paused'
WHERE id = 'c243c82d-12fc-4b49-b5b2-c52a77708bf1';

-- Delete failed queue items
DELETE FROM send_queue
WHERE campaign_id = 'c243c82d-12fc-4b49-b5b2-c52a77708bf1'
AND status = 'failed';
*/


-- ============================================
-- BONUS: Get all campaigns with high error rates
-- ============================================
-- Identify campaigns that need attention
-- ============================================

WITH campaign_stats AS (
  SELECT
    sq.campaign_id,
    c.campaign_name,
    c.campaign_type,
    c.status AS campaign_status,
    COUNT(*) AS total_queue_items,
    SUM(CASE WHEN sq.status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
    SUM(CASE WHEN sq.status = 'sent' THEN 1 ELSE 0 END) AS sent_count,
    SUM(CASE WHEN sq.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
    ROUND(
      (SUM(CASE WHEN sq.status = 'failed' THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100,
      1
    ) AS error_rate_pct
  FROM send_queue sq
  JOIN campaigns c ON c.id = sq.campaign_id
  GROUP BY sq.campaign_id, c.campaign_name, c.campaign_type, c.status
  HAVING SUM(CASE WHEN sq.status = 'failed' THEN 1 ELSE 0 END) > 5
)
SELECT
  campaign_id,
  campaign_name,
  campaign_type,
  campaign_status,
  total_queue_items,
  sent_count,
  pending_count,
  failed_count,
  error_rate_pct
FROM campaign_stats
WHERE error_rate_pct > 15
ORDER BY error_rate_pct DESC, failed_count DESC;


-- ============================================
-- BONUS: Check for email accounts assigned to LinkedIn campaigns
-- ============================================

SELECT
  c.id AS campaign_id,
  c.campaign_name,
  c.campaign_type,
  c.status,
  ua.id AS account_id,
  ua.display_name,
  ua.email,
  ua.provider
FROM campaigns c
JOIN user_unipile_accounts ua ON ua.id = c.linkedin_account_id
WHERE c.campaign_type IN ('linkedin_only', 'messenger', 'multi_channel')
  OR c.campaign_type IS NULL -- NULL defaults to LinkedIn campaign
AND ua.provider != 'LINKEDIN'
AND c.status != 'archived';


-- ============================================
-- END OF FIXES
-- ============================================
