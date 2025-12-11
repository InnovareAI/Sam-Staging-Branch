-- Migration: Create linkedin_messages table
-- Stores all LinkedIn messages (outgoing and incoming) for audit and conversation history
-- Created: December 11, 2025

-- Create linkedin_messages table
CREATE TABLE IF NOT EXISTS linkedin_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    prospect_id UUID REFERENCES campaign_prospects(id) ON DELETE SET NULL,
    linkedin_account_id UUID REFERENCES linkedin_accounts(id) ON DELETE SET NULL,

    -- Message details
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('outgoing', 'incoming')),
    message_type VARCHAR(50) NOT NULL DEFAULT 'message', -- 'connection_request', 'message', 'follow_up', 'inmail'

    -- Content
    subject TEXT, -- For InMails
    content TEXT NOT NULL,

    -- LinkedIn identifiers
    unipile_message_id VARCHAR(255), -- Unipile's message ID
    unipile_chat_id VARCHAR(255), -- Unipile's chat/conversation ID
    linkedin_conversation_id VARCHAR(255), -- LinkedIn's conversation URN

    -- Sender/Recipient info
    sender_linkedin_url TEXT,
    sender_name TEXT,
    sender_linkedin_id VARCHAR(255),
    recipient_linkedin_url TEXT,
    recipient_name TEXT,
    recipient_linkedin_id VARCHAR(255),

    -- Status tracking
    status VARCHAR(50) DEFAULT 'sent', -- 'pending', 'sent', 'delivered', 'read', 'failed'
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,

    -- Error tracking
    error_message TEXT,
    retry_count INT DEFAULT 0,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_linkedin_messages_workspace ON linkedin_messages(workspace_id);
CREATE INDEX idx_linkedin_messages_campaign ON linkedin_messages(campaign_id);
CREATE INDEX idx_linkedin_messages_prospect ON linkedin_messages(prospect_id);
CREATE INDEX idx_linkedin_messages_direction ON linkedin_messages(direction);
CREATE INDEX idx_linkedin_messages_created ON linkedin_messages(created_at DESC);
CREATE INDEX idx_linkedin_messages_unipile_chat ON linkedin_messages(unipile_chat_id);
CREATE INDEX idx_linkedin_messages_sender ON linkedin_messages(sender_linkedin_id);
CREATE INDEX idx_linkedin_messages_recipient ON linkedin_messages(recipient_linkedin_id);

-- Composite index for conversation history queries
CREATE INDEX idx_linkedin_messages_conversation ON linkedin_messages(prospect_id, created_at DESC);

-- Enable RLS
ALTER TABLE linkedin_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view messages in their workspace" ON linkedin_messages
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role has full access" ON linkedin_messages
    FOR ALL USING (auth.role() = 'service_role');

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_linkedin_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER linkedin_messages_updated_at
    BEFORE UPDATE ON linkedin_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_linkedin_messages_updated_at();

-- Add helpful comments
COMMENT ON TABLE linkedin_messages IS 'Stores all LinkedIn messages (outgoing connection requests, messages, and incoming replies)';
COMMENT ON COLUMN linkedin_messages.direction IS 'outgoing = sent by us, incoming = received from prospect';
COMMENT ON COLUMN linkedin_messages.message_type IS 'connection_request, message, follow_up, inmail';
COMMENT ON COLUMN linkedin_messages.unipile_chat_id IS 'Unipile conversation ID for grouping messages';
