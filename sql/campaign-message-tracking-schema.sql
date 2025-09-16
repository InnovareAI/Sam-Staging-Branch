-- Campaign Message Tracking Schema
-- Enables campaign-specific reply filtering for unified inbox
-- Supports multiple campaigns per funnel with A/B testing and multi-ICP targeting

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Campaigns table - Each campaign is a unique execution
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    funnel_id UUID, -- References the funnel used (can be shared across campaigns)
    
    -- Campaign identification
    name TEXT NOT NULL,
    description TEXT,
    campaign_type TEXT NOT NULL CHECK (campaign_type IN ('linkedin', 'email', 'multi_channel')),
    
    -- Campaign configuration
    target_icp JSONB, -- ICP targeting configuration
    ab_test_variant TEXT, -- 'A', 'B', 'control', etc.
    message_templates JSONB, -- Message variations used
    
    -- Campaign status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    launched_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workspace_id, name)
);

-- 2. Campaign messages - Track all outbound messages per campaign
CREATE TABLE IF NOT EXISTS campaign_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Message identification
    platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'email', 'whatsapp', 'instagram')),
    platform_message_id TEXT NOT NULL, -- Unipile message ID
    conversation_id TEXT, -- Unipile conversation ID for reply matching
    thread_id TEXT, -- Platform-specific thread ID
    
    -- Recipient information
    recipient_email TEXT,
    recipient_linkedin_profile TEXT,
    recipient_name TEXT,
    prospect_id UUID, -- Link to prospects table if exists
    
    -- Message content
    subject_line TEXT,
    message_content TEXT NOT NULL,
    message_template_variant TEXT, -- Which template/variant was used
    
    -- Sending details
    sent_at TIMESTAMPTZ NOT NULL,
    sent_via TEXT, -- 'unipile', 'n8n', 'manual'
    sender_account TEXT, -- Which account sent the message
    
    -- Reply tracking
    expects_reply BOOLEAN DEFAULT true,
    reply_received_at TIMESTAMPTZ,
    reply_count INTEGER DEFAULT 0,
    last_reply_at TIMESTAMPTZ,
    
    -- Status
    delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read', 'bounced', 'failed')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint prevents duplicate tracking
    UNIQUE(platform, platform_message_id)
);

-- 3. Campaign replies - Track all replies to campaign messages
CREATE TABLE IF NOT EXISTS campaign_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_message_id UUID NOT NULL REFERENCES campaign_messages(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Reply identification
    platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'email', 'whatsapp', 'instagram')),
    platform_reply_id TEXT NOT NULL, -- Unipile reply message ID
    conversation_id TEXT, -- Must match campaign_messages.conversation_id
    thread_id TEXT, -- Platform-specific thread ID
    
    -- Reply content
    reply_content TEXT NOT NULL,
    reply_type TEXT DEFAULT 'text' CHECK (reply_type IN ('text', 'attachment', 'emoji', 'link')),
    has_attachments BOOLEAN DEFAULT false,
    
    -- Sender information (the person replying to our campaign)
    sender_email TEXT,
    sender_linkedin_profile TEXT,
    sender_name TEXT,
    
    -- Reply classification
    reply_sentiment TEXT CHECK (reply_sentiment IN ('positive', 'neutral', 'negative', 'interested', 'not_interested')),
    reply_priority TEXT DEFAULT 'medium' CHECK (reply_priority IN ('high', 'medium', 'low')),
    requires_action BOOLEAN DEFAULT true,
    action_taken BOOLEAN DEFAULT false,
    
    -- Timing
    received_at TIMESTAMPTZ NOT NULL,
    response_time_hours DECIMAL, -- Hours between our message and their reply
    
    -- Processing status
    is_processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    processed_by UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint prevents duplicate replies
    UNIQUE(platform, platform_reply_id)
);

-- 4. Campaign reply actions - Track actions taken on replies
CREATE TABLE IF NOT EXISTS campaign_reply_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_reply_id UUID NOT NULL REFERENCES campaign_replies(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Action details
    action_type TEXT NOT NULL CHECK (action_type IN ('responded', 'scheduled_followup', 'marked_interested', 'marked_not_interested', 'assigned_to_sales', 'archived')),
    action_description TEXT,
    
    -- Response details (if action was responding)
    response_content TEXT,
    response_sent_at TIMESTAMPTZ,
    response_template_used TEXT,
    
    -- Assignment details
    assigned_to UUID REFERENCES auth.users(id),
    due_date TIMESTAMPTZ,
    
    -- Metadata
    taken_by UUID NOT NULL REFERENCES auth.users(id),
    taken_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_status ON campaigns(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_launched_at ON campaigns(launched_at) WHERE launched_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign ON campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_conversation ON campaign_messages(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_messages_platform ON campaign_messages(platform, platform_message_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_sent_at ON campaign_messages(sent_at);

CREATE INDEX IF NOT EXISTS idx_campaign_replies_campaign ON campaign_replies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_conversation ON campaign_replies(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_replies_priority ON campaign_replies(reply_priority, requires_action);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_received_at ON campaign_replies(received_at);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_unprocessed ON campaign_replies(workspace_id, is_processed) WHERE is_processed = false;

CREATE INDEX IF NOT EXISTS idx_campaign_reply_actions_reply ON campaign_reply_actions(campaign_reply_id);
CREATE INDEX IF NOT EXISTS idx_campaign_reply_actions_taken_at ON campaign_reply_actions(taken_at);

-- Enable Row Level Security
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_reply_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Campaigns: Users can see campaigns in their workspace
CREATE POLICY "Users can access workspace campaigns" ON campaigns
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- Campaign messages: Users can see messages from their workspace campaigns
CREATE POLICY "Users can access workspace campaign messages" ON campaign_messages
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- Campaign replies: Users can see replies to their workspace campaign messages
CREATE POLICY "Users can access workspace campaign replies" ON campaign_replies
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- Campaign reply actions: Users can see actions on their workspace campaign replies
CREATE POLICY "Users can access workspace campaign reply actions" ON campaign_reply_actions
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- Functions for campaign tracking

-- Function to create a new campaign
CREATE OR REPLACE FUNCTION create_campaign(
    p_workspace_id UUID,
    p_name TEXT,
    p_description TEXT DEFAULT NULL,
    p_campaign_type TEXT DEFAULT 'multi_channel',
    p_target_icp JSONB DEFAULT '{}',
    p_ab_test_variant TEXT DEFAULT NULL,
    p_message_templates JSONB DEFAULT '{}',
    p_created_by UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_campaign_id UUID;
BEGIN
    INSERT INTO campaigns (
        workspace_id, name, description, campaign_type, 
        target_icp, ab_test_variant, message_templates, created_by
    ) VALUES (
        p_workspace_id, p_name, p_description, p_campaign_type, 
        p_target_icp, p_ab_test_variant, p_message_templates, p_created_by
    ) RETURNING id INTO v_campaign_id;
    
    RETURN v_campaign_id;
END;
$$;

-- Function to track campaign message
CREATE OR REPLACE FUNCTION track_campaign_message(
    p_campaign_id UUID,
    p_platform TEXT,
    p_platform_message_id TEXT,
    p_conversation_id TEXT DEFAULT NULL,
    p_thread_id TEXT DEFAULT NULL,
    p_recipient_email TEXT DEFAULT NULL,
    p_recipient_linkedin_profile TEXT DEFAULT NULL,
    p_recipient_name TEXT DEFAULT NULL,
    p_subject_line TEXT DEFAULT NULL,
    p_message_content TEXT,
    p_message_template_variant TEXT DEFAULT NULL,
    p_sender_account TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message_id UUID;
    v_workspace_id UUID;
BEGIN
    -- Get workspace_id from campaign
    SELECT workspace_id INTO v_workspace_id FROM campaigns WHERE id = p_campaign_id;
    
    IF v_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Campaign not found: %', p_campaign_id;
    END IF;
    
    INSERT INTO campaign_messages (
        campaign_id, workspace_id, platform, platform_message_id, 
        conversation_id, thread_id, recipient_email, recipient_linkedin_profile, 
        recipient_name, subject_line, message_content, message_template_variant, 
        sent_at, sender_account
    ) VALUES (
        p_campaign_id, v_workspace_id, p_platform, p_platform_message_id, 
        p_conversation_id, p_thread_id, p_recipient_email, p_recipient_linkedin_profile, 
        p_recipient_name, p_subject_line, p_message_content, p_message_template_variant, 
        NOW(), p_sender_account
    ) RETURNING id INTO v_message_id;
    
    RETURN v_message_id;
END;
$$;

-- Function to track campaign reply
CREATE OR REPLACE FUNCTION track_campaign_reply(
    p_platform TEXT,
    p_platform_reply_id TEXT,
    p_conversation_id TEXT,
    p_thread_id TEXT DEFAULT NULL,
    p_reply_content TEXT,
    p_sender_email TEXT DEFAULT NULL,
    p_sender_linkedin_profile TEXT DEFAULT NULL,
    p_sender_name TEXT DEFAULT NULL,
    p_received_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reply_id UUID;
    v_campaign_message_id UUID;
    v_campaign_id UUID;
    v_workspace_id UUID;
    v_sent_at TIMESTAMPTZ;
    v_response_time_hours DECIMAL;
BEGIN
    -- Find the original campaign message by conversation_id
    SELECT cm.id, cm.campaign_id, cm.workspace_id, cm.sent_at
    INTO v_campaign_message_id, v_campaign_id, v_workspace_id, v_sent_at
    FROM campaign_messages cm
    WHERE cm.conversation_id = p_conversation_id
      AND cm.platform = p_platform
    ORDER BY cm.sent_at DESC
    LIMIT 1;
    
    IF v_campaign_message_id IS NULL THEN
        RAISE EXCEPTION 'No campaign message found for conversation: % on platform: %', p_conversation_id, p_platform;
    END IF;
    
    -- Calculate response time in hours
    v_response_time_hours := EXTRACT(EPOCH FROM (p_received_at - v_sent_at)) / 3600.0;
    
    INSERT INTO campaign_replies (
        campaign_message_id, campaign_id, workspace_id, platform, 
        platform_reply_id, conversation_id, thread_id, reply_content,
        sender_email, sender_linkedin_profile, sender_name, 
        received_at, response_time_hours
    ) VALUES (
        v_campaign_message_id, v_campaign_id, v_workspace_id, p_platform, 
        p_platform_reply_id, p_conversation_id, p_thread_id, p_reply_content,
        p_sender_email, p_sender_linkedin_profile, p_sender_name, 
        p_received_at, v_response_time_hours
    ) RETURNING id INTO v_reply_id;
    
    -- Update the original campaign message reply count
    UPDATE campaign_messages 
    SET reply_count = reply_count + 1,
        reply_received_at = COALESCE(reply_received_at, p_received_at),
        last_reply_at = p_received_at
    WHERE id = v_campaign_message_id;
    
    RETURN v_reply_id;
END;
$$;

-- Views for easy querying

-- Campaign performance summary
CREATE OR REPLACE VIEW campaign_performance_summary AS
SELECT 
    c.id as campaign_id,
    c.name as campaign_name,
    c.status,
    c.campaign_type,
    c.ab_test_variant,
    c.launched_at,
    COUNT(DISTINCT cm.id) as messages_sent,
    COUNT(DISTINCT cr.id) as replies_received,
    CASE 
        WHEN COUNT(DISTINCT cm.id) > 0 
        THEN ROUND((COUNT(DISTINCT cr.id)::decimal / COUNT(DISTINCT cm.id) * 100), 2)
        ELSE 0 
    END as reply_rate_percent,
    AVG(cr.response_time_hours) as avg_response_time_hours,
    COUNT(DISTINCT CASE WHEN cr.reply_sentiment = 'positive' THEN cr.id END) as positive_replies,
    COUNT(DISTINCT CASE WHEN cr.reply_sentiment = 'interested' THEN cr.id END) as interested_replies,
    COUNT(DISTINCT CASE WHEN cr.requires_action = true AND cr.is_processed = false THEN cr.id END) as pending_replies
FROM campaigns c
LEFT JOIN campaign_messages cm ON c.id = cm.campaign_id
LEFT JOIN campaign_replies cr ON cm.id = cr.campaign_message_id
GROUP BY c.id, c.name, c.status, c.campaign_type, c.ab_test_variant, c.launched_at;

-- Unprocessed campaign replies for inbox
CREATE OR REPLACE VIEW unprocessed_campaign_replies AS
SELECT 
    cr.id,
    cr.campaign_id,
    c.name as campaign_name,
    c.ab_test_variant,
    cr.platform,
    cr.reply_content,
    cr.sender_name,
    cr.sender_email,
    cr.sender_linkedin_profile,
    cr.reply_priority,
    cr.reply_sentiment,
    cr.received_at,
    cr.response_time_hours,
    cm.subject_line as original_subject,
    cm.message_content as original_message,
    cm.recipient_name as original_recipient
FROM campaign_replies cr
JOIN campaigns c ON cr.campaign_id = c.id
JOIN campaign_messages cm ON cr.campaign_message_id = cm.id
WHERE cr.is_processed = false
  AND cr.requires_action = true
ORDER BY 
    CASE cr.reply_priority 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
    END,
    cr.received_at DESC;

COMMENT ON TABLE campaigns IS 'Individual campaign executions - multiple campaigns can use same funnel';
COMMENT ON TABLE campaign_messages IS 'All outbound messages sent as part of campaigns';
COMMENT ON TABLE campaign_replies IS 'All replies received to campaign messages';
COMMENT ON TABLE campaign_reply_actions IS 'Actions taken on campaign replies';

COMMENT ON COLUMN campaigns.funnel_id IS 'References the funnel template used - multiple campaigns can share same funnel';
COMMENT ON COLUMN campaigns.ab_test_variant IS 'A/B test variation identifier (A, B, control, etc.)';
COMMENT ON COLUMN campaigns.target_icp IS 'ICP targeting configuration for this specific campaign';

COMMENT ON COLUMN campaign_messages.conversation_id IS 'Unipile conversation ID - critical for reply matching';
COMMENT ON COLUMN campaign_messages.message_template_variant IS 'Which message template/variant was used in this campaign';

COMMENT ON COLUMN campaign_replies.conversation_id IS 'Must match campaign_messages.conversation_id for proper reply detection';
COMMENT ON COLUMN campaign_replies.response_time_hours IS 'Hours between our campaign message and their reply';