-- =====================================================
-- V1 CAMPAIGN ORCHESTRATION TABLES
-- Create missing workspace_tiers and HITL tables
-- =====================================================

-- Create workspace_tiers table
CREATE TABLE IF NOT EXISTS workspace_tiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Service tier configuration
    tier TEXT NOT NULL CHECK (tier IN ('startup', 'sme', 'enterprise')),
    tier_status TEXT NOT NULL DEFAULT 'active' CHECK (tier_status IN ('active', 'suspended', 'cancelled')),
    
    -- Feature limits per tier
    monthly_email_limit INTEGER NOT NULL DEFAULT 1000,
    monthly_linkedin_limit INTEGER NOT NULL DEFAULT 100,
    daily_email_limit INTEGER,
    daily_linkedin_limit INTEGER,
    hitl_approval_required BOOLEAN DEFAULT true,
    
    -- Integration configuration
    integration_config JSONB DEFAULT '{}',
    tier_features JSONB DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(workspace_id)
);

-- Create HITL approval sessions table
CREATE TABLE IF NOT EXISTS hitl_reply_approval_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_execution_id uuid, -- References n8n_campaign_executions(id) when that table exists
    
    -- Original message details
    original_message_id TEXT NOT NULL,
    original_message_content TEXT NOT NULL,
    original_message_channel TEXT NOT NULL CHECK (original_message_channel IN ('email', 'linkedin')),
    
    -- Prospect information
    prospect_name TEXT,
    prospect_email TEXT,
    prospect_linkedin_url TEXT,
    prospect_company TEXT,
    
    -- SAM's suggested response
    sam_suggested_reply TEXT NOT NULL,
    sam_confidence_score DECIMAL(3,2) CHECK (sam_confidence_score >= 0 AND sam_confidence_score <= 1),
    sam_reasoning TEXT,
    
    -- Approval workflow
    approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'expired')),
    assigned_to_email TEXT NOT NULL,
    assigned_to TEXT, -- User ID who should approve
    
    -- Decision details
    reviewed_by TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    final_message TEXT,
    rejection_reason TEXT,
    
    -- Email tracking
    approval_email_sent_at TIMESTAMP WITH TIME ZONE,
    approval_email_opened_at TIMESTAMP WITH TIME ZONE,
    
    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    timeout_hours INTEGER DEFAULT 24,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE workspace_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_reply_approval_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for workspace_tiers
CREATE POLICY "workspace_tiers_select_policy" ON workspace_tiers
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "workspace_tiers_insert_policy" ON workspace_tiers
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "workspace_tiers_update_policy" ON workspace_tiers
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "workspace_tiers_delete_policy" ON workspace_tiers
    FOR DELETE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Create RLS policies for HITL sessions
CREATE POLICY "hitl_sessions_select_policy" ON hitl_reply_approval_sessions
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "hitl_sessions_insert_policy" ON hitl_reply_approval_sessions
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "hitl_sessions_update_policy" ON hitl_reply_approval_sessions
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "hitl_sessions_delete_policy" ON hitl_reply_approval_sessions
    FOR DELETE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workspace_tiers_workspace_id ON workspace_tiers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_tiers_tier ON workspace_tiers(tier);

CREATE INDEX IF NOT EXISTS idx_hitl_sessions_workspace_id ON hitl_reply_approval_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_hitl_sessions_status ON hitl_reply_approval_sessions(approval_status);
CREATE INDEX IF NOT EXISTS idx_hitl_sessions_assigned_to ON hitl_reply_approval_sessions(assigned_to_email);
CREATE INDEX IF NOT EXISTS idx_hitl_sessions_expires_at ON hitl_reply_approval_sessions(expires_at);

-- Insert default tier for existing workspaces (optional)
INSERT INTO workspace_tiers (workspace_id, tier, monthly_email_limit, monthly_linkedin_limit, daily_email_limit, daily_linkedin_limit)
SELECT 
    id as workspace_id,
    'startup' as tier,
    200 as monthly_email_limit,
    50 as monthly_linkedin_limit,
    7 as daily_email_limit,
    2 as daily_linkedin_limit
FROM workspaces 
WHERE id NOT IN (SELECT workspace_id FROM workspace_tiers)
ON CONFLICT (workspace_id) DO NOTHING;