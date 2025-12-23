-- Add unipile_account_id to linkedin_searches to track quota per account
ALTER TABLE linkedin_searches
ADD COLUMN IF NOT EXISTS unipile_account_id TEXT;
-- Index for quota tracking
CREATE INDEX IF NOT EXISTS idx_linkedin_searches_account_time ON linkedin_searches(unipile_account_id, searched_at);