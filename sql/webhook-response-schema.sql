-- Webhook Response Handling Schema for N8N Integration
-- Created: 2025-09-23

-- Campaign Intelligence Results Storage
CREATE TABLE IF NOT EXISTS campaign_intelligence_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id TEXT NOT NULL,
    
    -- Intelligence Metrics
    total_prospects_discovered INTEGER DEFAULT 0,
    verified_contacts INTEGER DEFAULT 0,
    estimated_cost TEXT,
    data_sources_used TEXT[] DEFAULT '{}',
    personalization_score_avg DECIMAL(5,2),
    
    -- Execution Readiness
    ready_for_execution BOOLEAN DEFAULT false,
    webhook_endpoints JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LinkedIn Responses Storage
CREATE TABLE IF NOT EXISTS linkedin_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id TEXT NOT NULL,
    prospect_id UUID,
    
    -- Response Details
    response_type TEXT DEFAULT 'message', -- message, connection_accept, etc.
    response_content TEXT,
    sender_info JSONB DEFAULT '{}',
    
    -- Classification
    response_classification TEXT, -- positive/negative/neutral/out_of_office/meeting_request
    sentiment_score DECIMAL(3,2),
    
    -- Content Analysis
    contains_meeting_request BOOLEAN DEFAULT false,
    contains_contact_info BOOLEAN DEFAULT false,
    
    -- Platform IDs
    unipile_message_id TEXT,
    linkedin_thread_id TEXT,
    
    -- Raw Data
    raw_webhook_data JSONB DEFAULT '{}',
    
    -- Timestamps
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Responses Storage
CREATE TABLE IF NOT EXISTS email_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id TEXT NOT NULL,
    prospect_id UUID,
    
    -- Email Details
    from_email TEXT NOT NULL,
    subject TEXT,
    response_content TEXT,
    response_type TEXT DEFAULT 'reply', -- reply, bounce, out_of_office
    
    -- Classification
    response_classification TEXT, -- positive/negative/neutral/out_of_office/unsubscribe
    sentiment_score DECIMAL(3,2),
    
    -- Content Analysis
    contains_meeting_request BOOLEAN DEFAULT false,
    contains_calendar_link BOOLEAN DEFAULT false,
    contains_phone_number BOOLEAN DEFAULT false,
    contains_unsubscribe BOOLEAN DEFAULT false,
    
    -- Platform IDs
    email_thread_id TEXT,
    activecampaign_message_id TEXT,
    
    -- Raw Data
    raw_webhook_data JSONB DEFAULT '{}',
    
    -- Timestamps
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Notifications
CREATE TABLE IF NOT EXISTS sales_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id TEXT NOT NULL,
    prospect_id UUID,
    
    -- Notification Details
    notification_type TEXT NOT NULL, -- hot_lead, hot_email_lead, meeting_request
    priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
    message TEXT,
    
    -- Response Data
    response_data JSONB DEFAULT '{}',
    
    -- Status
    status TEXT DEFAULT 'new', -- new, assigned, in_progress, completed
    assigned_to TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Nurture Sequences
CREATE TABLE IF NOT EXISTS nurture_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL,
    
    -- Sequence Details
    sequence_type TEXT NOT NULL, -- linkedin_interested, email_interested
    trigger_response TEXT,
    
    -- Status
    status TEXT DEFAULT 'active', -- active, paused, completed
    current_step INTEGER DEFAULT 1,
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    next_action_at TIMESTAMP WITH TIME ZONE
);

-- Suppression List
CREATE TABLE IF NOT EXISTS suppression_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID,
    campaign_id TEXT,
    
    -- Suppression Details
    suppression_reason TEXT NOT NULL, -- negative, unsubscribe, bounce
    suppression_source TEXT NOT NULL, -- linkedin_response, email_response
    response_content TEXT,
    
    -- Timestamps
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Global Email Suppression
CREATE TABLE IF NOT EXISTS global_suppression_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    
    -- Suppression Details
    suppression_reason TEXT NOT NULL,
    suppression_source TEXT NOT NULL,
    
    -- Timestamps
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled Follow-ups
CREATE TABLE IF NOT EXISTS scheduled_follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL,
    campaign_id TEXT,
    
    -- Follow-up Details
    follow_up_type TEXT NOT NULL, -- out_of_office_return, email_out_of_office_return
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    original_response TEXT,
    
    -- Status
    status TEXT DEFAULT 'scheduled', -- scheduled, executed, cancelled
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE
);

-- Meeting Requests
CREATE TABLE IF NOT EXISTS meeting_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL,
    campaign_id TEXT,
    
    -- Request Details
    request_source TEXT NOT NULL, -- email, linkedin
    request_content TEXT,
    contains_calendar_link BOOLEAN DEFAULT false,
    contains_phone_number BOOLEAN DEFAULT false,
    
    -- Status
    priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
    status TEXT DEFAULT 'new', -- new, contacted, scheduled, completed
    
    -- Meeting Details
    meeting_scheduled_at TIMESTAMP WITH TIME ZONE,
    meeting_link TEXT,
    meeting_notes TEXT,
    
    -- Timestamps
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Real-time Notifications
CREATE TABLE IF NOT EXISTS real_time_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id TEXT,
    
    -- Notification Details
    notification_type TEXT NOT NULL, -- linkedin_response, email_response, campaign_status
    title TEXT NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}',
    
    -- Status
    read BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign Status Updates (for real-time dashboard)
CREATE TABLE IF NOT EXISTS campaign_status_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id TEXT NOT NULL,
    
    -- Status Details
    status TEXT NOT NULL,
    progress JSONB DEFAULT '{}',
    message TEXT,
    
    -- Timestamps
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_linkedin_responses_campaign_id ON linkedin_responses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_responses_prospect_id ON linkedin_responses(prospect_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_responses_classification ON linkedin_responses(response_classification);
CREATE INDEX IF NOT EXISTS idx_linkedin_responses_received_at ON linkedin_responses(received_at);

CREATE INDEX IF NOT EXISTS idx_email_responses_campaign_id ON email_responses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_responses_prospect_id ON email_responses(prospect_id);
CREATE INDEX IF NOT EXISTS idx_email_responses_from_email ON email_responses(from_email);
CREATE INDEX IF NOT EXISTS idx_email_responses_classification ON email_responses(response_classification);
CREATE INDEX IF NOT EXISTS idx_email_responses_received_at ON email_responses(received_at);

CREATE INDEX IF NOT EXISTS idx_sales_notifications_status ON sales_notifications(status);
CREATE INDEX IF NOT EXISTS idx_sales_notifications_priority ON sales_notifications(priority);
CREATE INDEX IF NOT EXISTS idx_sales_notifications_created_at ON sales_notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_real_time_notifications_read ON real_time_notifications(read);
CREATE INDEX IF NOT EXISTS idx_real_time_notifications_created_at ON real_time_notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_suppression_list_prospect_id ON suppression_list(prospect_id);
CREATE INDEX IF NOT EXISTS idx_global_suppression_email ON global_suppression_list(email);

-- Functions for Campaign Metrics Updates
CREATE OR REPLACE FUNCTION update_campaign_response_metrics(
    p_campaign_id TEXT,
    p_response_type TEXT,
    p_platform TEXT
) RETURNS VOID AS $$
BEGIN
    -- Update or insert campaign response metrics
    INSERT INTO campaign_response_metrics (
        campaign_id,
        platform,
        response_type,
        count,
        last_updated
    ) VALUES (
        p_campaign_id,
        p_platform,
        p_response_type,
        1,
        NOW()
    )
    ON CONFLICT (campaign_id, platform, response_type) 
    DO UPDATE SET 
        count = campaign_response_metrics.count + 1,
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Campaign Response Metrics Table
CREATE TABLE IF NOT EXISTS campaign_response_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id TEXT NOT NULL,
    platform TEXT NOT NULL, -- linkedin, email
    response_type TEXT NOT NULL, -- positive, negative, neutral, etc.
    count INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(campaign_id, platform, response_type)
);

CREATE INDEX IF NOT EXISTS idx_campaign_response_metrics_campaign_id ON campaign_response_metrics(campaign_id);

-- Row Level Security (RLS) Policies
ALTER TABLE linkedin_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_time_notifications ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (adjust based on your auth system)
-- These allow service role to access all data, and users to access their own data
CREATE POLICY "linkedin_responses_policy" ON linkedin_responses
    FOR ALL USING (auth.role() = 'service_role' OR auth.uid()::text = campaign_id);

CREATE POLICY "email_responses_policy" ON email_responses
    FOR ALL USING (auth.role() = 'service_role' OR auth.uid()::text = campaign_id);

CREATE POLICY "sales_notifications_policy" ON sales_notifications
    FOR ALL USING (auth.role() = 'service_role' OR auth.uid()::text = campaign_id);

CREATE POLICY "real_time_notifications_policy" ON real_time_notifications
    FOR ALL USING (auth.role() = 'service_role' OR auth.uid()::text = campaign_id);