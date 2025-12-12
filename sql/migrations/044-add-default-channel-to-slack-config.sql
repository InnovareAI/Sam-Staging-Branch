-- Add default_channel column to slack_app_config
-- December 12, 2025
-- Allows workspaces to specify which channel SAM should use for notifications

ALTER TABLE slack_app_config
ADD COLUMN IF NOT EXISTS default_channel VARCHAR(50);

-- Comment explaining the column
COMMENT ON COLUMN slack_app_config.default_channel IS 'Default Slack channel ID (C0XXXXXXXXX) for notifications, daily digest, and campaign updates';
