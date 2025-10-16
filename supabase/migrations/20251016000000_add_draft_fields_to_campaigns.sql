-- Add draft/autosave fields to campaigns table
-- This enables progressive saving during campaign creation

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS connection_message TEXT,
ADD COLUMN IF NOT EXISTS alternative_message TEXT,
ADD COLUMN IF NOT EXISTS follow_up_messages JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS draft_data JSONB DEFAULT '{}'::jsonb;

-- Add index for filtering draft campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_status_workspace ON campaigns(status, workspace_id);

-- Add comments for documentation
COMMENT ON COLUMN campaigns.current_step IS 'Current step in campaign creation process (1-3)';
COMMENT ON COLUMN campaigns.connection_message IS 'Primary connection request message template';
COMMENT ON COLUMN campaigns.alternative_message IS 'Alternative message if connection exists';
COMMENT ON COLUMN campaigns.follow_up_messages IS 'Array of follow-up message templates';
COMMENT ON COLUMN campaigns.draft_data IS 'Additional draft data (CSV data, temporary settings, etc.)';
