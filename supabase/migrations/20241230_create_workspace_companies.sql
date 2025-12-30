-- Migration: Create workspace_companies table
-- Description: Store companies imported from Sales Navigator for bulk decision-maker discovery
CREATE TABLE IF NOT EXISTS workspace_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    linkedin_url TEXT,
    linkedin_id TEXT,
    industry TEXT,
    employee_count TEXT,
    location TEXT,
    description TEXT,
    logo_url TEXT,
    website TEXT,
    status TEXT DEFAULT 'pending',
    -- pending, processing, processed, archived
    prospects_found INTEGER DEFAULT 0,
    source TEXT DEFAULT 'sales_navigator',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_workspace_companies_workspace ON workspace_companies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_companies_status ON workspace_companies(status);
CREATE INDEX IF NOT EXISTS idx_workspace_companies_linkedin_id ON workspace_companies(linkedin_id);
-- RLS policies
ALTER TABLE workspace_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view companies in their workspace" ON workspace_companies FOR
SELECT USING (
        workspace_id IN (
            SELECT workspace_id
            FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert companies in their workspace" ON workspace_companies FOR
INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );
CREATE POLICY "Users can update companies in their workspace" ON workspace_companies FOR
UPDATE USING (
        workspace_id IN (
            SELECT workspace_id
            FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );
CREATE POLICY "Users can delete companies in their workspace" ON workspace_companies FOR DELETE USING (
    workspace_id IN (
        SELECT workspace_id
        FROM workspace_members
        WHERE user_id = auth.uid()
    )
);