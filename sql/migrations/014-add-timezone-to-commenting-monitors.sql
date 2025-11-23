-- Migration: Add timezone, daily_start_time, and auto-approval to LinkedIn Commenting Monitors
-- Date: November 23, 2025
-- Purpose: Enable users to control when daily commenting begins and auto-approve comments during active hours

ALTER TABLE linkedin_post_monitors
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS daily_start_time TIME DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS auto_approve_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_approve_start_time TIME DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS auto_approve_end_time TIME DEFAULT '17:00:00';

COMMENT ON COLUMN linkedin_post_monitors.timezone IS 'IANA timezone identifier (e.g., America/New_York, Europe/London)';
COMMENT ON COLUMN linkedin_post_monitors.daily_start_time IS 'Time when daily commenting should begin (local to timezone)';
COMMENT ON COLUMN linkedin_post_monitors.auto_approve_enabled IS 'Whether to auto-approve comments generated during the approval window';
COMMENT ON COLUMN linkedin_post_monitors.auto_approve_start_time IS 'Start of auto-approval window (local to timezone)';
COMMENT ON COLUMN linkedin_post_monitors.auto_approve_end_time IS 'End of auto-approval window (local to timezone)';

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
