-- Workspace Data Sharing System
-- Enables team members to share Unipile and BrightData enrichment across the workspace
-- Maximizes data utility while maintaining privacy controls

-- 1. Workspace shared data pool
CREATE TABLE IF NOT EXISTS workspace_shared_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Data source tracking
    contributed_by UUID NOT NULL REFERENCES users(id),
    data_source TEXT NOT NULL CHECK (data_source IN ('unipile', 'brightdata', 'apollo', 'linkedin_sales_nav', 'manual', 'other')),
    data_source_account UUID REFERENCES workspace_accounts(id), -- Which account pulled this data
    
    -- Data identification (for deduplication)
    data_type TEXT NOT NULL CHECK (data_type IN ('prospect', 'company', 'contact_list', 'enrichment')),
    entity_hash TEXT NOT NULL, -- Hash of key identifiers for deduplication
    
    -- Actual data
    raw_data JSONB NOT NULL,
    processed_data JSONB DEFAULT '{}', -- Cleaned/normalized version
    metadata JSONB DEFAULT '{}', -- Source-specific metadata
    
    -- Sharing controls
    sharing_level TEXT DEFAULT 'workspace' CHECK (sharing_level IN ('private', 'team', 'workspace', 'public')),
    shared_with_users UUID[] DEFAULT '{}', -- Specific user IDs if sharing_level = 'team'
    
    -- Data quality and validation
    data_quality_score DECIMAL(3,2) CHECK (data_quality_score >= 0 AND data_quality_score <= 1),
    validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validated', 'flagged', 'rejected')),
    validation_errors TEXT[],
    
    -- Usage tracking
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    last_accessed_by UUID REFERENCES users(id),
    
    -- Lifecycle
    expires_at TIMESTAMPTZ, -- Data expiration (e.g., for trial accounts)
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate data
    UNIQUE(workspace_id, data_source, entity_hash)
);

-- 2. Data sharing preferences per workspace member
CREATE TABLE IF NOT EXISTS workspace_data_sharing_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Auto-sharing preferences
    auto_share_unipile BOOLEAN DEFAULT true,
    auto_share_brightdata BOOLEAN DEFAULT true,
    auto_share_apollo BOOLEAN DEFAULT false, -- User's own Apollo data
    auto_share_manual BOOLEAN DEFAULT false, -- Manually entered data
    
    -- Default sharing level for this user's contributions
    default_sharing_level TEXT DEFAULT 'workspace' CHECK (default_sharing_level IN ('private', 'team', 'workspace')),
    
    -- Access preferences
    can_access_others_unipile BOOLEAN DEFAULT true,
    can_access_others_brightdata BOOLEAN DEFAULT true,
    can_access_others_apollo BOOLEAN DEFAULT true,
    can_access_others_manual BOOLEAN DEFAULT false,
    
    -- Notification preferences
    notify_on_new_shared_data BOOLEAN DEFAULT true,
    notify_on_data_quality_issues BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workspace_id, user_id)
);

-- 3. Data usage tracking
CREATE TABLE IF NOT EXISTS workspace_data_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    shared_data_id UUID NOT NULL REFERENCES workspace_shared_data(id) ON DELETE CASCADE,
    used_by UUID NOT NULL REFERENCES users(id),
    
    -- Usage context
    usage_context TEXT NOT NULL CHECK (usage_context IN ('prospect_enrichment', 'campaign_targeting', 'list_building', 'research', 'export')),
    usage_description TEXT,
    
    -- Value tracking
    value_generated TEXT CHECK (value_generated IN ('lead_created', 'contact_made', 'meeting_booked', 'deal_created', 'no_value')),
    notes TEXT,
    
    used_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Data quality scoring system
CREATE TABLE IF NOT EXISTS workspace_data_quality_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Quality rule definition
    rule_name TEXT NOT NULL,
    rule_description TEXT,
    data_type TEXT NOT NULL CHECK (data_type IN ('prospect', 'company', 'contact_list', 'enrichment')),
    
    -- Rule logic
    required_fields TEXT[] DEFAULT '{}',
    validation_regex JSONB DEFAULT '{}', -- Field -> regex mapping
    scoring_weights JSONB DEFAULT '{}', -- Field -> weight mapping
    
    -- Rule status
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_shared_data_workspace ON workspace_shared_data(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_shared_data_contributor ON workspace_shared_data(contributed_by);
CREATE INDEX IF NOT EXISTS idx_workspace_shared_data_source ON workspace_shared_data(data_source);
CREATE INDEX IF NOT EXISTS idx_workspace_shared_data_type ON workspace_shared_data(data_type);
CREATE INDEX IF NOT EXISTS idx_workspace_shared_data_hash ON workspace_shared_data(workspace_id, entity_hash);
CREATE INDEX IF NOT EXISTS idx_workspace_shared_data_sharing ON workspace_shared_data(workspace_id, sharing_level) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workspace_shared_data_quality ON workspace_shared_data(data_quality_score) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_workspace_data_preferences_user ON workspace_data_sharing_preferences(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_data_usage_shared_data ON workspace_data_usage(shared_data_id);
CREATE INDEX IF NOT EXISTS idx_workspace_data_usage_user ON workspace_data_usage(used_by, used_at);

-- Enable RLS
ALTER TABLE workspace_shared_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_data_sharing_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_data_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_data_quality_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can access shared data in their workspace based on sharing level" ON workspace_shared_data
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = 
            (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
        ) AND (
            sharing_level = 'workspace' OR
            sharing_level = 'public' OR
            contributed_by = (SELECT id FROM users WHERE clerk_id = auth.uid()::text) OR
            (sharing_level = 'team' AND (SELECT id FROM users WHERE clerk_id = auth.uid()::text) = ANY(shared_with_users))
        )
    );

CREATE POLICY "Users can manage their own shared data" ON workspace_shared_data
    FOR ALL USING (
        contributed_by = (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
    );

CREATE POLICY "Users can manage their sharing preferences" ON workspace_data_sharing_preferences
    FOR ALL USING (
        user_id = (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
    );

CREATE POLICY "Users can view their usage tracking" ON workspace_data_usage
    FOR ALL USING (
        used_by = (SELECT id FROM users WHERE clerk_id = auth.uid()::text) OR
        EXISTS (
            SELECT 1 FROM workspace_shared_data wsd 
            WHERE wsd.id = shared_data_id 
            AND wsd.contributed_by = (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
        )
    );

-- Functions for data sharing

-- Function to auto-share data when pulled from external sources
CREATE OR REPLACE FUNCTION auto_share_external_data(
    p_workspace_id UUID,
    p_user_id UUID,
    p_data_source TEXT,
    p_raw_data JSONB,
    p_data_type TEXT DEFAULT 'prospect',
    p_source_account_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shared_data_id UUID;
    v_sharing_level TEXT;
    v_should_share BOOLEAN := false;
    v_entity_hash TEXT;
    v_quality_score DECIMAL(3,2);
BEGIN
    -- Check user's sharing preferences
    SELECT 
        CASE 
            WHEN p_data_source = 'unipile' THEN auto_share_unipile
            WHEN p_data_source = 'brightdata' THEN auto_share_brightdata
            WHEN p_data_source = 'apollo' THEN auto_share_apollo
            ELSE auto_share_manual
        END,
        default_sharing_level
    INTO v_should_share, v_sharing_level
    FROM workspace_data_sharing_preferences
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
    
    -- Default to workspace sharing if no preferences set
    IF v_sharing_level IS NULL THEN
        v_sharing_level := 'workspace';
        v_should_share := CASE 
            WHEN p_data_source IN ('unipile', 'brightdata') THEN true 
            ELSE false 
        END;
    END IF;
    
    -- Only proceed if user wants to share this type of data
    IF NOT v_should_share THEN
        RETURN NULL;
    END IF;
    
    -- Generate entity hash for deduplication
    v_entity_hash := encode(
        digest(
            COALESCE(p_raw_data->>'email', '') || '|' ||
            COALESCE(p_raw_data->>'linkedin_url', '') || '|' ||
            COALESCE(p_raw_data->>'company_domain', '') || '|' ||
            COALESCE(p_raw_data->>'phone', ''),
            'sha256'
        ),
        'hex'
    );
    
    -- Calculate basic data quality score
    v_quality_score := (
        CASE WHEN p_raw_data->>'email' IS NOT NULL AND p_raw_data->>'email' ~ '^[^@]+@[^@]+\.[^@]+$' THEN 0.25 ELSE 0 END +
        CASE WHEN p_raw_data->>'linkedin_url' IS NOT NULL THEN 0.25 ELSE 0 END +
        CASE WHEN p_raw_data->>'company_name' IS NOT NULL THEN 0.25 ELSE 0 END +
        CASE WHEN p_raw_data->>'full_name' IS NOT NULL THEN 0.25 ELSE 0 END
    );
    
    -- Insert or update shared data
    INSERT INTO workspace_shared_data (
        workspace_id,
        contributed_by,
        data_source,
        data_source_account,
        data_type,
        entity_hash,
        raw_data,
        sharing_level,
        data_quality_score
    ) VALUES (
        p_workspace_id,
        p_user_id,
        p_data_source,
        p_source_account_id,
        p_data_type,
        v_entity_hash,
        p_raw_data,
        v_sharing_level,
        v_quality_score
    )
    ON CONFLICT (workspace_id, data_source, entity_hash)
    DO UPDATE SET
        raw_data = EXCLUDED.raw_data,
        data_quality_score = EXCLUDED.data_quality_score,
        updated_at = NOW()
    RETURNING id INTO v_shared_data_id;
    
    RETURN v_shared_data_id;
END;
$$;

-- Function to get available shared data for a user
CREATE OR REPLACE FUNCTION get_shared_data_for_user(
    p_workspace_id UUID,
    p_user_id UUID,
    p_data_source TEXT DEFAULT NULL,
    p_data_type TEXT DEFAULT NULL,
    p_min_quality_score DECIMAL DEFAULT 0.5,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    data_source TEXT,
    data_type TEXT,
    raw_data JSONB,
    data_quality_score DECIMAL,
    contributed_by_name TEXT,
    created_at TIMESTAMPTZ,
    can_access BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wsd.id,
        wsd.data_source,
        wsd.data_type,
        wsd.raw_data,
        wsd.data_quality_score,
        u.first_name || ' ' || u.last_name as contributed_by_name,
        wsd.created_at,
        CASE
            WHEN wsd.sharing_level = 'workspace' THEN true
            WHEN wsd.sharing_level = 'public' THEN true
            WHEN wsd.contributed_by = p_user_id THEN true
            WHEN wsd.sharing_level = 'team' AND p_user_id = ANY(wsd.shared_with_users) THEN true
            ELSE false
        END as can_access
    FROM workspace_shared_data wsd
    JOIN users u ON wsd.contributed_by = u.id
    JOIN workspace_data_sharing_preferences wdsp ON (
        wdsp.workspace_id = p_workspace_id 
        AND wdsp.user_id = p_user_id
        AND (
            (wsd.data_source = 'unipile' AND wdsp.can_access_others_unipile) OR
            (wsd.data_source = 'brightdata' AND wdsp.can_access_others_brightdata) OR
            (wsd.data_source = 'apollo' AND wdsp.can_access_others_apollo) OR
            (wsd.data_source NOT IN ('unipile', 'brightdata', 'apollo') AND wdsp.can_access_others_manual) OR
            wsd.contributed_by = p_user_id
        )
    )
    WHERE wsd.workspace_id = p_workspace_id
      AND wsd.is_active = true
      AND wsd.data_quality_score >= p_min_quality_score
      AND (p_data_source IS NULL OR wsd.data_source = p_data_source)
      AND (p_data_type IS NULL OR wsd.data_type = p_data_type)
      AND (
          wsd.sharing_level IN ('workspace', 'public') OR
          wsd.contributed_by = p_user_id OR
          (wsd.sharing_level = 'team' AND p_user_id = ANY(wsd.shared_with_users))
      )
    ORDER BY wsd.data_quality_score DESC, wsd.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Function to track data usage
CREATE OR REPLACE FUNCTION track_data_usage(
    p_shared_data_id UUID,
    p_user_id UUID,
    p_usage_context TEXT,
    p_usage_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Record usage
    INSERT INTO workspace_data_usage (
        workspace_id,
        shared_data_id,
        used_by,
        usage_context,
        usage_description
    )
    SELECT 
        wsd.workspace_id,
        p_shared_data_id,
        p_user_id,
        p_usage_context,
        p_usage_description
    FROM workspace_shared_data wsd
    WHERE wsd.id = p_shared_data_id;
    
    -- Update access tracking
    UPDATE workspace_shared_data
    SET 
        access_count = access_count + 1,
        last_accessed_at = NOW(),
        last_accessed_by = p_user_id
    WHERE id = p_shared_data_id;
    
    RETURN FOUND;
END;
$$;

-- View for workspace data sharing dashboard
CREATE OR REPLACE VIEW workspace_data_sharing_dashboard AS
SELECT 
    wsd.workspace_id,
    wsd.data_source,
    COUNT(*) as total_records,
    AVG(wsd.data_quality_score) as avg_quality_score,
    COUNT(DISTINCT wsd.contributed_by) as contributing_users,
    SUM(wsd.access_count) as total_accesses,
    MAX(wsd.created_at) as latest_contribution,
    COUNT(*) FILTER (WHERE wsd.created_at >= NOW() - INTERVAL '7 days') as records_this_week,
    COUNT(*) FILTER (WHERE wsd.last_accessed_at >= NOW() - INTERVAL '7 days') as accessed_this_week
FROM workspace_shared_data wsd
WHERE wsd.is_active = true
GROUP BY wsd.workspace_id, wsd.data_source;

-- Comments
COMMENT ON TABLE workspace_shared_data IS 'Centralized pool of data from all team members Unipile/BrightData accounts';
COMMENT ON TABLE workspace_data_sharing_preferences IS 'Per-user preferences for automatic data sharing and access';
COMMENT ON TABLE workspace_data_usage IS 'Tracks how shared data is being used across the workspace';
COMMENT ON FUNCTION auto_share_external_data IS 'Automatically shares data when pulled from external sources based on user preferences';
COMMENT ON FUNCTION get_shared_data_for_user IS 'Returns available shared data for a user based on permissions and preferences';
COMMENT ON FUNCTION track_data_usage IS 'Records data usage for analytics and value tracking';