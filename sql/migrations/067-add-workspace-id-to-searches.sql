-- Add workspace_id to linkedin_searches for tenant isolation
ALTER TABLE linkedin_searches
ADD COLUMN IF NOT EXISTS workspace_id TEXT;
-- Index for workspace-based isolation
CREATE INDEX IF NOT EXISTS idx_linkedin_searches_workspace ON linkedin_searches(workspace_id);