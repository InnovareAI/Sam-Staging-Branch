-- Add campaign scheduling fields for auto-execution with randomized delays
-- This enables LinkedIn-safe rate limiting (30-90 minute delays between connection requests)

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS next_execution_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_execute BOOLEAN DEFAULT true;

-- Create index for cron job performance
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled
ON campaigns(next_execution_time)
WHERE status = 'scheduled' AND next_execution_time IS NOT NULL;

-- Add comment
COMMENT ON COLUMN campaigns.next_execution_time IS 'Scheduled time for next prospect execution (30-90 minute randomized delays)';
COMMENT ON COLUMN campaigns.auto_execute IS 'Whether to automatically execute remaining prospects';
