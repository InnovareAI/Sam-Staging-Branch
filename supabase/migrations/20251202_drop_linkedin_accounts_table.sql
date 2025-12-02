-- Drop linkedin_accounts table - LinkedIn accounts are managed via Unipile API, not local DB
-- This table was never properly used and caused confusion in health checks

-- Drop table if it exists
DROP TABLE IF EXISTS linkedin_accounts CASCADE;

-- Note: LinkedIn account data is stored in and managed by Unipile external service
-- Access via Unipile API: GET https://{UNIPILE_DSN}/api/v1/accounts
