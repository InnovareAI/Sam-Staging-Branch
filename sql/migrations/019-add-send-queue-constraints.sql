-- Migration: Add constraints to send_queue table to prevent duplicates and enforce data integrity
-- Date: November 24, 2025
-- Purpose: Prevent users from creating duplicate queue records by clicking send multiple times

-- 1. Add unique constraint on (campaign_id, prospect_id)
-- This ensures each prospect can only have ONE queue record per campaign
ALTER TABLE send_queue
ADD CONSTRAINT send_queue_campaign_prospect_unique
UNIQUE (campaign_id, prospect_id);

-- 2. Add index for faster queue processing queries
CREATE INDEX IF NOT EXISTS idx_send_queue_status_scheduled 
ON send_queue(status, scheduled_for) 
WHERE status = 'pending';

-- 3. Add index for campaign-specific queries
CREATE INDEX IF NOT EXISTS idx_send_queue_campaign_status 
ON send_queue(campaign_id, status);

-- Verification query
SELECT 
  'send_queue constraints' as table_name,
  COUNT(DISTINCT constraint_name) as constraints_added,
  COUNT(DISTINCT indexname) as indexes_added
FROM (
  SELECT constraint_name FROM information_schema.table_constraints 
  WHERE table_name = 'send_queue' AND constraint_type = 'UNIQUE'
  UNION ALL
  SELECT indexname as constraint_name FROM pg_indexes 
  WHERE tablename = 'send_queue'
) combined;
