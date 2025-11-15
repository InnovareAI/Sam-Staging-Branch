-- Add account_metadata column to user_unipile_accounts table
-- This column stores the full account data from Unipile for debugging and reference

ALTER TABLE user_unipile_accounts
ADD COLUMN IF NOT EXISTS account_metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN user_unipile_accounts.account_metadata IS
'Full account data from Unipile API for debugging and reference';
