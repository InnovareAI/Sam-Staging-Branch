-- Workspace N8N Workflow Deployment Schema
-- Creates tables for automatic workflow deployment and management per workspace

-- 1. Workspace N8N Workflows
-- Tracks deployed workflow instances for each workspace
CREATE TABLE IF NOT EXISTS workspace_n8n_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- N8N Instance Configuration
    n8n_instance_url TEXT NOT NULL DEFAULT 'https://workflows.innovareai.com',
    deployed_workflow_id TEXT NOT NULL, -- The actual workflow ID in N8N
    master_template_version TEXT DEFAULT 'v1.0',
    
    -- Deployment Status
    deployment_status TEXT DEFAULT 'pending' CHECK (deployment_status IN ('pending', 'deploying', 'active', 'failed', 'archived')),
    last_deployment_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deployment_error TEXT,
    
    -- Workspace Configuration
    workspace_config JSONB NOT NULL DEFAULT '{}',
    channel_preferences JSONB NOT NULL DEFAULT '{
        "email_enabled": true,
        "linkedin_enabled": true,
        "execution_sequence": "email_first",
        "delay_between_channels": 24
    }',
    
    -- Email Configuration
    email_config JSONB DEFAULT '{
        "enabled": true,
        "from_email": "",
        "from_name": "",
        "reply_to": "",
        "sequences": [],
        "personalization_enabled": true
    }',
    
    -- LinkedIn Configuration  
    linkedin_config JSONB DEFAULT '{
        "enabled": true,
        "account_id": "",
        "connection_requests_enabled": true,
        "inmails_enabled": false,
        "response_handling": "auto_classify"
    }',
    
    -- Reply Handling Configuration
    reply_handling_config JSONB DEFAULT '{
        "auto_response_enabled": true,
        "classification_enabled": true,
        "human_handoff_triggers": ["complex_question", "objection", "pricing_inquiry"],
        "positive_reply_actions": ["schedule_meeting", "notify_sales_rep"],
        "negative_reply_actions": ["remove_from_sequence", "add_to_suppression"]
    }',
    
    -- Credentials and Integrations
    credentials_config JSONB DEFAULT '{}', -- Encrypted credential mappings
    integration_status JSONB DEFAULT '{
        "unipile_connected": false,
        "email_provider_connected": false,
        "calendar_connected": false
    }',
    
    -- Performance Tracking
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,
    last_execution_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one active workflow per workspace
    UNIQUE(workspace_id, deployment_status) DEFERRABLE INITIALLY DEFERRED
);

-- 2. Workflow Deployment History
-- Audit trail of all deployment attempts and changes
CREATE TABLE IF NOT EXISTS workflow_deployment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_n8n_workflow_id UUID NOT NULL REFERENCES workspace_n8n_workflows(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    
    -- Deployment Details
    deployment_type TEXT NOT NULL CHECK (deployment_type IN ('initial_deployment', 'configuration_update', 'template_upgrade', 'credential_update', 'manual_redeploy')),
    deployment_trigger TEXT NOT NULL CHECK (deployment_trigger IN ('workspace_creation', 'user_request', 'admin_action', 'scheduled_upgrade', 'error_recovery')),
    
    -- Template Information
    old_template_version TEXT,
    new_template_version TEXT,
    template_changes JSONB DEFAULT '{}',
    
    -- Configuration Changes
    configuration_changes JSONB DEFAULT '{}',
    
    -- Deployment Status
    status TEXT NOT NULL CHECK (status IN ('started', 'in_progress', 'completed', 'failed', 'rolled_back')),
    error_message TEXT,
    
    -- N8N Details
    n8n_execution_id TEXT,
    deployed_workflow_id TEXT,
    deployment_duration_seconds INTEGER,
    
    -- Audit Information
    initiated_by TEXT NOT NULL, -- user_id or 'system'
    deployment_notes TEXT,
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Workflow Templates
-- Master workflow templates and versions
CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Template Identity
    template_name TEXT NOT NULL DEFAULT 'SAM_MASTER_CAMPAIGN_WORKFLOW',
    template_version TEXT NOT NULL,
    
    -- Template Configuration
    n8n_workflow_json JSONB NOT NULL, -- Complete N8N workflow JSON
    customization_points JSONB NOT NULL DEFAULT '{}', -- Configurable parameters
    required_credentials TEXT[] DEFAULT '{}', -- Required credential types
    
    -- Compatibility and Requirements
    min_n8n_version TEXT DEFAULT '1.0.0',
    required_integrations TEXT[] DEFAULT '{"unipile", "email_provider"}',
    compatibility_matrix JSONB DEFAULT '{}',
    
    -- Template Metadata
    description TEXT,
    changelog TEXT,
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'deprecated')),
    is_default BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE,
    deprecated_at TIMESTAMP WITH TIME ZONE,
    
    -- Unique constraint on template version
    UNIQUE(template_name, template_version)
);

-- 4. N8N Campaign Executions
-- Track individual campaign executions through N8N workflows
CREATE TABLE IF NOT EXISTS n8n_campaign_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_n8n_workflow_id UUID NOT NULL REFERENCES workspace_n8n_workflows(id) ON DELETE CASCADE,
    campaign_approval_session_id UUID, -- Link to existing prospect approval
    workspace_id TEXT NOT NULL,
    
    -- N8N Integration Details
    n8n_execution_id TEXT NOT NULL,
    n8n_workflow_id TEXT NOT NULL,
    
    -- Campaign Configuration
    campaign_name TEXT,
    campaign_type TEXT CHECK (campaign_type IN ('email_only', 'linkedin_only', 'multi_channel')),
    execution_config JSONB NOT NULL DEFAULT '{}',
    
    -- Prospect Information
    total_prospects INTEGER DEFAULT 0,
    processed_prospects INTEGER DEFAULT 0,
    successful_outreach INTEGER DEFAULT 0,
    failed_outreach INTEGER DEFAULT 0,
    responses_received INTEGER DEFAULT 0,
    
    -- Status Tracking
    execution_status TEXT DEFAULT 'pending' CHECK (execution_status IN ('pending', 'started', 'in_progress', 'paused', 'completed', 'failed', 'cancelled')),
    current_step TEXT,
    progress_percentage REAL DEFAULT 0.0,
    
    -- Results and Analytics
    campaign_results JSONB DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    error_details TEXT,
    
    -- Estimated and Actual Times
    estimated_completion_time TIMESTAMP WITH TIME ZONE,
    estimated_duration_minutes INTEGER,
    actual_duration_minutes INTEGER,
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Workflow Credentials Management
-- Secure credential mapping per workspace (encrypted)
CREATE TABLE IF NOT EXISTS workspace_workflow_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_n8n_workflow_id UUID NOT NULL REFERENCES workspace_n8n_workflows(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    
    -- Credential Details
    credential_type TEXT NOT NULL CHECK (credential_type IN ('unipile_api', 'email_smtp', 'linkedin_oauth', 'calendar_api', 'crm_api')),
    credential_name TEXT NOT NULL,
    
    -- N8N Credential Mapping
    n8n_credential_id TEXT NOT NULL, -- ID of credential in N8N
    
    -- Status and Validation
    is_active BOOLEAN DEFAULT true,
    last_validated TIMESTAMP WITH TIME ZONE,
    validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid', 'expired')),
    validation_error TEXT,
    
    -- Security
    encrypted_config TEXT, -- Encrypted credential configuration
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Unique constraint per workspace per credential type
    UNIQUE(workspace_id, credential_type, credential_name)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_workspace_n8n_workflows_workspace ON workspace_n8n_workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_n8n_workflows_status ON workspace_n8n_workflows(deployment_status);
CREATE INDEX IF NOT EXISTS idx_workspace_n8n_workflows_user ON workspace_n8n_workflows(user_id);

CREATE INDEX IF NOT EXISTS idx_deployment_history_workspace ON workflow_deployment_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_deployment_history_workflow ON workflow_deployment_history(workspace_n8n_workflow_id);
CREATE INDEX IF NOT EXISTS idx_deployment_history_status ON workflow_deployment_history(status);
CREATE INDEX IF NOT EXISTS idx_deployment_history_created ON workflow_deployment_history(created_at);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_version ON workflow_templates(template_version);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_status ON workflow_templates(status);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_default ON workflow_templates(is_default);

CREATE INDEX IF NOT EXISTS idx_n8n_executions_workspace ON n8n_campaign_executions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_n8n_executions_workflow ON n8n_campaign_executions(workspace_n8n_workflow_id);
CREATE INDEX IF NOT EXISTS idx_n8n_executions_status ON n8n_campaign_executions(execution_status);
CREATE INDEX IF NOT EXISTS idx_n8n_executions_approval ON n8n_campaign_executions(campaign_approval_session_id);

CREATE INDEX IF NOT EXISTS idx_workflow_credentials_workspace ON workspace_workflow_credentials(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workflow_credentials_workflow ON workspace_workflow_credentials(workspace_n8n_workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_credentials_type ON workspace_workflow_credentials(credential_type);
CREATE INDEX IF NOT EXISTS idx_workflow_credentials_active ON workspace_workflow_credentials(is_active);

-- Create updated_at triggers
CREATE TRIGGER update_workspace_n8n_workflows_updated_at 
    BEFORE UPDATE ON workspace_n8n_workflows 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_n8n_campaign_executions_updated_at 
    BEFORE UPDATE ON n8n_campaign_executions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_workflow_credentials_updated_at 
    BEFORE UPDATE ON workspace_workflow_credentials 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security) policies
ALTER TABLE workspace_n8n_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_deployment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE n8n_campaign_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_workflow_credentials ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for workspace isolation
CREATE POLICY "Users can only access their workspace workflows" ON workspace_n8n_workflows
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspaces WHERE user_id = auth.uid()::text
    ));

CREATE POLICY "Users can only access their deployment history" ON workflow_deployment_history
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspaces WHERE user_id = auth.uid()::text
    ));

CREATE POLICY "Users can only access their campaign executions" ON n8n_campaign_executions
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspaces WHERE user_id = auth.uid()::text
    ));

CREATE POLICY "Users can only access their workflow credentials" ON workspace_workflow_credentials
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspaces WHERE user_id = auth.uid()::text
    ));

-- Allow public read access to workflow templates
CREATE POLICY "Anyone can read workflow templates" ON workflow_templates
    FOR SELECT USING (true);

-- Sample data for testing (commented out)
/*
-- Insert default workflow template
INSERT INTO workflow_templates (template_name, template_version, n8n_workflow_json, customization_points, status, is_default) 
VALUES (
    'SAM_MASTER_CAMPAIGN_WORKFLOW',
    'v1.0',
    '{"nodes": [], "connections": {}}',
    '{"email_config": "configurable", "linkedin_config": "configurable", "reply_handling": "configurable"}',
    'active',
    true
);
*/