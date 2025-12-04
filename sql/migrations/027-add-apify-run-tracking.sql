-- Add apify_run_id column to track pending Apify actor runs
-- This enables async polling: start actor, check results on next cron run

ALTER TABLE linkedin_post_monitors
ADD COLUMN IF NOT EXISTS apify_run_id TEXT,
ADD COLUMN IF NOT EXISTS apify_run_started_at TIMESTAMPTZ;

COMMENT ON COLUMN linkedin_post_monitors.apify_run_id IS 'Apify actor run ID for async polling';
COMMENT ON COLUMN linkedin_post_monitors.apify_run_started_at IS 'When the Apify run was started';
