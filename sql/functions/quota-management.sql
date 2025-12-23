-- LinkedIn Search Quota Management
-- Tracks aggregate search result volume to prevent hitting LinkedIn limits
CREATE OR REPLACE FUNCTION check_linkedin_search_quota(p_account_id TEXT) RETURNS TABLE(
        usage_last_24h INTEGER,
        daily_limit INTEGER,
        remaining INTEGER,
        is_blocked BOOLEAN,
        account_type TEXT
    ) LANGUAGE plpgsql AS $$
DECLARE v_usage INTEGER;
v_limit INTEGER;
v_premium_features JSONB;
v_account_type TEXT;
BEGIN -- 1. Determine account type and limit
SELECT (
        COALESCE(
            metadata->'connection_params'->'im'->'premiumFeatures',
            '[]'::jsonb
        )
    ),
    CASE
        WHEN (
            metadata->'connection_params'->'im'->'premiumFeatures'
        ) ? 'sales_navigator' THEN 'sales_navigator'
        WHEN (
            metadata->'connection_params'->'im'->'premiumFeatures'
        ) ? 'recruiter' THEN 'recruiter'
        ELSE 'classic'
    END INTO v_premium_features,
    v_account_type
FROM workspace_accounts
WHERE unipile_account_id = p_account_id;
-- Default limits: 5000 for Sales Nav/Recruiter, 1000 for Classic/Free
v_limit := CASE
    WHEN v_account_type IN ('sales_navigator', 'recruiter') THEN 5000
    ELSE 1000
END;
-- 2. Calculate usage in last 24 hours
SELECT COALESCE(SUM(results_count), 0) INTO v_usage
FROM linkedin_searches
WHERE unipile_account_id = p_account_id
    AND searched_at > NOW() - INTERVAL '24 hours';
-- 3. Return results
RETURN QUERY
SELECT v_usage,
    v_limit,
    GREATEST(0, v_limit - v_usage),
    (v_usage >= v_limit),
    v_account_type;
END;
$$;
-- Add account type override possibility to metadata later if needed
COMMENT ON FUNCTION check_linkedin_search_quota IS 'Tracks total LinkedIn search result volume per account in the last 24 hours';