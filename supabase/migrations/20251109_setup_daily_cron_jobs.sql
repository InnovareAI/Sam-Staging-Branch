-- ============================================================================
-- SUPABASE pg_cron SETUP - Daily Automated Health Checks
-- ============================================================================
-- Purpose: Database-level automated monitoring and maintenance
-- Schedule: Multiple jobs running at different times
-- Redundancy: Complements GitHub Actions workflow
-- ============================================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- JOB 1: Daily RLS Policy Verification (6:00 AM UTC)
-- ============================================================================
-- Checks that RLS is enabled/disabled on correct tables
-- Logs issues to a monitoring table

-- Create monitoring table for cron job results
CREATE TABLE IF NOT EXISTS public.cron_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  run_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL, -- 'success', 'warning', 'error'
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on monitoring table
ALTER TABLE public.cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Service role can manage logs
CREATE POLICY "Service role full access on cron_job_logs"
ON public.cron_job_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create the RLS verification function
CREATE OR REPLACE FUNCTION verify_rls_status_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expected_enabled TEXT[] := ARRAY[
    'workspaces',
    'workspace_members',
    'campaigns',
    'campaign_prospects',
    'prospect_approval_sessions'
  ];
  v_expected_disabled TEXT[] := ARRAY[
    'workspace_accounts',
    'linkedin_proxy_assignments',
    'user_unipile_accounts'
  ];
  v_table_name TEXT;
  v_rls_enabled BOOLEAN;
  v_issues JSONB := '[]'::jsonb;
  v_status TEXT := 'success';
BEGIN
  -- Check tables that should have RLS enabled
  FOREACH v_table_name IN ARRAY v_expected_enabled
  LOOP
    SELECT rowsecurity INTO v_rls_enabled
    FROM pg_tables
    WHERE tablename = v_table_name;

    IF NOT COALESCE(v_rls_enabled, false) THEN
      v_status := 'error';
      v_issues := v_issues || jsonb_build_object(
        'table', v_table_name,
        'issue', 'RLS should be ENABLED but is DISABLED'
      );
    END IF;
  END LOOP;

  -- Check tables that should have RLS disabled
  FOREACH v_table_name IN ARRAY v_expected_disabled
  LOOP
    SELECT rowsecurity INTO v_rls_enabled
    FROM pg_tables
    WHERE tablename = v_table_name;

    IF COALESCE(v_rls_enabled, false) THEN
      v_status := 'warning';
      v_issues := v_issues || jsonb_build_object(
        'table', v_table_name,
        'issue', 'RLS should be DISABLED but is ENABLED'
      );
    END IF;
  END LOOP;

  -- Log the results
  INSERT INTO public.cron_job_logs (job_name, status, details)
  VALUES (
    'verify_rls_status',
    v_status,
    jsonb_build_object(
      'issues_found', jsonb_array_length(v_issues),
      'issues', v_issues
    )
  );
END;
$$;

-- Schedule: Run daily at 6:00 AM UTC
SELECT cron.schedule(
  'daily-rls-verification',
  '0 6 * * *',
  'SELECT verify_rls_status_daily();'
);

-- ============================================================================
-- JOB 2: Orphaned Data Cleanup Check (6:15 AM UTC)
-- ============================================================================
-- Checks for orphaned campaigns, prospects, sessions
-- Logs issues but doesn't auto-delete (safety)

CREATE OR REPLACE FUNCTION check_orphaned_data_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orphaned_campaigns INTEGER;
  v_orphaned_prospects INTEGER;
  v_orphaned_sessions INTEGER;
  v_status TEXT := 'success';
BEGIN
  -- Count orphaned campaigns
  SELECT COUNT(*) INTO v_orphaned_campaigns
  FROM campaigns
  WHERE workspace_id IS NULL;

  -- Count orphaned prospects
  SELECT COUNT(*) INTO v_orphaned_prospects
  FROM campaign_prospects
  WHERE campaign_id NOT IN (SELECT id FROM campaigns);

  -- Count orphaned approval sessions
  SELECT COUNT(*) INTO v_orphaned_sessions
  FROM prospect_approval_sessions
  WHERE workspace_id IS NULL;

  -- Set status
  IF v_orphaned_campaigns > 0 OR v_orphaned_prospects > 0 OR v_orphaned_sessions > 0 THEN
    v_status := 'warning';
  END IF;

  -- Log results
  INSERT INTO public.cron_job_logs (job_name, status, details)
  VALUES (
    'check_orphaned_data',
    v_status,
    jsonb_build_object(
      'orphaned_campaigns', v_orphaned_campaigns,
      'orphaned_prospects', v_orphaned_prospects,
      'orphaned_sessions', v_orphaned_sessions
    )
  );
END;
$$;

-- Schedule: Run daily at 6:15 AM UTC
SELECT cron.schedule(
  'daily-orphaned-data-check',
  '15 6 * * *',
  'SELECT check_orphaned_data_daily();'
);

-- ============================================================================
-- JOB 3: Workspace Health Check (6:30 AM UTC)
-- ============================================================================
-- Checks workspace integrity, missing owners, etc.

CREATE OR REPLACE FUNCTION check_workspace_health_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspaces_without_owners INTEGER;
  v_workspaces_without_members INTEGER;
  v_status TEXT := 'success';
BEGIN
  -- Count workspaces without owners
  SELECT COUNT(*) INTO v_workspaces_without_owners
  FROM workspaces w
  WHERE NOT EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = w.id
      AND wm.role = 'owner'
      AND wm.status = 'active'
  );

  -- Count workspaces without any members
  SELECT COUNT(*) INTO v_workspaces_without_members
  FROM workspaces w
  WHERE NOT EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = w.id
      AND wm.status = 'active'
  );

  -- Set status
  IF v_workspaces_without_owners > 0 OR v_workspaces_without_members > 0 THEN
    v_status := 'warning';
  END IF;

  -- Log results
  INSERT INTO public.cron_job_logs (job_name, status, details)
  VALUES (
    'check_workspace_health',
    v_status,
    jsonb_build_object(
      'workspaces_without_owners', v_workspaces_without_owners,
      'workspaces_without_members', v_workspaces_without_members
    )
  );
END;
$$;

-- Schedule: Run daily at 6:30 AM UTC
SELECT cron.schedule(
  'daily-workspace-health-check',
  '30 6 * * *',
  'SELECT check_workspace_health_daily();'
);

-- ============================================================================
-- JOB 4: Integration Health Check (6:45 AM UTC)
-- ============================================================================
-- Checks LinkedIn/Unipile account status

CREATE OR REPLACE FUNCTION check_integration_health_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_accounts INTEGER;
  v_active_accounts INTEGER;
  v_inactive_accounts INTEGER;
  v_status TEXT := 'success';
BEGIN
  -- Count workspace accounts
  SELECT
    COUNT(*) INTO v_total_accounts
  FROM workspace_accounts;

  SELECT
    COUNT(*) FILTER (WHERE is_active = true) INTO v_active_accounts
  FROM workspace_accounts;

  v_inactive_accounts := v_total_accounts - v_active_accounts;

  -- Log results
  INSERT INTO public.cron_job_logs (job_name, status, details)
  VALUES (
    'check_integration_health',
    v_status,
    jsonb_build_object(
      'total_accounts', v_total_accounts,
      'active_accounts', v_active_accounts,
      'inactive_accounts', v_inactive_accounts
    )
  );
END;
$$;

-- Schedule: Run daily at 6:45 AM UTC
SELECT cron.schedule(
  'daily-integration-health-check',
  '45 6 * * *',
  'SELECT check_integration_health_daily();'
);

-- ============================================================================
-- JOB 5: Old Log Cleanup (7:00 AM UTC - Weekly on Sundays)
-- ============================================================================
-- Cleanup old cron job logs (keep last 30 days)

CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  -- Delete logs older than 30 days
  DELETE FROM public.cron_job_logs
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Log the cleanup
  INSERT INTO public.cron_job_logs (job_name, status, details)
  VALUES (
    'cleanup_old_logs',
    'success',
    jsonb_build_object('deleted_logs', v_deleted)
  );
END;
$$;

-- Schedule: Run weekly on Sundays at 7:00 AM UTC
SELECT cron.schedule(
  'weekly-log-cleanup',
  '0 7 * * 0',
  'SELECT cleanup_old_logs();'
);

-- ============================================================================
-- HELPER FUNCTION: View Recent Cron Job Results
-- ============================================================================

CREATE OR REPLACE FUNCTION get_recent_cron_results(days INTEGER DEFAULT 7)
RETURNS TABLE (
  job_name TEXT,
  run_at TIMESTAMPTZ,
  status TEXT,
  details JSONB
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    job_name,
    run_at,
    status,
    details
  FROM public.cron_job_logs
  WHERE created_at > NOW() - (days || ' days')::INTERVAL
  ORDER BY run_at DESC;
$$;

-- ============================================================================
-- HELPER FUNCTION: Get Latest Status for Each Job
-- ============================================================================

CREATE OR REPLACE FUNCTION get_latest_cron_status()
RETURNS TABLE (
  job_name TEXT,
  last_run TIMESTAMPTZ,
  status TEXT,
  details JSONB
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (job_name)
    job_name,
    run_at as last_run,
    status,
    details
  FROM public.cron_job_logs
  ORDER BY job_name, run_at DESC;
$$;

-- ============================================================================
-- VIEW: Cron Job Schedule Summary
-- ============================================================================

CREATE OR REPLACE VIEW cron_job_schedule AS
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
ORDER BY schedule;

-- Grant access to service role
GRANT SELECT ON cron_job_schedule TO service_role;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- List all scheduled cron jobs
SELECT
  '=== SCHEDULED CRON JOBS ===' AS info,
  jobid,
  schedule,
  command,
  active
FROM cron.job
ORDER BY schedule;

-- Show initial status (will populate after first run)
SELECT
  '=== CRON JOB MONITORING TABLE ===' AS info,
  COUNT(*) as total_logs
FROM public.cron_job_logs;

-- ============================================================================
-- MANUAL TEST COMMANDS (Run these to test immediately)
-- ============================================================================

-- Test RLS verification
-- SELECT verify_rls_status_daily();

-- Test orphaned data check
-- SELECT check_orphaned_data_daily();

-- Test workspace health check
-- SELECT check_workspace_health_daily();

-- Test integration health check
-- SELECT check_integration_health_daily();

-- View results
-- SELECT * FROM get_latest_cron_status();

-- ============================================================================
-- END OF CRON SETUP
-- ============================================================================

SELECT
  '✅ pg_cron jobs configured successfully' AS status,
  COUNT(*) AS jobs_scheduled
FROM cron.job
WHERE command LIKE '%daily%' OR command LIKE '%weekly%';
