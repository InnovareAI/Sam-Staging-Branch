-- =====================================================
-- SAM AI TENANT INTEGRATIONS DATABASE SCHEMA
-- Multi-tenant campaign orchestration via N8N
-- =====================================================

-- Workspace service tiers and integration configurations
CREATE TABLE workspace_tiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Service tier configuration
    tier_type TEXT NOT NULL CHECK (tier_type IN ('startup', 'sme', 'enterprise')),
    tier_status TEXT NOT NULL DEFAULT 'active' CHECK (tier_status IN ('active', 'suspended', 'cancelled')),
    
    -- Feature limits per tier
    monthly_email_limit INTEGER NOT NULL DEFAULT 1000,
    monthly_linkedin_limit INTEGER NOT NULL DEFAULT 100,
    max_campaigns INTEGER NOT NULL DEFAULT 5,
    max_team_members INTEGER NOT NULL DEFAULT 3,
    
    -- Billing information
    monthly_price_cents INTEGER NOT NULL DEFAULT 0,
    billing_cycle_start DATE,
    next_billing_date DATE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by uuid REFERENCES auth.users(id),
    
    UNIQUE(workspace_id)
);

-- Unipile integration configurations (separate instances per tenant)
CREATE TABLE workspace_unipile_integrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Unipile instance configuration
    unipile_instance_url TEXT NOT NULL, -- e.g., https://tenant-123.unipile.com
    unipile_api_key TEXT, -- Encrypted tenant-specific API key (optional)
    instance_status TEXT NOT NULL DEFAULT 'pending' CHECK (instance_status IN ('pending', 'active', 'error', 'suspended')),
    
    -- Connected accounts within this Unipile instance
    linkedin_accounts JSONB DEFAULT '[]'::jsonb, -- Array of LinkedIn account objects
    email_accounts JSONB DEFAULT '[]'::jsonb,    -- Array of email account objects
    
    -- Account limits and usage tracking
    linkedin_accounts_limit INTEGER NOT NULL DEFAULT 1,
    email_accounts_limit INTEGER NOT NULL DEFAULT 3,
    
    -- Rate limiting configuration
    linkedin_daily_limit INTEGER NOT NULL DEFAULT 50,
    linkedin_hourly_limit INTEGER NOT NULL DEFAULT 10,
    email_daily_limit INTEGER NOT NULL DEFAULT 200,
    email_hourly_limit INTEGER NOT NULL DEFAULT 50,
    
    -- Current usage (reset daily/hourly)
    linkedin_daily_usage INTEGER DEFAULT 0,
    linkedin_hourly_usage INTEGER DEFAULT 0,
    email_daily_usage INTEGER DEFAULT 0,
    email_hourly_usage INTEGER DEFAULT 0,
    
    -- Usage reset timestamps
    last_daily_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_hourly_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- OAuth and connection status
    oauth_completed_at TIMESTAMP WITH TIME ZONE,
    last_connection_test TIMESTAMP WITH TIME ZONE,
    connection_error TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by uuid REFERENCES auth.users(id),
    
    UNIQUE(workspace_id)
);

-- ReachInbox integration configurations (for SME/Enterprise tiers)
CREATE TABLE workspace_reachinbox_integrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- ReachInbox configuration
    reachinbox_api_key TEXT, -- Encrypted API key
    reachinbox_domain_1 TEXT, -- Primary domain
    reachinbox_domain_2 TEXT, -- Secondary domain (optional)
    
    -- Email account configurations
    email_accounts JSONB DEFAULT '[]'::jsonb, -- Array of configured email accounts
    total_email_accounts INTEGER DEFAULT 0,
    max_email_accounts INTEGER DEFAULT 10, -- Usually 5 per domain × 2 domains
    
    -- Rate limiting
    daily_email_limit INTEGER NOT NULL DEFAULT 2000,
    hourly_email_limit INTEGER NOT NULL DEFAULT 200,
    
    -- Current usage
    daily_email_usage INTEGER DEFAULT 0,
    hourly_email_usage INTEGER DEFAULT 0,
    
    -- Central reply inbox configuration
    reply_inbox_email TEXT, -- Gmail address where all replies land
    reply_inbox_configured BOOLEAN DEFAULT FALSE,
    
    -- Status and health
    integration_status TEXT NOT NULL DEFAULT 'pending' CHECK (integration_status IN ('pending', 'active', 'error', 'suspended')),
    last_health_check TIMESTAMP WITH TIME ZONE,
    health_check_error TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by uuid REFERENCES auth.users(id),
    
    UNIQUE(workspace_id)
);

-- N8N campaign execution tracking
CREATE TABLE n8n_campaign_executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Campaign identification
    campaign_name TEXT NOT NULL,
    campaign_type TEXT NOT NULL CHECK (campaign_type IN ('email_only', 'linkedin_only', 'multi_channel')),
    
    -- N8N execution details
    n8n_execution_id TEXT, -- N8N's internal execution ID
    n8n_workflow_id TEXT, -- N8N workflow ID (same for all tenants)
    
    -- Campaign parameters sent to N8N
    campaign_config JSONB NOT NULL, -- Complete campaign configuration
    target_audience_size INTEGER,
    
    -- Execution status
    execution_status TEXT NOT NULL DEFAULT 'queued' CHECK (execution_status IN 
        ('queued', 'running', 'paused', 'completed', 'failed', 'cancelled')),
    
    -- Progress tracking
    prospects_processed INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_delivered INTEGER DEFAULT 0,
    replies_received INTEGER DEFAULT 0,
    
    -- Channel-specific metrics
    linkedin_sent INTEGER DEFAULT 0,
    linkedin_delivered INTEGER DEFAULT 0,
    linkedin_replies INTEGER DEFAULT 0,
    email_sent INTEGER DEFAULT 0,
    email_delivered INTEGER DEFAULT 0,
    email_replies INTEGER DEFAULT 0,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    estimated_completion TIMESTAMP WITH TIME ZONE,
    
    -- Error handling
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Approval workflow status
    messaging_approved BOOLEAN DEFAULT FALSE,
    approved_by uuid REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_method TEXT CHECK (approval_method IN ('email', 'ui', 'auto')),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by uuid REFERENCES auth.users(id)
);

-- HITL (Human-in-the-Loop) reply approval sessions
CREATE TABLE hitl_reply_approval_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_execution_id uuid REFERENCES n8n_campaign_executions(id) ON DELETE CASCADE,
    
    -- Original message context
    original_message_id TEXT NOT NULL, -- Unipile message ID
    original_message_content TEXT NOT NULL,
    original_message_channel TEXT NOT NULL CHECK (original_message_channel IN ('linkedin', 'email')),
    
    -- Prospect information
    prospect_name TEXT,
    prospect_email TEXT,
    prospect_linkedin_url TEXT,
    prospect_company TEXT,
    
    -- SAM's suggested reply
    sam_suggested_reply TEXT NOT NULL,
    sam_confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    sam_reasoning TEXT,
    
    -- Approval workflow
    approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN 
        ('pending', 'approved', 'rejected', 'modified', 'expired')),
    
    -- Human reviewer details
    assigned_to uuid REFERENCES auth.users(id),
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    -- Approval method (email-based vs UI)
    approval_method TEXT CHECK (approval_method IN ('email', 'ui')),
    approval_email_sent_at TIMESTAMP WITH TIME ZONE,
    approval_email_replied_at TIMESTAMP WITH TIME ZONE,
    
    -- Final approved message
    final_approved_message TEXT,
    modification_notes TEXT,
    
    -- Timeout and escalation
    timeout_hours INTEGER DEFAULT 24,
    expires_at TIMESTAMP WITH TIME ZONE,
    escalated_to uuid REFERENCES auth.users(id),
    escalated_at TIMESTAMP WITH TIME ZONE,
    
    -- Delivery status
    reply_sent BOOLEAN DEFAULT FALSE,
    reply_sent_at TIMESTAMP WITH TIME ZONE,
    reply_delivery_status TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage analytics and rate limiting tracking
CREATE TABLE workspace_usage_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Time period
    analytics_date DATE NOT NULL,
    hour_of_day INTEGER, -- NULL for daily summaries, 0-23 for hourly
    
    -- Usage counts
    linkedin_messages_sent INTEGER DEFAULT 0,
    email_messages_sent INTEGER DEFAULT 0,
    total_campaigns_launched INTEGER DEFAULT 0,
    
    -- Performance metrics
    total_replies_received INTEGER DEFAULT 0,
    positive_replies INTEGER DEFAULT 0,
    negative_replies INTEGER DEFAULT 0,
    
    -- HITL approval metrics
    hitl_sessions_created INTEGER DEFAULT 0,
    hitl_auto_approved INTEGER DEFAULT 0,
    hitl_manually_approved INTEGER DEFAULT 0,
    hitl_rejected INTEGER DEFAULT 0,
    
    -- Rate limiting violations
    linkedin_rate_limit_hits INTEGER DEFAULT 0,
    email_rate_limit_hits INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(workspace_id, analytics_date, hour_of_day)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Workspace tier lookups
CREATE INDEX idx_workspace_tiers_workspace_id ON workspace_tiers(workspace_id);
CREATE INDEX idx_workspace_tiers_tier_type ON workspace_tiers(tier_type);

-- Unipile integration queries
CREATE INDEX idx_unipile_integrations_workspace_id ON workspace_unipile_integrations(workspace_id);
CREATE INDEX idx_unipile_integrations_status ON workspace_unipile_integrations(instance_status);

-- ReachInbox integration queries
CREATE INDEX idx_reachinbox_integrations_workspace_id ON workspace_reachinbox_integrations(workspace_id);
CREATE INDEX idx_reachinbox_integrations_status ON workspace_reachinbox_integrations(integration_status);

-- Campaign execution tracking
CREATE INDEX idx_campaign_executions_workspace_id ON n8n_campaign_executions(workspace_id);
CREATE INDEX idx_campaign_executions_status ON n8n_campaign_executions(execution_status);
CREATE INDEX idx_campaign_executions_created_at ON n8n_campaign_executions(created_at);

-- HITL approval sessions
CREATE INDEX idx_hitl_sessions_workspace_id ON hitl_reply_approval_sessions(workspace_id);
CREATE INDEX idx_hitl_sessions_status ON hitl_reply_approval_sessions(approval_status);
CREATE INDEX idx_hitl_sessions_assigned_to ON hitl_reply_approval_sessions(assigned_to);
CREATE INDEX idx_hitl_sessions_expires_at ON hitl_reply_approval_sessions(expires_at);

-- Usage analytics
CREATE INDEX idx_usage_analytics_workspace_date ON workspace_usage_analytics(workspace_id, analytics_date);
CREATE INDEX idx_usage_analytics_date ON workspace_usage_analytics(analytics_date);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE workspace_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_unipile_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_reachinbox_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE n8n_campaign_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_reply_approval_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_usage_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies (users can only access their workspace data)
CREATE POLICY workspace_tiers_policy ON workspace_tiers
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY unipile_integrations_policy ON workspace_unipile_integrations
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY reachinbox_integrations_policy ON workspace_reachinbox_integrations
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY campaign_executions_policy ON n8n_campaign_executions
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY hitl_sessions_policy ON hitl_reply_approval_sessions
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY usage_analytics_policy ON workspace_usage_analytics
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- FUNCTIONS FOR AUTOMATION
-- =====================================================

-- Function to reset daily/hourly usage counters
CREATE OR REPLACE FUNCTION reset_usage_counters()
RETURNS void AS $$
BEGIN
    -- Reset daily counters (run once per day)
    UPDATE workspace_unipile_integrations 
    SET linkedin_daily_usage = 0, 
        email_daily_usage = 0,
        last_daily_reset = NOW()
    WHERE last_daily_reset < CURRENT_DATE;
    
    UPDATE workspace_reachinbox_integrations 
    SET daily_email_usage = 0
    WHERE DATE_TRUNC('day', created_at) < CURRENT_DATE;
    
    -- Reset hourly counters (run once per hour)
    UPDATE workspace_unipile_integrations 
    SET linkedin_hourly_usage = 0, 
        email_hourly_usage = 0,
        last_hourly_reset = NOW()
    WHERE last_hourly_reset < DATE_TRUNC('hour', NOW());
    
    UPDATE workspace_reachinbox_integrations 
    SET hourly_email_usage = 0
    WHERE DATE_TRUNC('hour', created_at) < DATE_TRUNC('hour', NOW());
END;
$$ LANGUAGE plpgsql;

-- Function to check rate limits before sending
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_workspace_id uuid,
    p_channel text, -- 'linkedin' or 'email'
    p_count integer DEFAULT 1
)
RETURNS boolean AS $$
DECLARE
    daily_limit integer;
    hourly_limit integer;
    daily_usage integer;
    hourly_usage integer;
    service_type text;
BEGIN
    -- Get workspace tier to determine which service to check
    SELECT tier_type INTO service_type
    FROM workspace_tiers 
    WHERE workspace_id = p_workspace_id;
    
    IF p_channel = 'linkedin' THEN
        -- Check Unipile LinkedIn limits
        SELECT linkedin_daily_limit, linkedin_hourly_limit, 
               linkedin_daily_usage, linkedin_hourly_usage
        INTO daily_limit, hourly_limit, daily_usage, hourly_usage
        FROM workspace_unipile_integrations 
        WHERE workspace_id = p_workspace_id;
        
    ELSIF p_channel = 'email' AND service_type IN ('sme', 'enterprise') THEN
        -- Check ReachInbox limits for SME/Enterprise
        SELECT daily_email_limit, hourly_email_limit,
               daily_email_usage, hourly_email_usage
        INTO daily_limit, hourly_limit, daily_usage, hourly_usage
        FROM workspace_reachinbox_integrations 
        WHERE workspace_id = p_workspace_id;
        
    ELSIF p_channel = 'email' AND service_type = 'startup' THEN
        -- Check Unipile email limits for Startup tier
        SELECT email_daily_limit, email_hourly_limit,
               email_daily_usage, email_hourly_usage
        INTO daily_limit, hourly_limit, daily_usage, hourly_usage
        FROM workspace_unipile_integrations 
        WHERE workspace_id = p_workspace_id;
        
    ELSE
        RETURN false; -- Unknown configuration
    END IF;
    
    -- Check if adding p_count would exceed limits
    RETURN (daily_usage + p_count <= daily_limit) 
       AND (hourly_usage + p_count <= hourly_limit);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS FOR AUTOMATION
-- =====================================================

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_workspace_tiers_updated_at 
    BEFORE UPDATE ON workspace_tiers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_unipile_integrations_updated_at 
    BEFORE UPDATE ON workspace_unipile_integrations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reachinbox_integrations_updated_at 
    BEFORE UPDATE ON workspace_reachinbox_integrations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_executions_updated_at 
    BEFORE UPDATE ON n8n_campaign_executions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hitl_sessions_updated_at 
    BEFORE UPDATE ON hitl_reply_approval_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();