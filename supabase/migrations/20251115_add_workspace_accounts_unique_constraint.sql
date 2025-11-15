-- Add missing unique constraint to workspace_accounts table
-- This constraint is required by the associate_account_atomic RPC function

-- Check if constraint already exists (safe to run multiple times)
DO $$
BEGIN
    -- Add the unique constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'workspace_accounts_workspace_id_user_id_account_type_account__key'
           OR conname = 'workspace_accounts_unique_account_per_workspace'
    ) THEN
        ALTER TABLE workspace_accounts
        ADD CONSTRAINT workspace_accounts_unique_account_per_workspace
        UNIQUE (workspace_id, user_id, account_type, account_identifier);

        RAISE NOTICE 'Added unique constraint to workspace_accounts';
    ELSE
        RAISE NOTICE 'Unique constraint already exists on workspace_accounts';
    END IF;
END $$;

-- Add helpful comment
COMMENT ON CONSTRAINT workspace_accounts_unique_account_per_workspace ON workspace_accounts IS
'Ensures one unique account per workspace, user, account type, and identifier combination.
Required by associate_account_atomic RPC for ON CONFLICT upsert operations.';
