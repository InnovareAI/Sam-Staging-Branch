-- ============================================================================
-- SAM Campaign Automation - Scheduled Jobs
-- ============================================================================
-- Sets up pg_cron jobs to run automation functions automatically
-- Requires pg_cron extension to be enabled in Supabase
-- ============================================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing jobs if they exist (for clean reinstall)
SELECT cron.unschedule('sam-auto-retry-rate-limits');
SELECT cron.unschedule('sam-auto-cleanup-stale');
SELECT cron.unschedule('sam-auto-pause-failing');
SELECT cron.unschedule('sam-auto-resume');

-- ============================================================================
-- Job 1: Auto-retry rate limited prospects
-- Runs every 5 minutes
-- ============================================================================
SELECT cron.schedule(
  'sam-auto-retry-rate-limits',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT auto_retry_rate_limited_prospects();
  $$
);

-- ============================================================================
-- Job 2: Auto-cleanup stale queued prospects
-- Runs every 15 minutes
-- ============================================================================
SELECT cron.schedule(
  'sam-auto-cleanup-stale',
  '*/15 * * * *',  -- Every 15 minutes
  $$
  SELECT auto_cleanup_stale_executions();
  $$
);

-- ============================================================================
-- Job 3: Auto-pause failing campaigns
-- Runs every hour
-- ============================================================================
SELECT cron.schedule(
  'sam-auto-pause-failing',
  '0 * * * *',  -- Every hour at :00
  $$
  SELECT auto_pause_failing_campaigns();
  $$
);

-- ============================================================================
-- Job 4: Auto-resume campaigns after rate limits clear
-- Runs every 15 minutes
-- ============================================================================
SELECT cron.schedule(
  'sam-auto-resume',
  '*/15 * * * *',  -- Every 15 minutes
  $$
  SELECT auto_resume_after_rate_limits();
  $$
);

-- ============================================================================
-- Verify scheduled jobs
-- ============================================================================
SELECT
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname LIKE 'sam-%'
ORDER BY jobname;

-- ============================================================================
-- View job execution history
-- ============================================================================
COMMENT ON TABLE cron.job_run_details IS
  'View recent cron job executions with: SELECT * FROM cron.job_run_details WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE ''sam-%'') ORDER BY start_time DESC LIMIT 20;';

-- ============================================================================
-- Manual execution commands (for testing)
-- ============================================================================

-- Test auto-retry function
-- SELECT * FROM auto_retry_rate_limited_prospects();

-- Test auto-cleanup function
-- SELECT * FROM auto_cleanup_stale_executions();

-- Test auto-pause function
-- SELECT * FROM auto_pause_failing_campaigns();

-- Test auto-resume function
-- SELECT * FROM auto_resume_after_rate_limits();

-- Check automation health
-- SELECT * FROM get_automation_health();

-- View job execution history
-- SELECT
--   jobname,
--   runid,
--   start_time,
--   end_time,
--   status,
--   return_message
-- FROM cron.job_run_details
-- WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'sam-%')
-- ORDER BY start_time DESC
-- LIMIT 20;
