-- Create linkedin_searches table for tracking and quota enforcement
CREATE TABLE IF NOT EXISTS linkedin_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    workspace_id TEXT,
    unipile_account_id TEXT,
    search_query TEXT,
    search_params JSONB,
    api_type TEXT,
    category TEXT,
    results_count INTEGER DEFAULT 0,
    prospects JSONB DEFAULT '[]'::jsonb,
    next_cursor TEXT,
    searched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Enable RLS
ALTER TABLE linkedin_searches ENABLE ROW LEVEL SECURITY;
-- Workspace-based isolation policy
CREATE POLICY "Users can only see searches in their workspace" ON linkedin_searches FOR ALL USING (
    workspace_id IN (
        SELECT workspace_id::text
        FROM workspace_members
        WHERE user_id = auth.uid()
    )
);
-- Indexes for performance and isolation
CREATE INDEX IF NOT EXISTS idx_linkedin_searches_workspace ON linkedin_searches(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_searches_account ON linkedin_searches(unipile_account_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_searches_time ON linkedin_searches(searched_at);