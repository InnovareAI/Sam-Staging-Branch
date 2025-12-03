-- Migration: Add linkedin_chat_id for messenger campaigns
-- Purpose: Store Unipile chat thread ID for sending messages to connections
-- Date: December 4, 2025

-- ============================================================================
-- Add linkedin_chat_id column to workspace_prospects
-- ============================================================================

-- The chat_id is required for sending messages via Unipile's messenger API
-- It's obtained when:
-- 1. Connection is accepted (from poll-accepted-connections)
-- 2. User sends first message (creates chat)
-- 3. User receives first message (chat already exists)

ALTER TABLE workspace_prospects
ADD COLUMN IF NOT EXISTS linkedin_chat_id TEXT;

-- Add connection_status to track LinkedIn connection state
-- Useful for filtering prospects for different campaign types
ALTER TABLE workspace_prospects
ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'unknown';

-- Add index for finding prospects with chat_id (for messenger campaigns)
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_chat_id
  ON workspace_prospects(linkedin_chat_id)
  WHERE linkedin_chat_id IS NOT NULL;

-- Add index for connection status filtering
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_connection_status
  ON workspace_prospects(workspace_id, connection_status)
  WHERE connection_status IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN workspace_prospects.linkedin_chat_id IS 'Unipile chat thread ID for sending messages. Required for messenger campaigns.';
COMMENT ON COLUMN workspace_prospects.connection_status IS 'LinkedIn connection status: unknown, not_connected, pending, connected, withdrawn';
