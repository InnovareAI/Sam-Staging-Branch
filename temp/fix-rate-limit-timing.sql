-- ============================================================================
-- FIX: Rate Limit Timing - 24 Hours Instead of 30 Minutes
-- ============================================================================

-- Update Function 1: Auto-retry rate limited prospects after 24 hours
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
  -- Reset prospects that were rate limited more than 24 hours ago
  WITH updated AS (
    UPDATE campaign_prospects
    SET
      status = 'pending',
      updated_at = NOW()
    WHERE
      status = 'rate_limited'
      AND updated_at < NOW() - INTERVAL '24 hours'  -- FIXED: Was 30 minutes
    RETURNING id, campaign_id
  )
  SELECT
    COUNT(*)::INTEGER,
    ARRAY_AGG(DISTINCT campaign_id)
  INTO v_reset_count, v_campaign_ids
  FROM updated;

  -- Log the action
  IF v_reset_count > 0 THEN
    RAISE NOTICE 'Auto-retry: Reset % rate-limited prospects from % campaigns after 24 hour wait',
      v_reset_count, ARRAY_LENGTH(v_campaign_ids, 1);
  END IF;

  RETURN QUERY SELECT v_reset_count, v_campaign_ids;
END;
$$;

-- Update Function 4: Auto-resume campaigns after 24 hours from last rate limit
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
  -- (No rate_limited prospects in last 24 hours)
  WITH safe_campaigns AS (
    SELECT DISTINCT c.id, c.name
    FROM campaigns c
    WHERE
      c.status = 'paused'
      AND c.updated_at > NOW() - INTERVAL '7 days'  -- Recently paused (within a week)
      AND NOT EXISTS (
        SELECT 1
        FROM campaign_prospects cp
        WHERE
          cp.campaign_id = c.id
          AND cp.status = 'rate_limited'
          AND cp.updated_at > NOW() - INTERVAL '24 hours'  -- FIXED: Was 30 minutes
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
    RAISE NOTICE 'Auto-resume: Resumed % campaigns after 24 hour rate limit period: %',
      v_resumed_count, v_campaign_names;
  END IF;

  RETURN QUERY SELECT v_resumed_count, v_campaign_names;
END;
$$;

-- Update comments
COMMENT ON FUNCTION auto_retry_rate_limited_prospects() IS
  'Automatically retries prospects that were rate limited >24 hours ago';

COMMENT ON FUNCTION auto_resume_after_rate_limits() IS
  'Resumes paused campaigns after 24 hour rate limit period';

-- Verify the fix
SELECT 'Functions updated successfully. Rate limits now wait 24 hours.' AS status;
