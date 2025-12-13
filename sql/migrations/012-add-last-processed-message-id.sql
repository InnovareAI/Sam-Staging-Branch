-- Migration: Add last_processed_message_id to campaign_prospects
-- Purpose: Track the last message we processed for multi-turn conversation support
-- Date: 2025-12-13

-- Add column to track the last Unipile message ID we processed for each prospect
-- This enables the Reply Agent to detect NEW messages (2nd, 3rd replies) after the first
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS last_processed_message_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_last_processed_message_id
ON campaign_prospects(last_processed_message_id)
WHERE last_processed_message_id IS NOT NULL;

-- Comment explaining the column
COMMENT ON COLUMN campaign_prospects.last_processed_message_id IS
'Unipile message ID of the last inbound message we processed. Used to detect new messages in multi-turn conversations.';
