-- ============================================================================
-- SAM Campaign Automation Functions
-- ============================================================================
-- Auto-retry rate limited prospects, cleanup stale executions, pause failing campaigns
-- ============================================================================

-- Function 1: Auto-retry rate limited prospects
-- Runs every 5 minutes via cron
-- Finds prospects that were rate limited >30 min ago and resets them to pending
CREATE OR REPLACE FUNCTION auto_retry_rate_limited_prospects()
RETURNS TABLE(
  reset_count INTEGER,
  campaign_ids UUID[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_reset_count INTEGER;
  v_campaign_ids UUID[];
BEGIN
  -- Reset prospects that were rate limited more than 30 minutes ago
  WITH updated AS (
    UPDATE campaign_prospects
    SET
      status = 'pending',
      updated_at = NOW()
    WHERE
      status = 'rate_limited'
      AND updated_at < NOW() - INTERVAL '30 minutes'
    RETURNING id, campaign_id
  )
  SELECT
    COUNT(*)::INTEGER,
    ARRAY_AGG(DISTINCT campaign_id)
  INTO v_reset_count, v_campaign_ids
  FROM updated;

  -- Log the action
  IF v_reset_count > 0 THEN
    RAISE NOTICE 'Auto-retry: Reset % rate-limited prospects from % campaigns',
      v_reset_count, ARRAY_LENGTH(v_campaign_ids, 1);
  END IF;

  RETURN QUERY SELECT v_reset_count, v_campaign_ids;
END;
$$;

-- Function 2: Auto-cleanup stale queued executions
-- Runs every 15 minutes via cron
-- Finds prospects stuck in queued_in_n8n for >2 hours and resets them
CREATE OR REPLACE FUNCTION auto_cleanup_stale_executions()
RETURNS TABLE(
  reset_count INTEGER,
  affected_campaigns TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_reset_count INTEGER;
  v_campaign_names TEXT[];
BEGIN
  -- Reset prospects stuck in queued_in_n8n for more than 2 hours
  WITH updated AS (
    UPDATE campaign_prospects cp
    SET
      status = 'pending',
      updated_at = NOW()
    WHERE
      cp.status = 'queued_in_n8n'
      AND cp.updated_at < NOW() - INTERVAL '2 hours'
    RETURNING cp.id, cp.campaign_id
  ),
  campaign_info AS (
    SELECT DISTINCT c.name
    FROM updated u
    JOIN campaigns c ON c.id = u.campaign_id
  )
  SELECT
    COUNT(*)::INTEGER,
    ARRAY_AGG(name)
  INTO v_reset_count, v_campaign_names
  FROM campaign_info;

  -- Log the action
  IF v_reset_count > 0 THEN
    RAISE NOTICE 'Auto-cleanup: Reset % stale prospects from campaigns: %',
      v_reset_count, v_campaign_names;
  END IF;

  RETURN QUERY SELECT v_reset_count, v_campaign_names;
END;
$$;

-- Function 3: Auto-pause failing campaigns
-- Runs every hour via cron
-- Finds campaigns with >50% failure rate in last 24h and pauses them
CREATE OR REPLACE FUNCTION auto_pause_failing_campaigns()
RETURNS TABLE(
  paused_count INTEGER,
  paused_campaigns JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_paused_count INTEGER := 0;
  v_paused_campaigns JSONB := '[]'::JSONB;
BEGIN
  -- Find campaigns with high failure rates
  WITH campaign_stats AS (
    SELECT
      c.id,
      c.name,
      c.workspace_id,
      COUNT(*) FILTER (WHERE cp.status IN ('failed', 'error')) as failed_count,
      COUNT(*) as total_count,
      (COUNT(*) FILTER (WHERE cp.status IN ('failed', 'error'))::FLOAT /
       NULLIF(COUNT(*), 0)::FLOAT) as failure_rate
    FROM campaigns c
    JOIN campaign_prospects cp ON cp.campaign_id = c.id
    WHERE
      c.status = 'active'
      AND cp.updated_at > NOW() - INTERVAL '24 hours'
    GROUP BY c.id, c.name, c.workspace_id
    HAVING
      COUNT(*) >= 10  -- At least 10 prospects attempted
      AND (COUNT(*) FILTER (WHERE cp.status IN ('failed', 'error'))::FLOAT /
           NULLIF(COUNT(*), 0)::FLOAT) > 0.5  -- >50% failure rate
  ),
  paused AS (
    UPDATE campaigns c
    SET
      status = 'paused',
      updated_at = NOW()
    FROM campaign_stats cs
    WHERE c.id = cs.id
    RETURNING
      c.id,
      c.name,
      cs.failure_rate,
      cs.failed_count,
      cs.total_count
  )
  SELECT
    COUNT(*)::INTEGER,
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'id', id,
        'name', name,
        'failure_rate', ROUND(failure_rate::NUMERIC, 2),
        'failed', failed_count,
        'total', total_count
      )
    )
  INTO v_paused_count, v_paused_campaigns
  FROM paused;

  -- Log the action
  IF v_paused_count > 0 THEN
    RAISE NOTICE 'Auto-pause: Paused % failing campaigns: %',
      v_paused_count, v_paused_campaigns;
  END IF;

  RETURN QUERY SELECT v_paused_count, v_paused_campaigns;
END;
$$;

-- Function 4: Auto-resume campaigns after rate limits clear
-- Runs every 15 minutes via cron
-- Resumes paused campaigns if no rate limit issues in last 30 min
CREATE OR REPLACE FUNCTION auto_resume_after_rate_limits()
RETURNS TABLE(
  resumed_count INTEGER,
  resumed_campaigns TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_resumed_count INTEGER := 0;
  v_campaign_names TEXT[];
BEGIN
  -- Find campaigns that were auto-paused and can be resumed
  -- (No rate_limited prospects in last 30 minutes)
  WITH safe_campaigns AS (
    SELECT DISTINCT c.id, c.name
    FROM campaigns c
    WHERE
      c.status = 'paused'
      AND c.updated_at > NOW() - INTERVAL '24 hours'  -- Recently paused
      AND NOT EXISTS (
        SELECT 1
        FROM campaign_prospects cp
        WHERE
          cp.campaign_id = c.id
          AND cp.status = 'rate_limited'
          AND cp.updated_at > NOW() - INTERVAL '30 minutes'
      )
      AND EXISTS (
        SELECT 1
        FROM campaign_prospects cp
        WHERE cp.campaign_id = c.id AND cp.status = 'pending'
        LIMIT 1
      )
  ),
  resumed AS (
    UPDATE campaigns c
    SET
      status = 'active',
      updated_at = NOW()
    FROM safe_campaigns sc
    WHERE c.id = sc.id
    RETURNING c.id, c.name
  )
  SELECT
    COUNT(*)::INTEGER,
    ARRAY_AGG(name)
  INTO v_resumed_count, v_campaign_names
  FROM resumed;

  -- Log the action
  IF v_resumed_count > 0 THEN
    RAISE NOTICE 'Auto-resume: Resumed % campaigns after rate limits cleared: %',
      v_resumed_count, v_campaign_names;
  END IF;

  RETURN QUERY SELECT v_resumed_count, v_campaign_names;
END;
$$;

-- Function 5: Get automation health stats
CREATE OR REPLACE FUNCTION get_automation_health()
RETURNS TABLE(
  metric TEXT,
  value INTEGER,
  details JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- Rate limited prospects
  SELECT
    'rate_limited_prospects'::TEXT,
    COUNT(*)::INTEGER,
    JSONB_BUILD_OBJECT(
      'oldest', MIN(updated_at),
      'newest', MAX(updated_at)
    )
  FROM campaign_prospects
  WHERE status = 'rate_limited'

  UNION ALL

  -- Stale queued prospects
  SELECT
    'stale_queued_prospects'::TEXT,
    COUNT(*)::INTEGER,
    JSONB_BUILD_OBJECT(
      'oldest', MIN(updated_at),
      'hours_stuck', EXTRACT(EPOCH FROM (NOW() - MIN(updated_at)))/3600
    )
  FROM campaign_prospects
  WHERE
    status = 'queued_in_n8n'
    AND updated_at < NOW() - INTERVAL '2 hours'

  UNION ALL

  -- Failing campaigns
  SELECT
    'high_failure_campaigns'::TEXT,
    COUNT(DISTINCT c.id)::INTEGER,
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'name', c.name,
        'failure_rate',
          ROUND((COUNT(*) FILTER (WHERE cp.status IN ('failed', 'error'))::FLOAT /
                 NULLIF(COUNT(*), 0)::FLOAT)::NUMERIC, 2)
      )
    )
  FROM campaigns c
  JOIN campaign_prospects cp ON cp.campaign_id = c.id
  WHERE
    c.status = 'active'
    AND cp.updated_at > NOW() - INTERVAL '24 hours'
  GROUP BY c.id, c.name
  HAVING
    COUNT(*) >= 10
    AND (COUNT(*) FILTER (WHERE cp.status IN ('failed', 'error'))::FLOAT /
         NULLIF(COUNT(*), 0)::FLOAT) > 0.5;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION auto_retry_rate_limited_prospects() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_cleanup_stale_executions() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_pause_failing_campaigns() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_resume_after_rate_limits() TO authenticated;
GRANT EXECUTE ON FUNCTION get_automation_health() TO authenticated;

-- Add comments
COMMENT ON FUNCTION auto_retry_rate_limited_prospects() IS
  'Automatically retries prospects that were rate limited >30 min ago';

COMMENT ON FUNCTION auto_cleanup_stale_executions() IS
  'Resets prospects stuck in queued_in_n8n for >2 hours';

COMMENT ON FUNCTION auto_pause_failing_campaigns() IS
  'Pauses campaigns with >50% failure rate in last 24 hours';

COMMENT ON FUNCTION auto_resume_after_rate_limits() IS
  'Resumes paused campaigns after rate limits clear';

COMMENT ON FUNCTION get_automation_health() IS
  'Returns metrics about automation system health';
