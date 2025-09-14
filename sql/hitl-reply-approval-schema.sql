-- HITL Reply Approval System Database Schema
-- Creates tables for Human-In-The-Loop email response approval system

-- 1. Reply Approval Sessions
-- Tracks each prospect reply requiring approval
CREATE TABLE IF NOT EXISTS reply_approval_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Campaign Context
    campaign_execution_id UUID REFERENCES n8n_campaign_executions(id) ON DELETE SET NULL,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Original Prospect Email
    prospect_name TEXT NOT NULL,
    prospect_email TEXT NOT NULL,
    prospect_company TEXT,
    original_campaign_message_id TEXT, -- Reference to original outbound message
    
    -- Prospect Reply Details
    prospect_reply_subject TEXT NOT NULL,
    prospect_reply_body TEXT NOT NULL,
    prospect_reply_received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    prospect_reply_sentiment TEXT CHECK (prospect_reply_sentiment IN ('positive', 'negative', 'neutral', 'objection', 'question', 'out_of_office')),
    prospect_reply_classification TEXT CHECK (prospect_reply_classification IN ('interested', 'not_interested', 'needs_info', 'pricing_inquiry', 'meeting_request', 'objection', 'auto_reply')),
    
    -- SAM Generated Response
    sam_generated_response_subject TEXT,
    sam_generated_response_body TEXT NOT NULL,
    sam_confidence_score REAL DEFAULT 0.0 CHECK (sam_confidence_score BETWEEN 0.0 AND 1.0),
    sam_response_type TEXT CHECK (sam_response_type IN ('answer_question', 'handle_objection', 'schedule_meeting', 'provide_info', 'follow_up', 'closing_response')),
    sam_reasoning TEXT, -- Why SAM chose this response
    
    -- Approval Status
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'modified', 'rejected', 'timeout', 'sent', 'auto_sent')),
    approval_decision_received_at TIMESTAMP WITH TIME ZONE,
    approval_timeout_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '2 hours'),
    
    -- Approval Email Details
    approval_email_sent BOOLEAN DEFAULT false,
    approval_email_sent_at TIMESTAMP WITH TIME ZONE,
    approval_email_to TEXT, -- Email address where approval was sent
    approval_email_message_id TEXT, -- Email message ID for tracking
    
    -- Final Response
    final_response_subject TEXT,
    final_response_body TEXT,
    response_sent_at TIMESTAMP WITH TIME ZONE,
    response_sent_via TEXT CHECK (response_sent_via IN ('email', 'api', 'n8n_workflow')),
    
    -- Performance Metrics
    total_approval_time_minutes INTEGER, -- Time from creation to approval
    response_effectiveness_score REAL, -- Post-send effectiveness rating
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Reply Approval Decisions
-- Tracks human decisions and modifications
CREATE TABLE IF NOT EXISTS reply_approval_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reply_approval_session_id UUID NOT NULL REFERENCES reply_approval_sessions(id) ON DELETE CASCADE,
    
    -- Approval Details
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'modified', 'rejected', 'do_not_send', 'escalated')),
    decision_method TEXT DEFAULT 'email_reply' CHECK (decision_method IN ('email_reply', 'dashboard', 'api', 'mobile_app')),
    
    -- Modifications (if any)
    original_response TEXT,
    modified_response_subject TEXT,
    modified_response_body TEXT,
    modification_notes TEXT,
    modification_type TEXT[] DEFAULT '{}', -- ['tone_adjustment', 'factual_correction', 'personalization_improvement']
    
    -- User Feedback
    user_feedback TEXT, -- Free-form feedback about SAM's response quality
    response_quality_rating INTEGER CHECK (response_quality_rating BETWEEN 1 AND 5),
    improvement_suggestions TEXT,
    
    -- Approval Context
    approved_by TEXT NOT NULL, -- user_id
    approved_via_email TEXT, -- Email address used for approval
    approval_email_message_id TEXT, -- Email message ID for tracking
    approval_command_used TEXT, -- 'APPROVED', 'CHANGES:', 'DO NOT SEND'
    
    -- Processing Details
    processing_time_seconds INTEGER DEFAULT 0,
    auto_processed BOOLEAN DEFAULT false, -- If processed automatically due to timeout
    
    -- Timestamps
    decided_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Reply Approval Templates
-- Reusable response templates for common scenarios
CREATE TABLE IF NOT EXISTS reply_approval_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL,
    
    -- Template Details
    template_name TEXT NOT NULL,
    template_category TEXT CHECK (template_category IN ('question_answer', 'objection_handling', 'meeting_scheduling', 'information_request', 'follow_up', 'closing', 'not_interested')),
    template_subcategory TEXT, -- More specific categorization
    
    -- Template Content
    subject_template TEXT,
    body_template TEXT NOT NULL,
    personalization_fields TEXT[] DEFAULT '{}', -- Variables like {prospect_name}, {company_name}
    
    -- Matching Criteria
    trigger_keywords TEXT[] DEFAULT '{}', -- Keywords that should trigger this template
    prospect_sentiment TEXT[], -- Sentiments this template handles
    industry_specific TEXT[], -- Industries where this template is most effective
    
    -- Usage Statistics
    times_used INTEGER DEFAULT 0,
    times_approved INTEGER DEFAULT 0,
    approval_rate REAL DEFAULT 0.0, -- Percentage of times approved when suggested
    average_response_time_hours REAL DEFAULT 0.0,
    
    -- Performance Metrics
    effectiveness_score REAL DEFAULT 0.0, -- Based on prospect responses
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Template Status
    is_active BOOLEAN DEFAULT true,
    is_auto_approved BOOLEAN DEFAULT false, -- Can be sent without human approval
    created_by TEXT NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Reply Learning Data
-- Tracks patterns for improving SAM's responses
CREATE TABLE IF NOT EXISTS reply_learning_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reply_approval_session_id UUID NOT NULL REFERENCES reply_approval_sessions(id) ON DELETE CASCADE,
    
    -- Learning Context
    prospect_reply_keywords TEXT[], -- Extracted keywords from prospect reply
    prospect_intent_classification TEXT, -- Classified intent
    industry_context TEXT,
    company_size_context TEXT,
    communication_style TEXT, -- Formal, casual, technical, etc.
    
    -- SAM Performance Analysis
    initial_response_quality INTEGER CHECK (initial_response_quality BETWEEN 1 AND 5),
    required_modifications BOOLEAN DEFAULT false,
    modification_types TEXT[], -- Types of modifications needed
    confidence_vs_approval JSONB, -- Correlation data for learning
    
    -- Human Preferences Learned
    preferred_tone TEXT, -- 'formal', 'casual', 'friendly', 'professional'
    preferred_length TEXT, -- 'brief', 'medium', 'detailed'
    preferred_approach TEXT, -- 'direct', 'consultative', 'educational'
    preferred_personalization_level TEXT, -- 'high', 'medium', 'low'
    
    -- Response Pattern Analysis
    successful_patterns JSONB DEFAULT '{}', -- Patterns that led to approval
    unsuccessful_patterns JSONB DEFAULT '{}', -- Patterns that led to rejection
    
    -- Learning Features (extensible)
    learning_features JSONB DEFAULT '{}',
    
    -- Timestamps
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. HITL System Configuration
-- Per-workspace configuration for HITL system
CREATE TABLE IF NOT EXISTS hitl_system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL UNIQUE,
    
    -- System Settings
    hitl_enabled BOOLEAN DEFAULT true,
    auto_send_threshold REAL DEFAULT 0.85 CHECK (auto_send_threshold BETWEEN 0.0 AND 1.0),
    approval_timeout_hours INTEGER DEFAULT 2,
    
    -- Email Configuration
    approval_email_enabled BOOLEAN DEFAULT true,
    approval_email_addresses TEXT[] DEFAULT '{}', -- Multiple approvers
    escalation_email TEXT,
    email_template_id UUID REFERENCES reply_approval_templates(id),
    
    -- Auto-Approval Rules
    auto_approve_template_matches BOOLEAN DEFAULT false,
    auto_approve_high_confidence BOOLEAN DEFAULT false,
    auto_approve_similar_responses BOOLEAN DEFAULT false,
    
    -- Notification Preferences
    real_time_notifications BOOLEAN DEFAULT true,
    daily_summary_enabled BOOLEAN DEFAULT true,
    weekly_report_enabled BOOLEAN DEFAULT true,
    
    -- Quality Control
    require_approval_for_objections BOOLEAN DEFAULT true,
    require_approval_for_pricing BOOLEAN DEFAULT true,
    require_approval_for_meetings BOOLEAN DEFAULT false,
    
    -- Performance Tracking
    track_response_effectiveness BOOLEAN DEFAULT true,
    learning_enabled BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Approval Notification Log
-- Tracks all notifications sent for approvals
CREATE TABLE IF NOT EXISTS approval_notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reply_approval_session_id UUID NOT NULL REFERENCES reply_approval_sessions(id) ON DELETE CASCADE,
    
    -- Notification Details
    notification_type TEXT CHECK (notification_type IN ('email', 'sms', 'push', 'slack', 'teams')),
    notification_method TEXT CHECK (notification_method IN ('initial_approval', 'reminder', 'timeout_warning', 'escalation')),
    
    -- Delivery Details
    sent_to TEXT NOT NULL, -- Email, phone, user_id, etc.
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'opened', 'failed')),
    
    -- Response Tracking
    notification_response_received BOOLEAN DEFAULT false,
    response_received_at TIMESTAMP WITH TIME ZONE,
    
    -- Performance Metrics
    response_time_minutes INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_reply_approval_sessions_workspace ON reply_approval_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reply_approval_sessions_user ON reply_approval_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_reply_approval_sessions_status ON reply_approval_sessions(approval_status);
CREATE INDEX IF NOT EXISTS idx_reply_approval_sessions_timeout ON reply_approval_sessions(approval_timeout_at);
CREATE INDEX IF NOT EXISTS idx_reply_approval_sessions_prospect ON reply_approval_sessions(prospect_email);
CREATE INDEX IF NOT EXISTS idx_reply_approval_sessions_campaign ON reply_approval_sessions(campaign_execution_id);

CREATE INDEX IF NOT EXISTS idx_reply_approval_decisions_session ON reply_approval_decisions(reply_approval_session_id);
CREATE INDEX IF NOT EXISTS idx_reply_approval_decisions_decision ON reply_approval_decisions(decision);
CREATE INDEX IF NOT EXISTS idx_reply_approval_decisions_method ON reply_approval_decisions(decision_method);
CREATE INDEX IF NOT EXISTS idx_reply_approval_decisions_user ON reply_approval_decisions(approved_by);

CREATE INDEX IF NOT EXISTS idx_reply_templates_workspace ON reply_approval_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reply_templates_category ON reply_approval_templates(template_category);
CREATE INDEX IF NOT EXISTS idx_reply_templates_active ON reply_approval_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_reply_templates_auto_approved ON reply_approval_templates(is_auto_approved);
CREATE INDEX IF NOT EXISTS idx_reply_templates_usage ON reply_approval_templates(times_used DESC);

CREATE INDEX IF NOT EXISTS idx_reply_learning_session ON reply_learning_data(reply_approval_session_id);
CREATE INDEX IF NOT EXISTS idx_reply_learning_logged ON reply_learning_data(logged_at);

CREATE INDEX IF NOT EXISTS idx_hitl_config_workspace ON hitl_system_config(workspace_id);

CREATE INDEX IF NOT EXISTS idx_notification_log_session ON approval_notification_log(reply_approval_session_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON approval_notification_log(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_log_sent ON approval_notification_log(sent_at);

-- Create updated_at triggers
CREATE TRIGGER update_reply_approval_sessions_updated_at 
    BEFORE UPDATE ON reply_approval_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reply_approval_templates_updated_at 
    BEFORE UPDATE ON reply_approval_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hitl_system_config_updated_at 
    BEFORE UPDATE ON hitl_system_config 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security) policies
ALTER TABLE reply_approval_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_approval_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_learning_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_notification_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for workspace isolation
CREATE POLICY "Users can only access their workspace reply approvals" ON reply_approval_sessions
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspaces WHERE user_id = auth.uid()::text
    ));

CREATE POLICY "Users can only access their approval decisions" ON reply_approval_decisions
    FOR ALL USING (reply_approval_session_id IN (
        SELECT id FROM reply_approval_sessions WHERE workspace_id IN (
            SELECT workspace_id FROM workspaces WHERE user_id = auth.uid()::text
        )
    ));

CREATE POLICY "Users can only access their workspace templates" ON reply_approval_templates
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspaces WHERE user_id = auth.uid()::text
    ));

CREATE POLICY "Users can only access their learning data" ON reply_learning_data
    FOR ALL USING (reply_approval_session_id IN (
        SELECT id FROM reply_approval_sessions WHERE workspace_id IN (
            SELECT workspace_id FROM workspaces WHERE user_id = auth.uid()::text
        )
    ));

CREATE POLICY "Users can only access their workspace HITL config" ON hitl_system_config
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspaces WHERE user_id = auth.uid()::text
    ));

CREATE POLICY "Users can only access their notification logs" ON approval_notification_log
    FOR ALL USING (reply_approval_session_id IN (
        SELECT id FROM reply_approval_sessions WHERE workspace_id IN (
            SELECT workspace_id FROM workspaces WHERE user_id = auth.uid()::text
        )
    ));

-- Create functions for business logic
CREATE OR REPLACE FUNCTION calculate_approval_rate_for_template(template_uuid UUID)
RETURNS REAL AS $$
BEGIN
    UPDATE reply_approval_templates 
    SET approval_rate = (
        CASE 
            WHEN times_used = 0 THEN 0.0
            ELSE (times_approved::REAL / times_used::REAL) * 100
        END
    )
    WHERE id = template_uuid;
    
    RETURN (SELECT approval_rate FROM reply_approval_templates WHERE id = template_uuid);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mark_approval_timeout()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-mark approvals as timed out when timeout is reached
    UPDATE reply_approval_sessions 
    SET approval_status = 'timeout'
    WHERE approval_timeout_at < NOW() 
    AND approval_status = 'pending';
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically handle timeouts (would be better handled by a background job)
-- This is a demonstration - in production, use a proper job scheduler
CREATE OR REPLACE FUNCTION schedule_approval_timeout_check()
RETURNS void AS $$
BEGIN
    -- This would be called by a background job every 5 minutes
    UPDATE reply_approval_sessions 
    SET approval_status = 'timeout',
        updated_at = NOW()
    WHERE approval_timeout_at < NOW() 
    AND approval_status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- Sample data for testing (commented out)
/*
-- Insert sample HITL configuration
INSERT INTO hitl_system_config (workspace_id, hitl_enabled, auto_send_threshold, approval_timeout_hours) 
VALUES ('sample-workspace', true, 0.85, 2);

-- Insert sample response templates
INSERT INTO reply_approval_templates (workspace_id, template_name, template_category, subject_template, body_template, created_by)
VALUES 
('sample-workspace', 'Meeting Scheduling Response', 'meeting_scheduling', 
'Re: {original_subject}', 
'Hi {prospect_name},

Thank you for your interest! I''d be happy to schedule a brief call to discuss how we can help {company_name}.

I have availability:
- {time_slot_1}
- {time_slot_2}
- {time_slot_3}

Which works best for you?

Best regards,
{user_name}', 
'sample-user'),

('sample-workspace', 'Pricing Inquiry Response', 'information_request',
'Re: {original_subject}',
'Hi {prospect_name},

Thank you for your interest in our pricing. Our solutions are customized based on your specific needs and company size.

I''d love to understand more about your requirements so I can provide accurate pricing. Would you be open to a 15-minute call this week?

Best regards,
{user_name}',
'sample-user');
*/