-- ============================================================================
-- Rate Limit Tracking & Auto-Adjustment
-- ============================================================================
-- Tracks CR sends per account per day and prevents hitting limits

-- Function: Get CR count for an account today
CREATE OR REPLACE FUNCTION get_daily_cr_count(p_account_id TEXT, p_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM campaign_prospects
  WHERE unipile_account_id = p_account_id
    AND status IN ('connection_requested', 'accepted', 'replied', 'completed_no_reply')
    AND contacted_at::DATE = p_date;
    
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Function: Check if account can send more CRs today
CREATE OR REPLACE FUNCTION can_send_cr(p_account_id TEXT, p_daily_limit INTEGER DEFAULT 20)
RETURNS TABLE(
  can_send BOOLEAN,
  sent_today INTEGER,
  remaining INTEGER,
  limit_reached BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_sent_today INTEGER;
  v_remaining INTEGER;
BEGIN
  v_sent_today := get_daily_cr_count(p_account_id);
  v_remaining := GREATEST(0, p_daily_limit - v_sent_today);
  
  RETURN QUERY SELECT
    (v_sent_today < p_daily_limit)::BOOLEAN as can_send,
    v_sent_today,
    v_remaining,
    (v_sent_today >= p_daily_limit)::BOOLEAN as limit_reached;
END;
$$;

-- Function: Get account usage across all accounts
CREATE OR REPLACE FUNCTION get_account_usage_today()
RETURNS TABLE(
  account_id TEXT,
  account_name TEXT,
  workspace_name TEXT,
  crs_sent_today INTEGER,
  messages_sent_today INTEGER,
  daily_cr_limit INTEGER,
  remaining_crs INTEGER,
  is_available BOOLEAN,
  usage_percentage NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wa.unipile_account_id as account_id,
    wa.account_name,
    w.name as workspace_name,
    -- CRs sent today
    COUNT(CASE 
      WHEN cp.status IN ('connection_requested', 'accepted', 'replied', 'completed_no_reply')
        AND cp.contacted_at::DATE = CURRENT_DATE
      THEN 1 
    END)::INTEGER as crs_sent_today,
    -- Messages sent today (after connection)
    COUNT(CASE 
      WHEN cp.status IN ('message_sent', 'replied', 'completed_no_reply')
        AND cp.contacted_at::DATE = CURRENT_DATE
        AND cp.contacted_at IS NOT NULL
      THEN 1 
    END)::INTEGER as messages_sent_today,
    -- Daily limit (default 20, can be configured per account)
    COALESCE(wa.metadata->>'daily_cr_limit', '20')::INTEGER as daily_cr_limit,
    -- Remaining sends
    GREATEST(0, 
      COALESCE(wa.metadata->>'daily_cr_limit', '20')::INTEGER - 
      COUNT(CASE 
        WHEN cp.status IN ('connection_requested', 'accepted', 'replied', 'completed_no_reply')
          AND cp.contacted_at::DATE = CURRENT_DATE
        THEN 1 
      END)
    )::INTEGER as remaining_crs,
    -- Is account available?
    (
      -- Not rate limited
      NOT EXISTS (
        SELECT 1 FROM campaign_prospects cp2
        WHERE cp2.unipile_account_id = wa.unipile_account_id
          AND cp2.status = 'rate_limited_cr'
          AND cp2.updated_at > NOW() - INTERVAL '24 hours'
      )
      AND
      -- Under daily limit
      COUNT(CASE 
        WHEN cp.status IN ('connection_requested', 'accepted', 'replied', 'completed_no_reply')
          AND cp.contacted_at::DATE = CURRENT_DATE
        THEN 1 
      END) < COALESCE(wa.metadata->>'daily_cr_limit', '20')::INTEGER
    ) as is_available,
    -- Usage percentage
    ROUND(
      (COUNT(CASE 
        WHEN cp.status IN ('connection_requested', 'accepted', 'replied', 'completed_no_reply')
          AND cp.contacted_at::DATE = CURRENT_DATE
        THEN 1 
      END)::NUMERIC / 
      NULLIF(COALESCE(wa.metadata->>'daily_cr_limit', '20')::NUMERIC, 0)) * 100,
      1
    ) as usage_percentage
  FROM workspace_accounts wa
  JOIN workspaces w ON w.id = wa.workspace_id
  LEFT JOIN campaign_prospects cp ON cp.unipile_account_id = wa.unipile_account_id
  WHERE wa.provider = 'linkedin'
    AND wa.is_active = true
  GROUP BY wa.unipile_account_id, wa.account_name, w.name, wa.metadata
  ORDER BY is_available DESC, remaining_crs DESC;
END;
$$;

-- Function: Get next available account for a workspace
CREATE OR REPLACE FUNCTION get_next_available_account(p_workspace_id UUID)
RETURNS TABLE(
  account_id TEXT,
  account_name TEXT,
  remaining_crs INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wa.unipile_account_id as account_id,
    wa.account_name,
    GREATEST(0, 
      COALESCE(wa.metadata->>'daily_cr_limit', '20')::INTEGER - 
      COUNT(CASE 
        WHEN cp.status IN ('connection_requested', 'accepted', 'replied', 'completed_no_reply')
          AND cp.contacted_at::DATE = CURRENT_DATE
        THEN 1 
      END)
    )::INTEGER as remaining_crs
  FROM workspace_accounts wa
  LEFT JOIN campaign_prospects cp ON cp.unipile_account_id = wa.unipile_account_id
  WHERE wa.workspace_id = p_workspace_id
    AND wa.provider = 'linkedin'
    AND wa.is_active = true
    -- Not rate limited
    AND NOT EXISTS (
      SELECT 1 FROM campaign_prospects cp2
      WHERE cp2.unipile_account_id = wa.unipile_account_id
        AND cp2.status = 'rate_limited_cr'
        AND cp2.updated_at > NOW() - INTERVAL '24 hours'
    )
  GROUP BY wa.unipile_account_id, wa.account_name, wa.metadata
  HAVING COUNT(CASE 
    WHEN cp.status IN ('connection_requested', 'accepted', 'replied', 'completed_no_reply')
      AND cp.contacted_at::DATE = CURRENT_DATE
    THEN 1 
  END) < COALESCE(wa.metadata->>'daily_cr_limit', '20')::INTEGER
  ORDER BY remaining_crs DESC
  LIMIT 1;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_daily_cr_count(TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION can_send_cr(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_account_usage_today() TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_available_account(UUID) TO authenticated;

-- Test queries
SELECT '=== Account Usage Today ===' as status;
SELECT * FROM get_account_usage_today();

SELECT '=== Functions created successfully ===' as status;
