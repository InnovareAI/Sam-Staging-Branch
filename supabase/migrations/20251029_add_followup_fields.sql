-- Add follow-up tracking fields to campaign_prospects table
-- Run this in Supabase SQL Editor

ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS connection_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS follow_up_due_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS follow_up_sequence_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMPTZ;

-- Create index for efficient follow-up queries
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_follow_up_due
ON campaign_prospects(status, follow_up_due_at)
WHERE status = 'connected';

-- Add new statuses to check constraint if it exists
-- (Skip if no check constraint exists)
-- ALTER TABLE campaign_prospects DROP CONSTRAINT IF EXISTS campaign_prospects_status_check;

COMMENT ON COLUMN campaign_prospects.connection_accepted_at IS 'Timestamp when LinkedIn connection was accepted';
COMMENT ON COLUMN campaign_prospects.follow_up_due_at IS 'Timestamp when next follow-up message is due';
COMMENT ON COLUMN campaign_prospects.follow_up_sequence_index IS 'Index of next follow-up message to send (0 = first)';
COMMENT ON COLUMN campaign_prospects.last_follow_up_at IS 'Timestamp of last follow-up message sent';

-- Update RLS policies if needed (prospect data still belongs to workspace)
-- No changes needed - existing RLS policies cover these new fields
