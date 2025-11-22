-- Migration: Add email_account_id to campaigns table
-- Purpose: Enable email campaign selection of which email account to send from
-- Date: 2025-11-22

-- Add email_account_id column to campaigns if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns' AND column_name = 'email_account_id'
    ) THEN
        ALTER TABLE campaigns
        ADD COLUMN email_account_id UUID REFERENCES workspace_accounts(id);
        RAISE NOTICE 'Added email_account_id column to campaigns table';
    END IF;
END $$;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_email_account_id
    ON campaigns(email_account_id);

-- Add comment documentation
COMMENT ON COLUMN campaigns.email_account_id IS
'Email account to send from for email campaigns. References workspace_accounts where account_type = "email"';
