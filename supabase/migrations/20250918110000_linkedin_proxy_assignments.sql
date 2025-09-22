-- LinkedIn Proxy Assignments
-- Stores BrightData proxy IP assignments for each LinkedIn account
-- Enables country-specific proxy routing for LinkedIn campaigns

-- LinkedIn proxy assignments table
CREATE TABLE IF NOT EXISTS linkedin_proxy_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- LinkedIn account identification
    linkedin_account_id TEXT NOT NULL, -- Unipile account ID
    linkedin_account_name TEXT NOT NULL, -- Display name
    detected_country TEXT NOT NULL, -- Country detected from LinkedIn profile
    
    -- BrightData proxy configuration
    proxy_country TEXT NOT NULL, -- BrightData country code
    proxy_state TEXT, -- BrightData state code (if applicable)
    proxy_city TEXT, -- BrightData city code (if applicable)
    proxy_session_id TEXT NOT NULL, -- Unique session identifier
    proxy_username TEXT NOT NULL, -- Generated BrightData username
    
    -- Assignment metadata
    confidence_score DECIMAL DEFAULT 1.0, -- Confidence in country assignment
    connectivity_status TEXT DEFAULT 'untested' CHECK (connectivity_status IN ('active', 'failed', 'untested', 'disabled')),
    connectivity_details JSONB, -- Connectivity test results
    
    -- LinkedIn account details
    is_primary_account BOOLEAN DEFAULT false, -- Main account flag
    account_features JSONB DEFAULT '[]', -- Premium features (premium, sales_navigator)
    
    -- Timing and status
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    last_connectivity_test TIMESTAMPTZ,
    next_rotation_due TIMESTAMPTZ, -- When to rotate IP
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate assignments per user/account
    UNIQUE(user_id, linkedin_account_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_linkedin_proxy_user ON linkedin_proxy_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_proxy_account ON linkedin_proxy_assignments(linkedin_account_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_proxy_country ON linkedin_proxy_assignments(proxy_country);
CREATE INDEX IF NOT EXISTS idx_linkedin_proxy_primary ON linkedin_proxy_assignments(user_id, is_primary_account) WHERE is_primary_account = true;
CREATE INDEX IF NOT EXISTS idx_linkedin_proxy_connectivity ON linkedin_proxy_assignments(connectivity_status);
CREATE INDEX IF NOT EXISTS idx_linkedin_proxy_rotation ON linkedin_proxy_assignments(next_rotation_due) WHERE next_rotation_due IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE linkedin_proxy_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own proxy assignments
CREATE POLICY "Users can access own linkedin proxy assignments" ON linkedin_proxy_assignments
    FOR ALL USING (user_id = (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

-- Function to get optimal proxy for LinkedIn account
CREATE OR REPLACE FUNCTION get_linkedin_account_proxy(
    p_user_id UUID,
    p_linkedin_account_id TEXT DEFAULT NULL,
    p_prefer_sales_navigator BOOLEAN DEFAULT true
)
RETURNS TABLE (
    linkedin_account_id TEXT,
    linkedin_account_name TEXT,
    proxy_country TEXT,
    proxy_state TEXT,
    proxy_city TEXT,
    proxy_session_id TEXT,
    proxy_username TEXT,
    account_features JSONB,
    is_primary_account BOOLEAN,
    connectivity_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- If specific account requested, return that
    IF p_linkedin_account_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            lpa.linkedin_account_id,
            lpa.linkedin_account_name,
            lpa.proxy_country,
            lpa.proxy_state,
            lpa.proxy_city,
            lpa.proxy_session_id,
            lpa.proxy_username,
            lpa.account_features,
            lpa.is_primary_account,
            lpa.connectivity_status
        FROM linkedin_proxy_assignments lpa
        WHERE lpa.user_id = p_user_id 
          AND lpa.linkedin_account_id = p_linkedin_account_id
          AND lpa.connectivity_status = 'active';
        
        RETURN;
    END IF;
    
    -- Auto-select best account based on preferences
    RETURN QUERY
    SELECT 
        lpa.linkedin_account_id,
        lpa.linkedin_account_name,
        lpa.proxy_country,
        lpa.proxy_state,
        lpa.proxy_city,
        lpa.proxy_session_id,
        lpa.proxy_username,
        lpa.account_features,
        lpa.is_primary_account,
        lpa.connectivity_status
    FROM linkedin_proxy_assignments lpa
    WHERE lpa.user_id = p_user_id 
      AND lpa.connectivity_status = 'active'
    ORDER BY 
        -- Prefer Sales Navigator accounts if requested
        CASE 
            WHEN p_prefer_sales_navigator AND lpa.account_features ? 'sales_navigator' THEN 1
            WHEN lpa.account_features ? 'premium' THEN 2
            ELSE 3
        END,
        -- Then prefer primary account
        CASE WHEN lpa.is_primary_account THEN 1 ELSE 2 END,
        -- Finally by last update
        lpa.last_updated DESC
    LIMIT 1;
END;
$$;

-- Function to rotate proxy session for account
CREATE OR REPLACE FUNCTION rotate_linkedin_proxy_session(
    p_user_id UUID,
    p_linkedin_account_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_session_id TEXT;
    v_new_username TEXT;
    v_country TEXT;
    v_state TEXT;
    v_city TEXT;
BEGIN
    -- Get current proxy config
    SELECT proxy_country, proxy_state, proxy_city 
    INTO v_country, v_state, v_city
    FROM linkedin_proxy_assignments
    WHERE user_id = p_user_id AND linkedin_account_id = p_linkedin_account_id;
    
    IF v_country IS NULL THEN
        RETURN FALSE; -- Account not found
    END IF;
    
    -- Generate new session ID
    v_new_session_id := 'rotation_' || EXTRACT(EPOCH FROM NOW())::INTEGER || '_' || 
                        substr(md5(random()::text), 1, 8);
    
    -- Build new username
    v_new_username := 'brd-customer-' || COALESCE(current_setting('app.bright_data_customer_id', true), 'CUSTOMER_ID') || 
                      '-zone-residential-country-' || v_country;
    
    IF v_state IS NOT NULL THEN
        v_new_username := v_new_username || '-state-' || v_state;
    END IF;
    
    IF v_city IS NOT NULL THEN
        v_new_username := v_new_username || '-city-' || v_city;
    END IF;
    
    v_new_username := v_new_username || '-session-' || v_new_session_id;
    
    -- Update proxy assignment with new session
    UPDATE linkedin_proxy_assignments
    SET 
        proxy_session_id = v_new_session_id,
        proxy_username = v_new_username,
        connectivity_status = 'untested', -- Needs new connectivity test
        next_rotation_due = NOW() + INTERVAL '24 hours', -- Schedule next rotation
        last_updated = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id AND linkedin_account_id = p_linkedin_account_id;
    
    RETURN FOUND;
END;
$$;

-- Function to update connectivity status
CREATE OR REPLACE FUNCTION update_linkedin_proxy_connectivity(
    p_user_id UUID,
    p_linkedin_account_id TEXT,
    p_connectivity_status TEXT,
    p_connectivity_details JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE linkedin_proxy_assignments
    SET 
        connectivity_status = p_connectivity_status,
        connectivity_details = COALESCE(p_connectivity_details, connectivity_details),
        last_connectivity_test = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id AND linkedin_account_id = p_linkedin_account_id;
    
    RETURN FOUND;
END;
$$;

-- View for proxy assignment summary
CREATE OR REPLACE VIEW linkedin_proxy_summary AS
SELECT 
    lpa.user_id,
    COUNT(*) as total_assignments,
    COUNT(*) FILTER (WHERE connectivity_status = 'active') as active_proxies,
    COUNT(*) FILTER (WHERE account_features ? 'sales_navigator') as sales_navigator_accounts,
    COUNT(*) FILTER (WHERE account_features ? 'premium') as premium_accounts,
    COUNT(*) FILTER (WHERE is_primary_account = true) as primary_accounts,
    array_agg(DISTINCT proxy_country) as assigned_countries,
    MAX(last_updated) as last_assignment_update
FROM linkedin_proxy_assignments lpa
GROUP BY lpa.user_id;

-- Comments
COMMENT ON TABLE linkedin_proxy_assignments IS 'BrightData proxy IP assignments for LinkedIn accounts with country-based routing';
COMMENT ON COLUMN linkedin_proxy_assignments.proxy_session_id IS 'Unique session ID for BrightData proxy rotation';
COMMENT ON COLUMN linkedin_proxy_assignments.confidence_score IS 'Confidence level in country detection and proxy assignment';
COMMENT ON COLUMN linkedin_proxy_assignments.account_features IS 'LinkedIn premium features: ["premium", "sales_navigator"]';
COMMENT ON FUNCTION get_linkedin_account_proxy IS 'Returns optimal proxy configuration for LinkedIn account with smart selection';
COMMENT ON FUNCTION rotate_linkedin_proxy_session IS 'Generates new proxy session ID for account to avoid detection';
COMMENT ON FUNCTION update_linkedin_proxy_connectivity IS 'Updates proxy connectivity status after testing';