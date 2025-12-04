-- Add metadata column to prospect_approval_sessions
-- This column stores new architecture info like batch_id

ALTER TABLE prospect_approval_sessions
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_prospect_approval_sessions_metadata
ON prospect_approval_sessions USING GIN (metadata);

COMMENT ON COLUMN prospect_approval_sessions.metadata IS 'JSON metadata including batch_id for new architecture sessions';
