-- Migration: Enforce linkedin_account_id foreign key constraint
-- This PERMANENTLY prevents campaigns from referencing non-existent LinkedIn accounts
-- Run this in Supabase SQL Editor

-- Step 1: First, fix all existing broken references by setting them to NULL
-- (campaigns without valid accounts will fail to send, which is correct behavior)
UPDATE campaigns
SET linkedin_account_id = NULL
WHERE linkedin_account_id IS NOT NULL
  AND linkedin_account_id NOT IN (SELECT id FROM user_unipile_accounts);

-- Step 2: Add the foreign key constraint
-- This will BLOCK any future inserts/updates that reference non-existent accounts
ALTER TABLE campaigns
ADD CONSTRAINT fk_campaigns_linkedin_account
FOREIGN KEY (linkedin_account_id)
REFERENCES user_unipile_accounts(id)
ON DELETE SET NULL;

-- Step 3: Create an index for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_linkedin_account_id
ON campaigns(linkedin_account_id);

-- Step 4: Add a CHECK constraint to prevent empty string (must be NULL or valid UUID)
ALTER TABLE campaigns
ADD CONSTRAINT chk_linkedin_account_id_format
CHECK (linkedin_account_id IS NULL OR linkedin_account_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- Verify the constraint exists
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'campaigns'
  AND tc.constraint_type IN ('FOREIGN KEY', 'CHECK');
