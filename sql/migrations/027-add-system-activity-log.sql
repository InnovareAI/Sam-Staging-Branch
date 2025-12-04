-- Migration: Add System Activity Log
-- Date: December 4, 2025
-- Purpose: Track all system actions for debugging and auditing

-- ============================================================================
-- 1. Create system_activity_log table
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  workspace_id UUID REFERENCES workspaces(id),
  campaign_id UUID REFERENCES campaigns(id),
  prospect_id UUID,
  user_id UUID,

  -- Action details
  action_type TEXT NOT NULL,  -- 'queue_add', 'queue_send', 'queue_fail', 'api_call', 'error', etc.
  action_status TEXT NOT NULL DEFAULT 'success',  -- 'success', 'failed', 'skipped'

  -- Data
  details JSONB DEFAULT '{}',
  error_message TEXT,

  -- Timing
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_activity_log_workspace ON system_activity_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_campaign ON system_activity_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action_type ON system_activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON system_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_status ON system_activity_log(action_status);

COMMENT ON TABLE system_activity_log IS 'Tracks all system actions for debugging and auditing';

-- ============================================================================
-- 2. Function to log activity (for use in app code)
-- ============================================================================

CREATE OR REPLACE FUNCTION log_system_activity(
  p_workspace_id UUID,
  p_campaign_id UUID,
  p_prospect_id UUID,
  p_action_type TEXT,
  p_action_status TEXT,
  p_details JSONB DEFAULT '{}',
  p_error_message TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO system_activity_log (
    workspace_id, campaign_id, prospect_id,
    action_type, action_status, details, error_message, duration_ms
  ) VALUES (
    p_workspace_id, p_campaign_id, p_prospect_id,
    p_action_type, p_action_status, p_details, p_error_message, p_duration_ms
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_system_activity TO service_role;

-- ============================================================================
-- 3. View for recent errors (quick debugging)
-- ============================================================================

CREATE OR REPLACE VIEW recent_errors AS
SELECT
  created_at,
  action_type,
  campaign_id,
  prospect_id,
  error_message,
  details
FROM system_activity_log
WHERE action_status = 'failed'
ORDER BY created_at DESC
LIMIT 100;

GRANT SELECT ON recent_errors TO service_role;

-- ============================================================================
-- 4. Auto-cleanup old logs (keep 30 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM system_activity_log
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_activity_logs TO service_role;
