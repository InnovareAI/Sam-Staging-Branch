-- Prospect Approval System Database Schema (CORRECTED)
-- Fixes: UUID types, organization_id column, RLS policies, foreign keys

-- ================================================================
-- 1. PROSPECT APPROVAL SESSIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS prospect_approval_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number INTEGER NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),

    -- Prospect counts
    total_prospects INTEGER NOT NULL DEFAULT 0,
    approved_count INTEGER NOT NULL DEFAULT 0,
    rejected_count INTEGER NOT NULL DEFAULT 0,
    pending_count INTEGER NOT NULL DEFAULT 0,

    -- ICP criteria used for this session
    icp_criteria JSONB NOT NULL DEFAULT '{}',

    -- Source of prospects (for tracking)
    prospect_source TEXT DEFAULT 'unipile_linkedin_search',

    -- Learning insights generated after completion
    learning_insights JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Indexes for efficient queries
    UNIQUE(user_id, workspace_id, batch_number)
);

-- ================================================================
-- 2. PROSPECT APPROVAL DATA
-- ================================================================
CREATE TABLE IF NOT EXISTS prospect_approval_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES prospect_approval_sessions(id) ON DELETE CASCADE,
    prospect_id TEXT NOT NULL, -- External ID from Unipile

    -- Basic prospect information
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT,
    profile_image TEXT,
    recent_activity TEXT,

    -- Company information (JSONB for flexibility)
    company JSONB NOT NULL DEFAULT '{}', -- {name, size, industry, website, etc.}

    -- Contact information (JSONB for flexibility)
    contact JSONB NOT NULL DEFAULT '{}', -- {email, phone, linkedin_url, etc.}

    -- Enrichment metadata
    connection_degree INTEGER DEFAULT 0,
    enrichment_score INTEGER DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'unipile_linkedin_search',
    enriched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint to prevent duplicate prospects per session
    UNIQUE(session_id, prospect_id)
);

-- ================================================================
-- 3. PROSPECT APPROVAL DECISIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS prospect_approval_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES prospect_approval_sessions(id) ON DELETE CASCADE,
    prospect_id TEXT NOT NULL,

    -- Decision details
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
    reason TEXT, -- Optional reason for decision

    -- Audit trail
    decided_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    decided_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_immutable BOOLEAN DEFAULT TRUE,

    -- Unique constraint - one decision per prospect per session
    UNIQUE(session_id, prospect_id)
);

-- ================================================================
-- 4. PROSPECT LEARNING LOGS
-- ================================================================
CREATE TABLE IF NOT EXISTS prospect_learning_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES prospect_approval_sessions(id) ON DELETE CASCADE,
    prospect_id TEXT NOT NULL,

    -- Decision information
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
    reason TEXT,

    -- Prospect characteristics for learning
    prospect_title TEXT,
    company_size TEXT,
    company_industry TEXT,
    connection_degree INTEGER,
    enrichment_score INTEGER,
    has_email BOOLEAN DEFAULT FALSE,
    has_phone BOOLEAN DEFAULT FALSE,

    -- Additional learning features (extensible JSONB)
    learning_features JSONB DEFAULT '{}',

    -- Timestamps
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- 5. PROSPECT EXPORTS
-- ================================================================
CREATE TABLE IF NOT EXISTS prospect_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES prospect_approval_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Export details
    prospect_count INTEGER NOT NULL DEFAULT 0,
    export_data JSONB NOT NULL DEFAULT '[]', -- Array of approved prospect objects
    export_format TEXT DEFAULT 'json' CHECK (export_format IN ('json', 'csv', 'google_sheets')),

    -- External sharing (if applicable)
    share_url TEXT,
    google_sheets_url TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE -- Optional expiration for shared links
);

-- ================================================================
-- 6. SAM AI LEARNING MODELS
-- ================================================================
CREATE TABLE IF NOT EXISTS sam_learning_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Model version and type
    model_version INTEGER DEFAULT 1,
    model_type TEXT DEFAULT 'prospect_approval' CHECK (model_type IN ('prospect_approval', 'icp_optimization')),

    -- Learned preferences and weights
    learned_preferences JSONB NOT NULL DEFAULT '{}',
    feature_weights JSONB DEFAULT '{}',

    -- Model performance metrics
    accuracy_score REAL DEFAULT 0.0,
    sessions_trained_on INTEGER DEFAULT 0,
    last_training_session UUID REFERENCES prospect_approval_sessions(id),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint per user/workspace
    UNIQUE(user_id, workspace_id, model_type)
);

-- ================================================================
-- INDEXES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_prospect_sessions_user_workspace ON prospect_approval_sessions(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_prospect_sessions_org ON prospect_approval_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_prospect_sessions_status ON prospect_approval_sessions(status);
CREATE INDEX IF NOT EXISTS idx_prospect_data_session ON prospect_approval_data(session_id);
CREATE INDEX IF NOT EXISTS idx_prospect_decisions_session ON prospect_approval_decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_prospect_learning_session ON prospect_learning_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_prospect_exports_user ON prospect_exports(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_sam_learning_user ON sam_learning_models(user_id, workspace_id);

-- ================================================================
-- TRIGGERS
-- ================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sam_learning_models_updated_at
    BEFORE UPDATE ON sam_learning_models
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- RLS POLICIES (CRITICAL FOR MULTI-TENANT SECURITY)
-- ================================================================

-- Enable RLS on all tables
ALTER TABLE prospect_approval_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_approval_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_learning_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_learning_models ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- RLS POLICY: prospect_approval_sessions
-- ================================================================
-- Users can only see sessions in their workspace
CREATE POLICY "Users can view their workspace sessions"
    ON prospect_approval_sessions FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Users can create sessions in their workspace
CREATE POLICY "Users can create sessions in their workspace"
    ON prospect_approval_sessions FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- Users can update their own sessions in their workspace
CREATE POLICY "Users can update their workspace sessions"
    ON prospect_approval_sessions FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ================================================================
-- RLS POLICY: prospect_approval_data
-- ================================================================
-- Users can only see prospect data for their workspace sessions
CREATE POLICY "Users can view prospect data in their workspace"
    ON prospect_approval_data FOR SELECT
    USING (
        session_id IN (
            SELECT id FROM prospect_approval_sessions
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- Users can insert prospect data into their workspace sessions
CREATE POLICY "Users can insert prospect data in their workspace"
    ON prospect_approval_data FOR INSERT
    WITH CHECK (
        session_id IN (
            SELECT id FROM prospect_approval_sessions
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- ================================================================
-- RLS POLICY: prospect_approval_decisions
-- ================================================================
-- Users can view decisions in their workspace
CREATE POLICY "Users can view decisions in their workspace"
    ON prospect_approval_decisions FOR SELECT
    USING (
        session_id IN (
            SELECT id FROM prospect_approval_sessions
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- Users can create decisions in their workspace (immutable after creation)
CREATE POLICY "Users can create decisions in their workspace"
    ON prospect_approval_decisions FOR INSERT
    WITH CHECK (
        session_id IN (
            SELECT id FROM prospect_approval_sessions
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid()
            )
        )
        AND decided_by = auth.uid()
    );

-- ================================================================
-- RLS POLICY: prospect_learning_logs
-- ================================================================
-- Users can view learning logs in their workspace
CREATE POLICY "Users can view learning logs in their workspace"
    ON prospect_learning_logs FOR SELECT
    USING (
        session_id IN (
            SELECT id FROM prospect_approval_sessions
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- Users can insert learning logs in their workspace
CREATE POLICY "Users can insert learning logs in their workspace"
    ON prospect_learning_logs FOR INSERT
    WITH CHECK (
        session_id IN (
            SELECT id FROM prospect_approval_sessions
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- ================================================================
-- RLS POLICY: prospect_exports
-- ================================================================
-- Users can only view their own exports in their workspace
CREATE POLICY "Users can view their exports in their workspace"
    ON prospect_exports FOR SELECT
    USING (
        user_id = auth.uid()
        AND workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Users can create exports in their workspace
CREATE POLICY "Users can create exports in their workspace"
    ON prospect_exports FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ================================================================
-- RLS POLICY: sam_learning_models
-- ================================================================
-- Users can view learning models in their workspace
CREATE POLICY "Users can view learning models in their workspace"
    ON sam_learning_models FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Users can create/update learning models in their workspace
CREATE POLICY "Users can manage learning models in their workspace"
    ON sam_learning_models FOR ALL
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ================================================================
-- GRANT PERMISSIONS
-- ================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON prospect_approval_sessions TO authenticated;
GRANT ALL ON prospect_approval_data TO authenticated;
GRANT ALL ON prospect_approval_decisions TO authenticated;
GRANT ALL ON prospect_learning_logs TO authenticated;
GRANT ALL ON prospect_exports TO authenticated;
GRANT ALL ON sam_learning_models TO authenticated;
