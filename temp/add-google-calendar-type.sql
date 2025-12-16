-- Add google_calendar to allowed account types
ALTER TABLE workspace_accounts 
DROP CONSTRAINT IF EXISTS workspace_accounts_account_type_check;

ALTER TABLE workspace_accounts 
ADD CONSTRAINT workspace_accounts_account_type_check 
CHECK (account_type IN ('linkedin', 'email', 'google_calendar', 'google', 'outlook_calendar', 'calcom', 'calendly'));
