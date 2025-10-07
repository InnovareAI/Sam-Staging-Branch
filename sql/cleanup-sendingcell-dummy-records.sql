-- Remove the incorrectly added email account records
-- These were added by mistake - Cathy and Dave only need workspace user accounts, not email accounts

DELETE FROM workspace_accounts
WHERE account_identifier IN ('cathy.smith@sendingcell.com', 'dave.stuteville@sendingcell.com')
AND account_type = 'email'
AND account_metadata->>'manually_added' = 'true';

-- Verify deletion
SELECT
  account_identifier,
  account_type,
  connection_status
FROM workspace_accounts
WHERE account_identifier LIKE '%sendingcell.com';
