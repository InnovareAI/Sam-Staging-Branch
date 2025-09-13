-- Prospect Approval System Database Schema
-- Creates tables for the complete prospect approval and learning system

-- 1. Prospect Approval Sessions
-- Tracks approval sessions with ICP criteria and learning insights
CREATE TABLE IF NOT EXISTS prospect_approval_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
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

-- 2. Prospect Approval Data
-- Stores enriched prospect data from Unipile for approval decisions
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

-- 3. Prospect Approval Decisions
-- Immutable decisions made by users (approved/rejected with audit trail)
CREATE TABLE IF NOT EXISTS prospect_approval_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES prospect_approval_sessions(id) ON DELETE CASCADE,
    prospect_id TEXT NOT NULL,
    
    -- Decision details
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
    reason TEXT, -- Optional reason for decision
    
    -- Audit trail
    decided_by TEXT NOT NULL,
    decided_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_immutable BOOLEAN DEFAULT TRUE,
    
    -- Unique constraint - one decision per prospect per session
    UNIQUE(session_id, prospect_id)
);

-- 4. Prospect Learning Logs
-- Detailed logs for SAM AI learning algorithm
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

-- 5. Prospect Exports
-- Final approved prospect lists for user download/use
CREATE TABLE IF NOT EXISTS prospect_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES prospect_approval_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    
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

-- 6. SAM AI Learning Models
-- Stores learned preferences and optimization data
CREATE TABLE IF NOT EXISTS sam_learning_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    
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

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_prospect_sessions_user_workspace ON prospect_approval_sessions(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_prospect_sessions_status ON prospect_approval_sessions(status);
CREATE INDEX IF NOT EXISTS idx_prospect_data_session ON prospect_approval_data(session_id);
CREATE INDEX IF NOT EXISTS idx_prospect_decisions_session ON prospect_approval_decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_prospect_learning_session ON prospect_learning_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_prospect_exports_user ON prospect_exports(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_sam_learning_user ON sam_learning_models(user_id, workspace_id);

-- Create updated_at trigger for sam_learning_models
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

-- Sample data for testing (optional)
/*
INSERT INTO prospect_approval_sessions (batch_number, user_id, workspace_id, icp_criteria) 
VALUES (1, 'test-user', 'test-workspace', '{"job_titles": ["VP Sales", "Sales Director"], "industries": ["SaaS", "Technology"]}');
*/