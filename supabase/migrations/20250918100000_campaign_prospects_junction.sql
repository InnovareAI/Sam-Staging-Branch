-- Campaign Prospects Junction Table
-- Links campaigns to prospects with campaign-specific tracking
-- Enables multiple campaigns per prospect and campaign-specific status

-- Campaign prospects junction table
CREATE TABLE IF NOT EXISTS campaign_prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    prospect_id UUID NOT NULL REFERENCES workspace_prospects(id) ON DELETE CASCADE,
    
    -- Campaign-specific prospect status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',           -- Added to campaign, not yet contacted
        'invitation_sent',   -- LinkedIn invitation sent
        'connected',         -- LinkedIn connection accepted
        'message_sent',      -- Follow-up message sent
        'replied',           -- Prospect replied
        'interested',        -- Prospect showed interest
        'not_interested',    -- Prospect declined/not interested
        'bounced',           -- Email bounced
        'error',             -- Error occurred during outreach
        'completed',         -- Campaign sequence completed
        'paused',            -- Paused for this prospect
        'excluded'           -- Excluded from campaign
    )),
    
    -- LinkedIn invitation tracking
    invitation_sent_at TIMESTAMPTZ,
    invitation_id TEXT, -- Unipile invitation ID
    connection_accepted_at TIMESTAMPTZ,
    
    -- Message tracking
    first_message_sent_at TIMESTAMPTZ,
    last_message_sent_at TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,
    
    -- Reply tracking
    first_reply_at TIMESTAMPTZ,
    last_reply_at TIMESTAMPTZ,
    reply_count INTEGER DEFAULT 0,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,
    
    -- Campaign sequence tracking
    sequence_step INTEGER DEFAULT 1, -- Which step in the campaign sequence
    next_action_due_at TIMESTAMPTZ, -- When next action should be taken
    
    -- Metadata
    added_to_campaign_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate prospect per campaign
    UNIQUE(campaign_id, prospect_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_campaign ON campaign_prospects(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_prospect ON campaign_prospects(prospect_id);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_status ON campaign_prospects(status);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_next_action ON campaign_prospects(next_action_due_at) WHERE next_action_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_invitation_sent ON campaign_prospects(invitation_sent_at) WHERE invitation_sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_pending ON campaign_prospects(campaign_id, status) WHERE status = 'pending';

-- Enable Row Level Security
ALTER TABLE campaign_prospects ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can access campaign prospects in their workspace
CREATE POLICY "Users can access workspace campaign prospects" ON campaign_prospects
    FOR ALL USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members WHERE user_id = 
                (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
            )
        )
    );

-- Function to add prospects to campaign
CREATE OR REPLACE FUNCTION add_prospects_to_campaign(
    p_campaign_id UUID,
    p_prospect_ids UUID[]
)
RETURNS TABLE (
    prospect_id UUID,
    action_taken TEXT, -- 'added', 'already_exists', 'error'
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prospect_id UUID;
    v_workspace_id UUID;
    v_existing_count INTEGER;
BEGIN
    -- Get campaign workspace for validation
    SELECT workspace_id INTO v_workspace_id FROM campaigns WHERE id = p_campaign_id;
    
    IF v_workspace_id IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, 'error'::TEXT, 'Campaign not found'::TEXT;
        RETURN;
    END IF;
    
    -- Loop through each prospect ID
    FOREACH v_prospect_id IN ARRAY p_prospect_ids
    LOOP
        -- Check if prospect exists in workspace
        SELECT COUNT(*) INTO v_existing_count 
        FROM workspace_prospects 
        WHERE id = v_prospect_id AND workspace_id = v_workspace_id;
        
        IF v_existing_count = 0 THEN
            RETURN QUERY SELECT v_prospect_id, 'error'::TEXT, 'Prospect not found in workspace'::TEXT;
            CONTINUE;
        END IF;
        
        -- Check if prospect already in campaign
        SELECT COUNT(*) INTO v_existing_count 
        FROM campaign_prospects 
        WHERE campaign_id = p_campaign_id AND prospect_id = v_prospect_id;
        
        IF v_existing_count > 0 THEN
            RETURN QUERY SELECT v_prospect_id, 'already_exists'::TEXT, NULL::TEXT;
            CONTINUE;
        END IF;
        
        -- Add prospect to campaign
        BEGIN
            INSERT INTO campaign_prospects (campaign_id, prospect_id)
            VALUES (p_campaign_id, v_prospect_id);
            
            RETURN QUERY SELECT v_prospect_id, 'added'::TEXT, NULL::TEXT;
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT v_prospect_id, 'error'::TEXT, SQLERRM::TEXT;
        END;
    END LOOP;
    
    RETURN;
END;
$$;

-- Function to update campaign prospect status
CREATE OR REPLACE FUNCTION update_campaign_prospect_status(
    p_campaign_id UUID,
    p_prospect_id UUID,
    p_status TEXT,
    p_invitation_id TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status TEXT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Get current status
    SELECT status INTO v_current_status 
    FROM campaign_prospects 
    WHERE campaign_id = p_campaign_id AND prospect_id = p_prospect_id;
    
    IF v_current_status IS NULL THEN
        RETURN FALSE; -- Record not found
    END IF;
    
    -- Update based on new status
    UPDATE campaign_prospects 
    SET 
        status = p_status,
        updated_at = v_now,
        invitation_id = COALESCE(p_invitation_id, invitation_id),
        error_message = p_error_message,
        
        -- Set timestamps based on status
        invitation_sent_at = CASE 
            WHEN p_status = 'invitation_sent' AND invitation_sent_at IS NULL 
            THEN v_now 
            ELSE invitation_sent_at 
        END,
        connection_accepted_at = CASE 
            WHEN p_status = 'connected' AND connection_accepted_at IS NULL 
            THEN v_now 
            ELSE connection_accepted_at 
        END,
        first_message_sent_at = CASE 
            WHEN p_status = 'message_sent' AND first_message_sent_at IS NULL 
            THEN v_now 
            ELSE first_message_sent_at 
        END,
        last_message_sent_at = CASE 
            WHEN p_status = 'message_sent' 
            THEN v_now 
            ELSE last_message_sent_at 
        END,
        message_count = CASE 
            WHEN p_status = 'message_sent' 
            THEN message_count + 1 
            ELSE message_count 
        END,
        first_reply_at = CASE 
            WHEN p_status = 'replied' AND first_reply_at IS NULL 
            THEN v_now 
            ELSE first_reply_at 
        END,
        last_reply_at = CASE 
            WHEN p_status = 'replied' 
            THEN v_now 
            ELSE last_reply_at 
        END,
        reply_count = CASE 
            WHEN p_status = 'replied' 
            THEN reply_count + 1 
            ELSE reply_count 
        END,
        retry_count = CASE 
            WHEN p_status = 'error' 
            THEN retry_count + 1 
            ELSE retry_count 
        END,
        last_retry_at = CASE 
            WHEN p_status = 'error' 
            THEN v_now 
            ELSE last_retry_at 
        END
    WHERE campaign_id = p_campaign_id AND prospect_id = p_prospect_id;
    
    RETURN FOUND;
END;
$$;

-- Function to get campaign prospect statistics
CREATE OR REPLACE FUNCTION get_campaign_prospect_stats(
    p_campaign_id UUID
)
RETURNS TABLE (
    total_prospects BIGINT,
    pending_prospects BIGINT,
    invitations_sent BIGINT,
    connections_made BIGINT,
    messages_sent BIGINT,
    replies_received BIGINT,
    interested_prospects BIGINT,
    completed_prospects BIGINT,
    error_prospects BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_prospects,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_prospects,
        COUNT(*) FILTER (WHERE status IN ('invitation_sent', 'connected', 'message_sent', 'replied', 'interested', 'completed')) as invitations_sent,
        COUNT(*) FILTER (WHERE status IN ('connected', 'message_sent', 'replied', 'interested', 'completed')) as connections_made,
        COUNT(*) FILTER (WHERE status IN ('message_sent', 'replied', 'interested', 'completed')) as messages_sent,
        COUNT(*) FILTER (WHERE status IN ('replied', 'interested', 'completed')) as replies_received,
        COUNT(*) FILTER (WHERE status = 'interested') as interested_prospects,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_prospects,
        COUNT(*) FILTER (WHERE status = 'error') as error_prospects
    FROM campaign_prospects
    WHERE campaign_id = p_campaign_id;
END;
$$;

-- Comments
COMMENT ON TABLE campaign_prospects IS 'Junction table linking campaigns to prospects with campaign-specific tracking';
COMMENT ON COLUMN campaign_prospects.sequence_step IS 'Current step in the campaign sequence (1 = invitation, 2 = first follow-up, etc.)';
COMMENT ON COLUMN campaign_prospects.next_action_due_at IS 'When the next action should be taken for this prospect';
COMMENT ON FUNCTION add_prospects_to_campaign IS 'Safely adds multiple prospects to a campaign with validation and error handling';
COMMENT ON FUNCTION update_campaign_prospect_status IS 'Updates campaign prospect status with automatic timestamp management';
COMMENT ON FUNCTION get_campaign_prospect_stats IS 'Returns campaign performance statistics for dashboard display';