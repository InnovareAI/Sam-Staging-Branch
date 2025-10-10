-- Add campaign name and tag fields to prospect_approval_sessions
-- This enables better organization and filtering of prospect batches

ALTER TABLE prospect_approval_sessions
ADD COLUMN IF NOT EXISTS campaign_name TEXT,
ADD COLUMN IF NOT EXISTS campaign_tag TEXT;

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_prospect_approval_sessions_campaign_name
  ON prospect_approval_sessions(campaign_name);

CREATE INDEX IF NOT EXISTS idx_prospect_approval_sessions_campaign_tag
  ON prospect_approval_sessions(campaign_tag);

-- Add comment explaining the fields
COMMENT ON COLUMN prospect_approval_sessions.campaign_name IS 'Primary campaign identifier (e.g., "20251011-IFC-Q4 Outreach")';
COMMENT ON COLUMN prospect_approval_sessions.campaign_tag IS 'Secondary tag for A/B testing or segmentation (e.g., "Industry-FinTech", "Region-West")';
