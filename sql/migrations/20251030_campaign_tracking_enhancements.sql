-- Migration: Campaign Tracking Enhancements
-- Purpose: Ensure proper tracking of LinkedIn campaign execution via N8N
-- Date: 2025-10-30

-- 1. Verify and add missing columns (if they don't exist)
DO $$
BEGIN
    -- Check if contacted_at exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaign_prospects' AND column_name = 'contacted_at'
    ) THEN
        ALTER TABLE campaign_prospects ADD COLUMN contacted_at TIMESTAMPTZ;
        RAISE NOTICE 'Added contacted_at column';
    END IF;

    -- Check if status exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaign_prospects' AND column_name = 'status'
    ) THEN
        ALTER TABLE campaign_prospects ADD COLUMN status TEXT DEFAULT 'pending';
        RAISE NOTICE 'Added status column';
    END IF;

    -- Check if personalization_data exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaign_prospects' AND column_name = 'personalization_data'
    ) THEN
        ALTER TABLE campaign_prospects ADD COLUMN personalization_data JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added personalization_data column';
    END IF;
END $$;

-- 2. Add check constraint for valid status values (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'campaign_prospects_status_check'
        AND table_name = 'campaign_prospects'
    ) THEN
        ALTER TABLE campaign_prospects
        ADD CONSTRAINT campaign_prospects_status_check
        CHECK (status IN (
            'pending',
            'approved',
            'ready_to_message',
            'queued_in_n8n',
            'contacted',
            'replied',
            'not_interested',
            'failed',
            'error'
        ));
        RAISE NOTICE 'Added status check constraint';
    END IF;
END $$;

-- 3. Create indexes for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_status
    ON campaign_prospects(status);

CREATE INDEX IF NOT EXISTS idx_campaign_prospects_contacted_at
    ON campaign_prospects(contacted_at);

CREATE INDEX IF NOT EXISTS idx_campaign_prospects_campaign_status
    ON campaign_prospects(campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_campaign_prospects_ready_to_contact
    ON campaign_prospects(campaign_id)
    WHERE contacted_at IS NULL
    AND status IN ('pending', 'approved', 'ready_to_message');

-- 4. Create helper function for N8N to update prospect status
CREATE OR REPLACE FUNCTION update_prospect_contacted(
    p_prospect_id UUID,
    p_unipile_message_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_updated_row campaign_prospects%ROWTYPE;
BEGIN
    -- Update the prospect
    UPDATE campaign_prospects
    SET
        contacted_at = NOW(),
        status = 'contacted',
        personalization_data = personalization_data || jsonb_build_object(
            'unipile_message_id', COALESCE(p_unipile_message_id, 'unknown'),
            'contacted_via', 'n8n_workflow',
            'contacted_method', 'linkedin_connection_request',
            'contacted_timestamp', NOW()
        )
    WHERE id = p_prospect_id
    RETURNING * INTO v_updated_row;

    -- Check if update was successful
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Prospect not found',
            'prospect_id', p_prospect_id
        );
    END IF;

    -- Return success response
    RETURN jsonb_build_object(
        'success', true,
        'prospect_id', v_updated_row.id,
        'contacted_at', v_updated_row.contacted_at,
        'status', v_updated_row.status,
        'first_name', v_updated_row.first_name,
        'last_name', v_updated_row.last_name
    );
END;
$$;

-- 5. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_prospect_contacted TO authenticated;
GRANT EXECUTE ON FUNCTION update_prospect_contacted TO service_role;

-- 6. Create helper function to get prospects ready for messaging
CREATE OR REPLACE FUNCTION get_prospects_ready_for_messaging(
    p_campaign_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    campaign_id UUID,
    first_name TEXT,
    last_name TEXT,
    linkedin_url TEXT,
    title TEXT,
    company_name TEXT,
    status TEXT,
    personalization_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cp.id,
        cp.campaign_id,
        cp.first_name,
        cp.last_name,
        cp.linkedin_url,
        cp.title,
        cp.company_name,
        cp.status,
        cp.personalization_data
    FROM campaign_prospects cp
    WHERE cp.campaign_id = p_campaign_id
        AND cp.contacted_at IS NULL
        AND cp.linkedin_url IS NOT NULL
        AND cp.status IN ('pending', 'approved', 'ready_to_message')
    ORDER BY cp.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_prospects_ready_for_messaging TO authenticated;
GRANT EXECUTE ON FUNCTION get_prospects_ready_for_messaging TO service_role;

-- 7. Add comment documentation
COMMENT ON FUNCTION update_prospect_contacted IS
'Updates prospect status to contacted after N8N sends LinkedIn message.
Called by N8N workflow after successful message delivery.';

COMMENT ON FUNCTION get_prospects_ready_for_messaging IS
'Returns prospects ready for messaging in a campaign.
Used by N8N and cron jobs to get next batch of prospects to contact.';

COMMENT ON COLUMN campaign_prospects.contacted_at IS
'Timestamp when prospect was first contacted via LinkedIn/email';

COMMENT ON COLUMN campaign_prospects.status IS
'Current status: pending, approved, ready_to_message, queued_in_n8n, contacted, replied, not_interested, failed, error';

COMMENT ON COLUMN campaign_prospects.personalization_data IS
'JSONB field storing campaign execution metadata: unipile_message_id, contacted_via, enrichment data, etc.';
