-- Migration: Create cron_job_runs table for tracking agent execution history
-- Created: December 17, 2025
-- Purpose: Track all scheduled function executions for monitoring and debugging

-- Create the cron_job_runs table
CREATE TABLE IF NOT EXISTS cron_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'timeout')),
  records_processed INTEGER DEFAULT 0,
  records_success INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  execution_time_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cron_job_runs_job_name ON cron_job_runs(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_job_runs_started_at ON cron_job_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_job_runs_status ON cron_job_runs(status);
CREATE INDEX IF NOT EXISTS idx_cron_job_runs_job_started ON cron_job_runs(job_name, started_at DESC);

-- Add comment
COMMENT ON TABLE cron_job_runs IS 'Tracks execution history of all scheduled functions/cron jobs for monitoring and debugging';

-- Create a view for recent job health
CREATE OR REPLACE VIEW cron_job_health AS
SELECT
  job_name,
  COUNT(*) as total_runs_24h,
  COUNT(*) FILTER (WHERE status = 'success') as success_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'timeout') as timeout_count,
  ROUND(AVG(execution_time_ms)) as avg_execution_ms,
  MAX(started_at) as last_run,
  CASE
    WHEN COUNT(*) FILTER (WHERE status = 'failed') > COUNT(*) * 0.1 THEN 'unhealthy'
    WHEN COUNT(*) FILTER (WHERE status = 'failed') > 0 THEN 'degraded'
    ELSE 'healthy'
  END as health_status
FROM cron_job_runs
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY job_name
ORDER BY job_name;

-- Grant access
GRANT SELECT, INSERT, UPDATE ON cron_job_runs TO authenticated;
GRANT SELECT ON cron_job_health TO authenticated;
