-- Fix stale prospects (>3 days pending)
-- Run this in Supabase SQL Editor

UPDATE campaign_prospects
SET
  status = 'failed',
  notes = COALESCE(notes || ' | ', '') || 'Auto-failed: stale >3 days',
  updated_at = NOW()
WHERE
  status = 'pending'
  AND updated_at < NOW() - INTERVAL '3 days';

-- Show count of fixed prospects
SELECT COUNT(*) as fixed_count
FROM campaign_prospects
WHERE
  status = 'failed'
  AND notes LIKE '%Auto-failed: stale >3 days%'
  AND updated_at > NOW() - INTERVAL '5 minutes';
