-- Migration: Add message_type and requires_connection to send_queue
-- Date: November 23, 2025
-- Purpose: Support pre-queuing all 6 messages (CR + 5 follow-ups) with conditional sending

-- Add message_type column (connection_request, follow_up_1, follow_up_2, etc.)
ALTER TABLE send_queue
ADD COLUMN IF NOT EXISTS message_type VARCHAR(50) DEFAULT 'connection_request';

-- Add requires_connection column (true for follow-ups, false for CR)
ALTER TABLE send_queue
ADD COLUMN IF NOT EXISTS requires_connection BOOLEAN DEFAULT false;

-- Drop the UNIQUE constraint on (campaign_id, prospect_id)
-- because we now have multiple messages per prospect
ALTER TABLE send_queue
DROP CONSTRAINT IF EXISTS send_queue_campaign_id_prospect_id_key;

-- Add new UNIQUE constraint on (campaign_id, prospect_id, message_type)
ALTER TABLE send_queue
ADD CONSTRAINT send_queue_campaign_prospect_message_unique
UNIQUE (campaign_id, prospect_id, message_type);

-- Update existing records to have message_type = 'connection_request'
UPDATE send_queue
SET message_type = 'connection_request',
    requires_connection = false
WHERE message_type IS NULL;

COMMENT ON COLUMN send_queue.message_type IS 'Type of message: connection_request, follow_up_1, follow_up_2, follow_up_3, follow_up_4, follow_up_5';
COMMENT ON COLUMN send_queue.requires_connection IS 'If true, only send if prospect has accepted the connection request';
