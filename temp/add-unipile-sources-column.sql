-- Add unipile_sources column to workspace_accounts table
-- This column stores the array of sources from Unipile which contains active session IDs
-- needed for API calls during campaign execution

ALTER TABLE workspace_accounts
ADD COLUMN IF NOT EXISTS unipile_sources JSONB DEFAULT '[]'::jsonb;

-- Add index for faster queries on source status
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_unipile_sources
ON workspace_accounts USING GIN (unipile_sources);

-- Add comment for documentation
COMMENT ON COLUMN workspace_accounts.unipile_sources IS
'Array of Unipile source objects containing active session IDs for API calls. Each source has id, status, and other metadata from Unipile.';
