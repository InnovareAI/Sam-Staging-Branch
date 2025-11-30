-- Migration: Add support for messenger campaign type
-- Date: November 30, 2025
-- Purpose: Enable messenger campaigns that send messages to already-connected prospects

-- Note: messenger campaigns use the same send_queue table as connector campaigns
-- The key difference:
-- - connector campaigns: message_type = 'connection_request' (first message) + follow_ups (requires_connection = true)
-- - messenger campaigns: message_type = 'direct_message_1', 'direct_message_2', etc. (requires_connection = false)

-- Add support for messenger message types in send_queue
-- Extend message_type to support direct_message_1, direct_message_2, etc.
COMMENT ON COLUMN send_queue.message_type IS 'Type of message: connection_request, follow_up_1-5 (connector campaigns), direct_message_1-5 (messenger campaigns)';

-- Update requires_connection logic
-- For messenger campaigns, requires_connection should always be false
-- (messages can be sent immediately since prospects are already connected)
COMMENT ON COLUMN send_queue.requires_connection IS 'If true, only send if prospect has accepted the connection request. Always false for messenger campaigns.';

-- Create index on message_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_send_queue_message_type ON send_queue(message_type);

-- Add campaign_type to campaigns table if not exists (should already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'campaign_type'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN campaign_type VARCHAR(50) DEFAULT 'connector';
  END IF;
END $$;

-- Add check constraint to ensure campaign_type is valid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'campaigns_campaign_type_check'
  ) THEN
    ALTER TABLE campaigns ADD CONSTRAINT campaigns_campaign_type_check
    CHECK (campaign_type IN ('connector', 'messenger', 'email', 'multi_channel', 'builder', 'inbound', 'company_follow', 'open_inmail', 'group', 'event_invite', 'event_participants', 'recovery', 'linkedin'));
  END IF;
END $$;

-- Add notes about messenger campaign behavior
COMMENT ON COLUMN campaigns.campaign_type IS 'Type of campaign: connector (sends CR + follow-ups), messenger (sends messages to connected prospects only), email, etc.';

-- Example messenger campaign flow:
-- 1. User uploads prospects who are ALREADY connected on LinkedIn
-- 2. Campaign creates send_queue entries with message_type = 'direct_message_1', 'direct_message_2', etc.
-- 3. All requires_connection = false (since they are already connected)
-- 4. Cron job processes queue normally, sending via /api/v1/chats/{chatId}/messages
-- 5. No connection request is ever sent

-- Verification query:
-- SELECT campaign_id, message_type, requires_connection, COUNT(*)
-- FROM send_queue
-- GROUP BY campaign_id, message_type, requires_connection;
