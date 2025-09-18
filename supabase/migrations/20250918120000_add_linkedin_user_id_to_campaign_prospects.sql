-- Add LinkedIn User ID to Campaign Prospects
-- This stores the LinkedIn internal ID (ACoAAA... format) for direct messaging

-- Add linkedin_user_id column to store LinkedIn internal ID format
ALTER TABLE campaign_prospects 
ADD COLUMN linkedin_user_id TEXT;

-- Create index for LinkedIn user ID lookups
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_linkedin_user_id 
ON campaign_prospects(linkedin_user_id) 
WHERE linkedin_user_id IS NOT NULL;

-- Update the update_campaign_prospect_status function to handle linkedin_user_id
CREATE OR REPLACE FUNCTION update_campaign_prospect_status(
    p_campaign_id UUID,
    p_prospect_id UUID,
    p_status TEXT,
    p_invitation_id TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_linkedin_user_id TEXT DEFAULT NULL  -- New parameter
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
        linkedin_user_id = COALESCE(p_linkedin_user_id, linkedin_user_id), -- Store LinkedIn internal ID
        
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

-- Function to find prospects with LinkedIn internal IDs for direct messaging
CREATE OR REPLACE FUNCTION get_prospects_with_linkedin_ids(
    p_campaign_id UUID,
    p_status TEXT DEFAULT 'connected'
)
RETURNS TABLE (
    prospect_id UUID,
    linkedin_user_id TEXT,
    first_name TEXT,
    last_name TEXT,
    company_name TEXT,
    linkedin_profile_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cp.prospect_id,
        cp.linkedin_user_id,
        wp.first_name,
        wp.last_name,
        wp.company_name,
        wp.linkedin_profile_url
    FROM campaign_prospects cp
    JOIN workspace_prospects wp ON cp.prospect_id = wp.id
    WHERE cp.campaign_id = p_campaign_id
      AND cp.status = p_status
      AND cp.linkedin_user_id IS NOT NULL; -- Only prospects with internal IDs
END;
$$;

-- Comments
COMMENT ON COLUMN campaign_prospects.linkedin_user_id IS 'LinkedIn internal ID (ACoAAA... format) for direct messaging - captured from webhooks';
COMMENT ON FUNCTION get_prospects_with_linkedin_ids IS 'Returns prospects with LinkedIn internal IDs ready for direct messaging';