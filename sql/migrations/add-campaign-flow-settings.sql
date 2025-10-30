-- Add flow_settings column to campaigns table for data-driven N8N workflow
-- Date: October 30, 2025
-- Supports: LinkedIn Connection Requests, LinkedIn DMs (1st degree), Email campaigns

-- Add campaign_type enum
DO $$ BEGIN
  CREATE TYPE campaign_type AS ENUM (
    'linkedin_connection',  -- Send connection request first
    'linkedin_dm',          -- Direct message to 1st degree connections
    'email'                 -- Email campaigns
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add flow_settings column with default structure
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS flow_settings JSONB DEFAULT '{
  "campaign_type": "linkedin_connection",
  "connection_wait_hours": 36,
  "followup_wait_days": 5,
  "message_wait_days": 5,
  "messages": {
    "connection_request": null,
    "follow_up_1": null,
    "follow_up_2": null,
    "follow_up_3": null,
    "follow_up_4": null,
    "follow_up_5": null,
    "follow_up_6": null,
    "goodbye": null,
    "message_1": null,
    "message_2": null,
    "message_3": null,
    "message_4": null,
    "message_5": null,
    "message_6": null,
    "message_7": null,
    "message_8": null,
    "message_9": null,
    "message_10": null
  }
}'::jsonb;

-- Add metadata column for A/B testing and grouping
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for querying by A/B test group
CREATE INDEX IF NOT EXISTS idx_campaigns_metadata_ab_test
ON campaigns USING GIN ((metadata->'ab_test_group'));

-- Comment explaining the structure
COMMENT ON COLUMN campaigns.flow_settings IS 'Dynamic flow configuration: connection_wait_hours (12-96), followup_wait_days (1-30), and messages object with up to 6 follow-ups plus goodbye';

COMMENT ON COLUMN campaigns.metadata IS 'Campaign metadata including ab_test_group and variant for A/B testing';
