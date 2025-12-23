-- LinkedIn Safety & Privacy Infrastructure Migration
-- Consolidates tracking table, isolation policies, and quota functions
-- 1. Create the Search Tracking Table
CREATE TABLE IF NOT EXISTS public.linkedin_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    workspace_id TEXT,
    unipile_account_id TEXT,
    search_query TEXT,
    search_params JSONB,
    api_type TEXT,
    category TEXT,
    results_count INTEGER DEFAULT 0,
    prospects JSONB DEFAULT '[]'::jsonb,
    next_cursor TEXT,
    searched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 2. Enable Privacy (Row Level Security)
ALTER TABLE public.linkedin_searches ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'linkedin_searches'
        AND policyname = 'Users can only see searches in their workspace'
) THEN CREATE POLICY "Users can only see searches in their workspace" ON public.linkedin_searches FOR ALL USING (
    workspace_id IN (
        SELECT workspace_id::text
        FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);
END IF;
END $$;
-- 3. Install Quota Tracking Logic
CREATE OR REPLACE FUNCTION public.check_linkedin_search_quota(p_account_id TEXT) RETURNS TABLE(
        usage_last_24h INTEGER,
        daily_limit INTEGER,
        remaining INTEGER,
        is_blocked BOOLEAN,
        account_type TEXT
    ) LANGUAGE plpgsql AS $func$
DECLARE v_usage INTEGER;
v_limit INTEGER;
v_account_type TEXT;
BEGIN
SELECT CASE
        WHEN (
            metadata->'connection_params'->'im'->'premiumFeatures'
        ) ? 'sales_navigator' THEN 'sales_navigator'
        WHEN (
            metadata->'connection_params'->'im'->'premiumFeatures'
        ) ? 'recruiter' THEN 'recruiter'
        ELSE 'classic'
    END INTO v_account_type
FROM public.workspace_accounts
WHERE unipile_account_id = p_account_id;
v_limit := CASE
    WHEN v_account_type IN ('sales_navigator', 'recruiter') THEN 5000
    ELSE 1000
END;
SELECT COALESCE(SUM(results_count), 0) INTO v_usage
FROM public.linkedin_searches
WHERE unipile_account_id = p_account_id
    AND searched_at > NOW() - INTERVAL '24 hours';
RETURN QUERY
SELECT v_usage,
    v_limit,
    GREATEST(0, v_limit - v_usage),
    (v_usage >= v_limit),
    v_account_type;
END;
$func$;