-- Add campaign scheduling fields for auto-execution with randomized delays
-- This enables LinkedIn-safe rate limiting (2-30 minute delays between connection requests)

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS next_execution_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_execute BOOLEAN DEFAULT true;

-- Add per-account rate limiting to workspace_accounts
-- Each LinkedIn account has different messaging limits (free vs premium vs sales navigator)
ALTER TABLE workspace_accounts
ADD COLUMN IF NOT EXISTS daily_message_limit INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS messages_sent_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_message_date DATE DEFAULT CURRENT_DATE;

-- Create index for cron job performance
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled
ON campaigns(next_execution_time)
WHERE status = 'scheduled' AND next_execution_time IS NOT NULL;

-- Add comments
COMMENT ON COLUMN campaigns.next_execution_time IS 'Scheduled time for next prospect execution (2-30 minute randomized delays)';
COMMENT ON COLUMN campaigns.auto_execute IS 'Whether to automatically execute remaining prospects';
COMMENT ON COLUMN workspace_accounts.daily_message_limit IS 'Max connection requests per day (default 20 for free LinkedIn, can be increased for premium accounts)';
COMMENT ON COLUMN workspace_accounts.messages_sent_today IS 'Number of messages sent today from this account';
COMMENT ON COLUMN workspace_accounts.last_message_date IS 'Date of last message sent (used to reset daily counter)';
