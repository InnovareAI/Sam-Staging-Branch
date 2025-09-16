-- Campaign Email Sending System
-- Configures workspace-specific email accounts for outreach campaigns
-- Supports multiple sending domains and SMTP configurations per workspace

-- 1. Campaign email accounts - Dedicated sending accounts for outreach
CREATE TABLE IF NOT EXISTS campaign_email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    
    -- Email account details
    email_address TEXT NOT NULL,
    display_name TEXT NOT NULL,
    reply_to_email TEXT, -- Different reply-to if needed
    
    -- SMTP Configuration
    smtp_host TEXT NOT NULL,
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_username TEXT NOT NULL,
    smtp_password_encrypted TEXT NOT NULL, -- Encrypted at application level
    smtp_use_tls BOOLEAN DEFAULT true,
    smtp_use_ssl BOOLEAN DEFAULT false,
    
    -- Domain and authentication
    sending_domain TEXT NOT NULL,
    dkim_configured BOOLEAN DEFAULT false,
    spf_configured BOOLEAN DEFAULT false,
    dmarc_configured BOOLEAN DEFAULT false,
    
    -- Account status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed', 'suspended')),
    last_verified_at TIMESTAMPTZ,
    
    -- Usage limits
    daily_send_limit INTEGER DEFAULT 500, -- Conservative default
    hourly_send_limit INTEGER DEFAULT 50,
    monthly_send_limit INTEGER DEFAULT 10000,
    
    -- Usage tracking
    emails_sent_today INTEGER DEFAULT 0,
    emails_sent_this_hour INTEGER DEFAULT 0,
    emails_sent_this_month INTEGER DEFAULT 0,
    last_reset_daily TIMESTAMPTZ DEFAULT CURRENT_DATE,
    last_reset_hourly TIMESTAMPTZ DEFAULT date_trunc('hour', NOW()),
    last_reset_monthly TIMESTAMPTZ DEFAULT date_trunc('month', NOW()),
    
    -- Health monitoring
    bounce_rate DECIMAL(5,4) DEFAULT 0.0000, -- Percentage (0.0000 to 1.0000)
    complaint_rate DECIMAL(5,4) DEFAULT 0.0000,
    delivery_rate DECIMAL(5,4) DEFAULT 1.0000,
    reputation_score INTEGER DEFAULT 100, -- 0-100 scale
    
    -- Account metadata
    provider_type TEXT DEFAULT 'custom' CHECK (provider_type IN ('gmail', 'outlook', 'custom', 'postmark', 'sendgrid')),
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique email per workspace
    UNIQUE(workspace_id, email_address)
);

-- 2. Email sending logs
CREATE TABLE IF NOT EXISTS campaign_email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    email_account_id UUID NOT NULL REFERENCES campaign_email_accounts(id) ON DELETE CASCADE,
    
    -- Message details
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject_line TEXT NOT NULL,
    message_body TEXT NOT NULL,
    message_type TEXT DEFAULT 'html' CHECK (message_type IN ('plain', 'html')),
    
    -- Sending details
    sent_by UUID NOT NULL REFERENCES users(id),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Delivery tracking
    message_id TEXT, -- Provider's message ID
    delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed')),
    delivery_timestamp TIMESTAMPTZ,
    bounce_reason TEXT,
    complaint_reason TEXT,
    
    -- Response tracking
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    
    -- Metadata
    user_agent TEXT,
    ip_address INET,
    tracking_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Email templates for campaigns
CREATE TABLE IF NOT EXISTS campaign_email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    
    -- Template details
    template_name TEXT NOT NULL,
    template_description TEXT,
    template_category TEXT DEFAULT 'outreach' CHECK (template_category IN ('outreach', 'follow_up', 'introduction', 'meeting', 'proposal')),
    
    -- Template content
    subject_line TEXT NOT NULL,
    message_body TEXT NOT NULL,
    message_format TEXT DEFAULT 'html' CHECK (message_format IN ('plain', 'html')),
    
    -- Personalization variables
    variables JSONB DEFAULT '{}', -- {first_name: "John", company: "TechCorp"}
    required_variables TEXT[] DEFAULT '{}',
    
    -- Template status
    is_active BOOLEAN DEFAULT true,
    is_approved BOOLEAN DEFAULT false, -- For compliance review
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    
    -- Usage tracking
    times_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    success_rate DECIMAL(5,4) DEFAULT 0.0000, -- Reply rate
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workspace_id, template_name)
);

-- 4. Campaign email sequences
CREATE TABLE IF NOT EXISTS campaign_email_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Sequence details
    sequence_name TEXT NOT NULL,
    sequence_description TEXT,
    
    -- Email sequence steps
    email_steps JSONB NOT NULL DEFAULT '[]', -- Array of email step configurations
    
    -- Timing configuration
    total_steps INTEGER DEFAULT 1,
    delay_between_emails INTEGER DEFAULT 3, -- Days
    stop_on_reply BOOLEAN DEFAULT true,
    stop_on_bounce BOOLEAN DEFAULT true,
    
    -- Sequence status
    is_active BOOLEAN DEFAULT true,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Statistics
    prospects_enrolled INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    replies_received INTEGER DEFAULT 0,
    meetings_booked INTEGER DEFAULT 0,
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_email_accounts_workspace ON campaign_email_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_email_accounts_active ON campaign_email_accounts(is_active, is_verified) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_campaign_email_accounts_domain ON campaign_email_accounts(sending_domain);

CREATE INDEX IF NOT EXISTS idx_campaign_email_logs_account ON campaign_email_logs(email_account_id);
CREATE INDEX IF NOT EXISTS idx_campaign_email_logs_campaign ON campaign_email_logs(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_email_logs_recipient ON campaign_email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_campaign_email_logs_sent_at ON campaign_email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_campaign_email_logs_status ON campaign_email_logs(delivery_status);

CREATE INDEX IF NOT EXISTS idx_campaign_email_templates_workspace ON campaign_email_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_email_templates_active ON campaign_email_templates(is_active, is_approved) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_campaign_email_sequences_campaign ON campaign_email_sequences(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_email_sequences_workspace ON campaign_email_sequences(workspace_id);

-- Enable RLS
ALTER TABLE campaign_email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_email_sequences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage workspace campaign email accounts" ON campaign_email_accounts
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = 
            (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
        )
    );

CREATE POLICY "Users can view workspace campaign email logs" ON campaign_email_logs
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = 
            (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
        )
    );

CREATE POLICY "Users can manage their campaign email logs" ON campaign_email_logs
    FOR INSERT WITH CHECK (
        sent_by = (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
    );

CREATE POLICY "Users can manage workspace email templates" ON campaign_email_templates
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = 
            (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
        )
    );

CREATE POLICY "Users can manage workspace email sequences" ON campaign_email_sequences
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = 
            (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
        )
    );

-- Functions for campaign email management

-- Function to reset usage counters (run via cron)
CREATE OR REPLACE FUNCTION reset_email_usage_counters()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    -- Reset daily counters
    UPDATE campaign_email_accounts 
    SET 
        emails_sent_today = 0,
        last_reset_daily = CURRENT_DATE
    WHERE last_reset_daily < CURRENT_DATE;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Reset hourly counters
    UPDATE campaign_email_accounts 
    SET 
        emails_sent_this_hour = 0,
        last_reset_hourly = date_trunc('hour', NOW())
    WHERE last_reset_hourly < date_trunc('hour', NOW());
    
    -- Reset monthly counters
    UPDATE campaign_email_accounts 
    SET 
        emails_sent_this_month = 0,
        last_reset_monthly = date_trunc('month', NOW())
    WHERE last_reset_monthly < date_trunc('month', NOW());
    
    RETURN updated_count;
END;
$$;

-- Function to check if email can be sent (rate limiting)
CREATE OR REPLACE FUNCTION can_send_email(
    p_email_account_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account RECORD;
BEGIN
    -- Get account details and current usage
    SELECT * INTO v_account
    FROM campaign_email_accounts
    WHERE id = p_email_account_id
      AND is_active = true
      AND is_verified = true;
    
    IF v_account IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check daily limit
    IF v_account.emails_sent_today >= v_account.daily_send_limit THEN
        RETURN false;
    END IF;
    
    -- Check hourly limit
    IF v_account.emails_sent_this_hour >= v_account.hourly_send_limit THEN
        RETURN false;
    END IF;
    
    -- Check monthly limit
    IF v_account.emails_sent_this_month >= v_account.monthly_send_limit THEN
        RETURN false;
    END IF;
    
    -- Check reputation score
    IF v_account.reputation_score < 50 THEN
        RETURN false;
    END IF;
    
    -- Check bounce rate (halt if > 10%)
    IF v_account.bounce_rate > 0.10 THEN
        RETURN false;
    END IF;
    
    -- Check complaint rate (halt if > 5%)
    IF v_account.complaint_rate > 0.05 THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$;

-- Function to log email send attempt
CREATE OR REPLACE FUNCTION log_campaign_email_send(
    p_workspace_id UUID,
    p_email_account_id UUID,
    p_campaign_id UUID,
    p_recipient_email TEXT,
    p_recipient_name TEXT,
    p_subject_line TEXT,
    p_message_body TEXT,
    p_sent_by UUID,
    p_message_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    -- Check if email can be sent
    IF NOT can_send_email(p_email_account_id) THEN
        RAISE EXCEPTION 'Email sending not allowed: rate limit exceeded or account suspended';
    END IF;
    
    -- Insert email log
    INSERT INTO campaign_email_logs (
        workspace_id,
        campaign_id,
        email_account_id,
        recipient_email,
        recipient_name,
        subject_line,
        message_body,
        sent_by,
        message_id
    ) VALUES (
        p_workspace_id,
        p_campaign_id,
        p_email_account_id,
        p_recipient_email,
        p_recipient_name,
        p_subject_line,
        p_message_body,
        p_sent_by,
        p_message_id
    ) RETURNING id INTO v_log_id;
    
    -- Update usage counters
    UPDATE campaign_email_accounts
    SET 
        emails_sent_today = emails_sent_today + 1,
        emails_sent_this_hour = emails_sent_this_hour + 1,
        emails_sent_this_month = emails_sent_this_month + 1,
        updated_at = NOW()
    WHERE id = p_email_account_id;
    
    RETURN v_log_id;
END;
$$;

-- Function to update email delivery status
CREATE OR REPLACE FUNCTION update_email_delivery_status(
    p_message_id TEXT,
    p_delivery_status TEXT,
    p_bounce_reason TEXT DEFAULT NULL,
    p_complaint_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email_account_id UUID;
BEGIN
    -- Update email log
    UPDATE campaign_email_logs
    SET 
        delivery_status = p_delivery_status,
        delivery_timestamp = NOW(),
        bounce_reason = p_bounce_reason,
        complaint_reason = p_complaint_reason,
        updated_at = NOW()
    WHERE message_id = p_message_id
    RETURNING email_account_id INTO v_email_account_id;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Update account reputation metrics (simplified)
    IF p_delivery_status IN ('bounced', 'complained') THEN
        UPDATE campaign_email_accounts
        SET 
            reputation_score = GREATEST(0, reputation_score - 5),
            bounce_rate = CASE 
                WHEN p_delivery_status = 'bounced' THEN bounce_rate + 0.01
                ELSE bounce_rate
            END,
            complaint_rate = CASE 
                WHEN p_delivery_status = 'complained' THEN complaint_rate + 0.01
                ELSE complaint_rate
            END,
            updated_at = NOW()
        WHERE id = v_email_account_id;
    ELSIF p_delivery_status = 'delivered' THEN
        UPDATE campaign_email_accounts
        SET 
            reputation_score = LEAST(100, reputation_score + 1),
            delivery_rate = delivery_rate + 0.001,
            updated_at = NOW()
        WHERE id = v_email_account_id;
    END IF;
    
    RETURN true;
END;
$$;

-- Default email templates for common scenarios
INSERT INTO campaign_email_templates (workspace_id, created_by, template_name, template_description, subject_line, message_body, variables) 
SELECT 
    w.id,
    w.owner_id,
    'Cold Outreach - Introduction',
    'Professional introduction email for cold outreach',
    'Quick question about {{company_name}}''s {{business_area}}',
    '<p>Hi {{first_name}},</p>

<p>I noticed {{company_name}} is doing some interesting work in {{business_area}}. I''ve been helping similar companies {{value_proposition}}.</p>

<p>Would you be open to a brief 15-minute call to discuss how we might be able to help {{company_name}} {{specific_benefit}}?</p>

<p>Best regards,<br>{{sender_name}}</p>

<p><em>P.S. If this isn''t relevant to you, please let me know who would be the best person to speak with.</em></p>',
    '{"first_name": "John", "company_name": "TechCorp", "business_area": "software development", "value_proposition": "streamline their development process", "specific_benefit": "reduce deployment time by 50%", "sender_name": "Your Name"}'::jsonb
FROM workspaces w
ON CONFLICT DO NOTHING;

-- Comments
COMMENT ON TABLE campaign_email_accounts IS 'Workspace-specific email accounts configured for outreach campaigns';
COMMENT ON TABLE campaign_email_logs IS 'Complete log of all campaign emails sent with delivery tracking';
COMMENT ON TABLE campaign_email_templates IS 'Reusable email templates for different campaign types';
COMMENT ON TABLE campaign_email_sequences IS 'Multi-step email sequences for automated follow-up';
COMMENT ON FUNCTION can_send_email IS 'Checks rate limits and account health before sending campaign emails';
COMMENT ON FUNCTION log_campaign_email_send IS 'Logs campaign email attempts and updates usage counters';
COMMENT ON FUNCTION update_email_delivery_status IS 'Updates delivery status and account reputation based on email outcomes';