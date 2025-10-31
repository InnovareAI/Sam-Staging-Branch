-- Migration: Clean Up Campaign Prospects Schema
-- Purpose: Remove old unused statuses and fix constraint issues
-- Date: 2025-10-31
-- CRITICAL: This fixes the status constraint preventing updates

-- ============================================================================
-- PART 1: Fix Status Constraint
-- ============================================================================

-- Drop the old constraint that's causing issues
ALTER TABLE campaign_prospects
DROP CONSTRAINT IF EXISTS campaign_prospects_status_check;

-- Add new simplified status constraint with only statuses we actually use
ALTER TABLE campaign_prospects
ADD CONSTRAINT campaign_prospects_status_check
CHECK (status IN (
    -- Active statuses
    'pending',              -- Initial state
    'approved',             -- Approved for outreach
    'ready_to_message',     -- Ready to send
    'queued_in_n8n',        -- Queued in N8N workflow
    'contacted',            -- Connection request sent (legacy)
    'connection_requested', -- LinkedIn connection request sent (new standard)
    'connected',            -- LinkedIn connection accepted
    'replied',              -- Prospect replied
    'completed',            -- Campaign sequence completed

    -- Error states
    'failed',               -- Failed to send
    'error',                -- Error occurred
    'bounced',              -- Email bounced

    -- Inactive states
    'not_interested',       -- Prospect declined
    'paused',               -- Paused for this prospect
    'excluded'              -- Excluded from campaign
));

-- ============================================================================
-- PART 2: Update Indexes for Current Schema
-- ============================================================================

-- Ensure key indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_status
    ON campaign_prospects(status);

CREATE INDEX IF NOT EXISTS idx_campaign_prospects_contacted_at
    ON campaign_prospects(contacted_at)
    WHERE contacted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_prospects_campaign_status
    ON campaign_prospects(campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_campaign_prospects_workspace
    ON campaign_prospects(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_campaign_prospects_queued
    ON campaign_prospects(campaign_id, status)
    WHERE status = 'queued_in_n8n';

CREATE INDEX IF NOT EXISTS idx_campaign_prospects_ready
    ON campaign_prospects(campaign_id, status)
    WHERE status IN ('approved', 'ready_to_message');

-- ============================================================================
-- PART 3: Helper Function to Update Prospect Status
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_prospect_contacted(
    p_prospect_id UUID,
    p_unipile_message_id TEXT DEFAULT NULL,
    p_contacted_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Update prospect to connection_requested status
    UPDATE campaign_prospects
    SET
        contacted_at = p_contacted_at,
        status = 'connection_requested',
        personalization_data = COALESCE(personalization_data, '{}'::jsonb) ||
            jsonb_build_object(
                'unipile_message_id', COALESCE(p_unipile_message_id, personalization_data->>'unipile_message_id'),
                'marked_contacted_at', NOW(),
                'contacted_via', 'linkedin'
            ),
        updated_at = NOW()
    WHERE id = p_prospect_id
    RETURNING jsonb_build_object(
        'success', true,
        'prospect_id', id,
        'status', status,
        'contacted_at', contacted_at,
        'name', first_name || ' ' || last_name
    ) INTO v_result;

    IF v_result IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Prospect not found',
            'prospect_id', p_prospect_id
        );
    END IF;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION mark_prospect_contacted IS 'Marks a prospect as contacted and updates status to connection_requested';

-- ============================================================================
-- PART 4: Migration Notes
-- ============================================================================

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE '✅ Campaign prospects schema cleaned up successfully';
    RAISE NOTICE '   - Status constraint updated with current statuses';
    RAISE NOTICE '   - Performance indexes created';
    RAISE NOTICE '   - Helper function mark_prospect_contacted() available';
    RAISE NOTICE '';
    RAISE NOTICE 'Valid statuses now:';
    RAISE NOTICE '   Active: pending, approved, ready_to_message, queued_in_n8n, contacted, connection_requested, connected, replied, completed';
    RAISE NOTICE '   Errors: failed, error, bounced';
    RAISE NOTICE '   Inactive: not_interested, paused, excluded';
END $$;
