-- Diagnose Failed Queue Items
-- Run this in Supabase SQL Editor to understand why messages failed
-- Date: December 4, 2025

-- 1. Count failed messages by error type
SELECT
  error_message,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM send_queue
WHERE status = 'failed'
GROUP BY error_message
ORDER BY count DESC;

-- 2. Recent failed messages with details
SELECT
  sq.id,
  sq.campaign_id,
  c.campaign_name,
  sq.prospect_id,
  cp.first_name,
  cp.last_name,
  cp.linkedin_url,
  sq.error_message,
  sq.scheduled_for,
  sq.created_at,
  sq.updated_at
FROM send_queue sq
JOIN campaigns c ON c.id = sq.campaign_id
JOIN campaign_prospects cp ON cp.id = sq.prospect_id
WHERE sq.status = 'failed'
ORDER BY sq.updated_at DESC
LIMIT 20;

-- 3. Failed prospects by status
SELECT
  cp.status,
  COUNT(*) as count
FROM campaign_prospects cp
WHERE cp.status IN ('failed', 'invitation_declined', 'rate_limited')
GROUP BY cp.status
ORDER BY count DESC;

-- 4. Campaigns with highest failure rates
SELECT
  c.campaign_name,
  COUNT(CASE WHEN sq.status = 'sent' THEN 1 END) as sent,
  COUNT(CASE WHEN sq.status = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN sq.status = 'skipped' THEN 1 END) as skipped,
  ROUND(COUNT(CASE WHEN sq.status = 'failed' THEN 1 END) * 100.0 /
    NULLIF(COUNT(*), 0), 2) as failure_rate_pct
FROM campaigns c
LEFT JOIN send_queue sq ON sq.campaign_id = c.id
GROUP BY c.id, c.campaign_name
HAVING COUNT(*) > 0
ORDER BY failure_rate_pct DESC;

-- 5. Daily send volume by LinkedIn account (check for daily cap issues)
SELECT
  wa.account_name,
  DATE(sq.sent_at) as send_date,
  COUNT(*) as messages_sent,
  CASE
    WHEN COUNT(*) >= 40 THEN '🔴 AT CAP (40/day)'
    WHEN COUNT(*) >= 30 THEN '⚠️ NEAR CAP'
    ELSE '✅ OK'
  END as status
FROM send_queue sq
JOIN campaigns c ON c.id = sq.campaign_id
JOIN workspace_accounts wa ON wa.id = c.linkedin_account_id
WHERE sq.status = 'sent'
  AND sq.sent_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY wa.account_name, DATE(sq.sent_at)
ORDER BY send_date DESC, messages_sent DESC;

-- 6. Withdrawn invitation errors (3-4 week LinkedIn cooldown)
SELECT
  sq.error_message,
  cp.first_name,
  cp.last_name,
  cp.linkedin_url,
  sq.updated_at
FROM send_queue sq
JOIN campaign_prospects cp ON cp.id = sq.prospect_id
WHERE sq.status = 'failed'
  AND (
    sq.error_message ILIKE '%withdrawn%'
    OR sq.error_message ILIKE '%should delay%'
    OR sq.error_message ILIKE '%already_invited_recently%'
  )
ORDER BY sq.updated_at DESC
LIMIT 20;

-- 7. Rate limit errors
SELECT
  sq.error_message,
  COUNT(*) as count,
  MIN(sq.updated_at) as first_occurrence,
  MAX(sq.updated_at) as last_occurrence
FROM send_queue sq
WHERE sq.status = 'failed'
  AND (
    sq.error_message ILIKE '%rate%'
    OR sq.error_message ILIKE '%limit%'
    OR sq.error_message ILIKE '%throttle%'
  )
GROUP BY sq.error_message
ORDER BY count DESC;

-- 8. Overall system health summary
SELECT
  'Total Queue Items' as metric,
  COUNT(*) as value
FROM send_queue
UNION ALL
SELECT
  'Sent Successfully' as metric,
  COUNT(*) as value
FROM send_queue
WHERE status = 'sent'
UNION ALL
SELECT
  'Failed' as metric,
  COUNT(*) as value
FROM send_queue
WHERE status = 'failed'
UNION ALL
SELECT
  'Skipped' as metric,
  COUNT(*) as value
FROM send_queue
WHERE status = 'skipped'
UNION ALL
SELECT
  'Pending' as metric,
  COUNT(*) as value
FROM send_queue
WHERE status = 'pending'
UNION ALL
SELECT
  'Success Rate %' as metric,
  ROUND(
    COUNT(CASE WHEN status = 'sent' THEN 1 END) * 100.0 /
    NULLIF(COUNT(CASE WHEN status IN ('sent', 'failed') THEN 1 END), 0),
    2
  ) as value
FROM send_queue;
