-- =============================================
-- Data Approval Systems Schema
-- =============================================
-- Supports both ICP approval (in chat) and Data Approval System (dashboard)

-- ICP Approval Sessions (Chat-based approval for 20-30 datasets)
CREATE TABLE IF NOT EXISTS icp_approval_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id text UNIQUE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- ICP Data
    icp_data jsonb NOT NULL, -- Complete ICP data including prospects
    chat_context jsonb, -- Chat conversation context
    icp_name text,
    
    -- Approval Status
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'partial')),
    approved_count integer DEFAULT 0,
    rejected_count integer DEFAULT 0,
    total_count integer NOT NULL DEFAULT 0,
    
    -- Data Source & Quotas
    data_source text NOT NULL DEFAULT 'google_api' CHECK (data_source IN ('google_api', 'manual', 'imported')),
    quota_used integer DEFAULT 0,
    quota_limit integer DEFAULT 30, -- ICP building limit
    
    -- Timestamps
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    approved_at timestamp with time zone,
    completed_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT timezone('utc'::text, now() + interval '24 hours'),
    
    -- Metadata
    approval_notes text,
    auto_approved boolean DEFAULT false
);

-- Individual ICP Prospect Decisions
CREATE TABLE IF NOT EXISTS icp_prospect_decisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id text REFERENCES icp_approval_sessions(session_id) ON DELETE CASCADE,
    prospect_index integer NOT NULL,
    prospect_data jsonb NOT NULL,
    
    -- Decision
    decision text NOT NULL CHECK (decision IN ('approved', 'rejected', 'pending')),
    decision_reason text,
    decision_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    
    -- Metadata
    confidence_score numeric(3,2),
    data_quality_score numeric(3,2),
    auto_decision boolean DEFAULT false,
    
    UNIQUE(session_id, prospect_index)
);

-- Data Approval System (Dashboard-based approval for larger datasets up to 1000)
CREATE TABLE IF NOT EXISTS data_approval_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id text UNIQUE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Dataset Information
    dataset_name text NOT NULL,
    dataset_type text NOT NULL CHECK (dataset_type IN ('campaign', 'prospect_list', 'lead_import', 'enrichment')),
    dataset_source text NOT NULL CHECK (dataset_source IN ('unipile_linkedin', 'bright_data', 'apollo_api', 'csv_upload', 'google_sheets')),
    
    -- Dataset Content
    raw_data jsonb NOT NULL, -- Original dataset
    processed_data jsonb, -- Cleaned/enriched data
    data_preview jsonb, -- First 10 records for preview
    
    -- Approval Status
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'expired')),
    approved_count integer DEFAULT 0,
    rejected_count integer DEFAULT 0,
    total_count integer NOT NULL,
    
    -- Quality Metrics
    data_quality_score numeric(3,2),
    completeness_score numeric(3,2),
    accuracy_score numeric(3,2),
    duplicate_count integer DEFAULT 0,
    
    -- Quotas & Limits
    quota_used integer DEFAULT 0,
    quota_limit integer DEFAULT 1000, -- Large dataset limit
    cost_estimate numeric(10,2),
    
    -- Processing Info
    processing_started_at timestamp with time zone,
    processing_completed_at timestamp with time zone,
    processing_error text,
    
    -- Timestamps
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    approved_at timestamp with time zone,
    rejected_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT timezone('utc'::text, now() + interval '72 hours'), -- 3 days for large datasets
    
    -- Approval Details
    approval_notes text,
    rejection_reason text,
    approved_by uuid REFERENCES auth.users(id),
    auto_approved boolean DEFAULT false
);

-- Individual Record Decisions for Large Datasets
CREATE TABLE IF NOT EXISTS data_record_decisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id text REFERENCES data_approval_sessions(session_id) ON DELETE CASCADE,
    record_index integer NOT NULL,
    record_data jsonb NOT NULL,
    
    -- Decision
    decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('approved', 'rejected', 'flagged', 'pending')),
    decision_reason text,
    decision_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    flagged_issues jsonb, -- Array of quality issues
    
    -- Quality Metrics
    confidence_score numeric(3,2),
    data_quality_score numeric(3,2),
    completeness_score numeric(3,2),
    
    -- Metadata
    auto_decision boolean DEFAULT false,
    requires_review boolean DEFAULT false,
    
    UNIQUE(session_id, record_index)
);

-- Approval Templates for Common Decisions
CREATE TABLE IF NOT EXISTS approval_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Template Info
    template_name text NOT NULL,
    template_type text NOT NULL CHECK (template_type IN ('icp', 'campaign', 'quality_rules')),
    
    -- Template Content
    criteria jsonb NOT NULL, -- Approval criteria
    auto_rules jsonb, -- Automatic approval/rejection rules
    
    -- Usage Stats
    usage_count integer DEFAULT 0,
    success_rate numeric(3,2),
    
    -- Status
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    
    -- Timestamps
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Quota Tracking and Management
CREATE TABLE IF NOT EXISTS approval_quotas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Quota Types
    quota_type text NOT NULL CHECK (quota_type IN ('icp_building', 'campaign_data', 'api_calls', 'storage')),
    
    -- Limits and Usage
    monthly_limit integer NOT NULL,
    current_usage integer DEFAULT 0,
    
    -- Period Tracking
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    
    -- Status
    is_active boolean DEFAULT true,
    warning_threshold numeric(3,2) DEFAULT 0.8, -- Warn at 80%
    
    -- Timestamps
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    UNIQUE(user_id, workspace_id, quota_type, period_start)
);

-- Approval Analytics and Learning
CREATE TABLE IF NOT EXISTS approval_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Session Reference
    session_id text NOT NULL,
    session_type text NOT NULL CHECK (session_type IN ('icp', 'campaign')),
    
    -- Analytics Data
    total_records integer NOT NULL,
    approved_records integer NOT NULL,
    rejected_records integer NOT NULL,
    
    -- Quality Metrics
    avg_quality_score numeric(3,2),
    processing_time_seconds integer,
    user_satisfaction_score numeric(2,1), -- 1-5 rating
    
    -- Patterns
    approval_patterns jsonb, -- Common approval patterns
    rejection_reasons jsonb, -- Common rejection reasons
    
    -- Timestamps
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- Indexes for Performance
-- =============================================

-- ICP Approval Sessions
CREATE INDEX IF NOT EXISTS idx_icp_approval_sessions_user_id ON icp_approval_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_icp_approval_sessions_status ON icp_approval_sessions(status);
CREATE INDEX IF NOT EXISTS idx_icp_approval_sessions_created_at ON icp_approval_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_icp_approval_sessions_expires_at ON icp_approval_sessions(expires_at);

-- ICP Prospect Decisions
CREATE INDEX IF NOT EXISTS idx_icp_prospect_decisions_session_id ON icp_prospect_decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_icp_prospect_decisions_decision ON icp_prospect_decisions(decision);

-- Data Approval Sessions
CREATE INDEX IF NOT EXISTS idx_data_approval_sessions_user_id ON data_approval_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_data_approval_sessions_status ON data_approval_sessions(status);
CREATE INDEX IF NOT EXISTS idx_data_approval_sessions_type ON data_approval_sessions(dataset_type);
CREATE INDEX IF NOT EXISTS idx_data_approval_sessions_created_at ON data_approval_sessions(created_at DESC);

-- Data Record Decisions
CREATE INDEX IF NOT EXISTS idx_data_record_decisions_session_id ON data_record_decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_data_record_decisions_decision ON data_record_decisions(decision);

-- Approval Quotas
CREATE INDEX IF NOT EXISTS idx_approval_quotas_user_workspace ON approval_quotas(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_approval_quotas_type_period ON approval_quotas(quota_type, period_start);

-- =============================================
-- Row Level Security (RLS)
-- =============================================

ALTER TABLE icp_approval_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE icp_prospect_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_approval_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_record_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Users can only access their own approval sessions)
CREATE POLICY "Users can access their own ICP approval sessions" ON icp_approval_sessions
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can access their own prospect decisions" ON icp_prospect_decisions
    FOR ALL USING (
        session_id IN (
            SELECT session_id FROM icp_approval_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can access their own data approval sessions" ON data_approval_sessions
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can access their own record decisions" ON data_record_decisions
    FOR ALL USING (
        session_id IN (
            SELECT session_id FROM data_approval_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can access their own approval templates" ON approval_templates
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can access their own approval quotas" ON approval_quotas
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can access their own approval analytics" ON approval_analytics
    FOR ALL USING (user_id = auth.uid());

-- =============================================
-- Functions for Quota Management
-- =============================================

-- Check if user has quota available
CREATE OR REPLACE FUNCTION check_approval_quota(
    p_user_id uuid,
    p_workspace_id uuid,
    p_quota_type text,
    p_requested_amount integer DEFAULT 1
) RETURNS jsonb AS $$
DECLARE
    current_period_start timestamp with time zone;
    current_period_end timestamp with time zone;
    quota_record record;
    available_quota integer;
BEGIN
    -- Calculate current month period
    current_period_start := date_trunc('month', timezone('utc', now()));
    current_period_end := current_period_start + interval '1 month';
    
    -- Get or create quota record
    SELECT * INTO quota_record
    FROM approval_quotas
    WHERE user_id = p_user_id 
        AND workspace_id = p_workspace_id
        AND quota_type = p_quota_type
        AND period_start = current_period_start;
    
    -- If no quota record exists, create default
    IF quota_record IS NULL THEN
        INSERT INTO approval_quotas (
            user_id, workspace_id, quota_type,
            monthly_limit, period_start, period_end
        ) VALUES (
            p_user_id, p_workspace_id, p_quota_type,
            CASE p_quota_type
                WHEN 'icp_building' THEN 30
                WHEN 'campaign_data' THEN 1000
                ELSE 100
            END,
            current_period_start, current_period_end
        ) RETURNING * INTO quota_record;
    END IF;
    
    available_quota := quota_record.monthly_limit - quota_record.current_usage;
    
    RETURN jsonb_build_object(
        'has_quota', available_quota >= p_requested_amount,
        'available', available_quota,
        'limit', quota_record.monthly_limit,
        'used', quota_record.current_usage,
        'requested', p_requested_amount,
        'warning_threshold_reached', quota_record.current_usage::numeric / quota_record.monthly_limit >= quota_record.warning_threshold
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Consume quota
CREATE OR REPLACE FUNCTION consume_approval_quota(
    p_user_id uuid,
    p_workspace_id uuid,
    p_quota_type text,
    p_amount integer DEFAULT 1
) RETURNS boolean AS $$
DECLARE
    quota_check jsonb;
    current_period_start timestamp with time zone;
BEGIN
    -- Check quota availability
    quota_check := check_approval_quota(p_user_id, p_workspace_id, p_quota_type, p_amount);
    
    IF NOT (quota_check->>'has_quota')::boolean THEN
        RETURN false;
    END IF;
    
    -- Consume quota
    current_period_start := date_trunc('month', timezone('utc', now()));
    
    UPDATE approval_quotas
    SET current_usage = current_usage + p_amount,
        updated_at = timezone('utc', now())
    WHERE user_id = p_user_id 
        AND workspace_id = p_workspace_id
        AND quota_type = p_quota_type
        AND period_start = current_period_start;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;