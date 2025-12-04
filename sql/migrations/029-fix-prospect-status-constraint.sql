-- Migration: Fix Campaign Prospects Status Constraint
-- Date: December 4, 2025
-- Purpose: Add missing statuses that are used in code but not in CHECK constraint
--
-- CRITICAL FIXES:
-- 1. Add 'connection_request_sent' (used throughout codebase, missing from 20251031 migration)
-- 2. Add 'messaging' (used by follow-up and messenger campaigns)
-- 3. Add additional statuses used by cron jobs (already_invited, invitation_declined, rate_limited, etc.)

-- Drop the old constraint
ALTER TABLE campaign_prospects
DROP CONSTRAINT IF EXISTS campaign_prospects_status_check;

-- Add new comprehensive status constraint
ALTER TABLE campaign_prospects
ADD CONSTRAINT campaign_prospects_status_check
CHECK (status IN (
    -- Initial states
    'pending',              -- Initial state (not yet contacted)
    'approved',             -- Approved for outreach (messenger campaigns)
    'ready_to_message',     -- Ready to send (legacy)
    'queued_in_n8n',        -- Queued in N8N workflow (legacy)

    -- Active outreach states
    'contacted',            -- Connection request sent (legacy name)
    'connection_requested', -- LinkedIn connection request sent (old name - keep for backwards compatibility)
    'connection_request_sent', -- LinkedIn connection request sent (CURRENT STANDARD - used in code)
    'connected',            -- LinkedIn connection accepted
    'messaging',            -- Follow-up or direct message sent (CRITICAL - used by messenger campaigns)
    'message_sent',         -- Legacy message sent status
    'followed_up',          -- Follow-up message sent (legacy)
    'replied',              -- Prospect replied to our message

    -- Completion states
    'completed',            -- Campaign sequence completed successfully
    'converted',            -- Prospect converted to customer/opportunity

    -- Error/failure states
    'failed',               -- Failed to send (generic error)
    'error',                -- Error occurred during processing
    'bounced',              -- Email bounced (for email campaigns)
    'already_invited',      -- LinkedIn: invitation already pending
    'invitation_declined',  -- LinkedIn: invitation was declined
    'rate_limited',         -- Rate limited (generic)
    'rate_limited_cr',      -- Rate limited on connection requests
    'rate_limited_message', -- Rate limited on messages

    -- Inactive/terminal states
    'not_interested',       -- Prospect declined/not interested
    'opted_out',            -- Prospect opted out of campaign
    'paused',               -- Paused for this prospect
    'excluded',             -- Excluded from campaign
    'duplicate_blocked'     -- Blocked as duplicate prospect
));

-- Add comment explaining status usage
COMMENT ON COLUMN campaign_prospects.status IS 'Prospect status in campaign flow. Key statuses: connection_request_sent (CR sent), connected (CR accepted), messaging (follow-up sent), replied (prospect responded). See migration 029 for full list.';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_status
    ON campaign_prospects(status);

CREATE INDEX IF NOT EXISTS idx_campaign_prospects_messaging
    ON campaign_prospects(campaign_id, status)
    WHERE status IN ('connection_request_sent', 'connected', 'messaging', 'replied');

CREATE INDEX IF NOT EXISTS idx_campaign_prospects_active
    ON campaign_prospects(campaign_id, status)
    WHERE status IN ('pending', 'approved', 'connection_request_sent', 'connected', 'messaging');

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE '✅ Campaign prospects status constraint updated';
    RAISE NOTICE '';
    RAISE NOTICE 'Added critical statuses:';
    RAISE NOTICE '  - connection_request_sent (used by process-send-queue cron)';
    RAISE NOTICE '  - messaging (used by messenger campaigns and follow-ups)';
    RAISE NOTICE '  - already_invited, invitation_declined (Unipile error states)';
    RAISE NOTICE '  - rate_limited_cr, rate_limited_message (rate limit tracking)';
    RAISE NOTICE '';
    RAISE NOTICE 'Status flow:';
    RAISE NOTICE '  Connector: pending → connection_request_sent → connected → messaging → replied';
    RAISE NOTICE '  Messenger: approved → messaging → replied';
END $$;
