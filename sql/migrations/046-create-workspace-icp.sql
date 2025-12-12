-- Migration: 046-create-workspace-icp.sql
-- Description: Create workspace_icp table for storing Ideal Customer Profiles
-- Date: 2025-12-12

-- Workspace ICP (Ideal Customer Profile) table
-- Stores ICP definitions that can be used for LinkedIn/Email searches
CREATE TABLE IF NOT EXISTS workspace_icp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- ICP Identity
  name TEXT NOT NULL DEFAULT 'Default ICP',
  is_default BOOLEAN DEFAULT false,

  -- Target Criteria
  titles TEXT[] DEFAULT '{}',              -- ['VP Sales', 'Sales Director', 'Head of Sales']
  seniority_levels TEXT[] DEFAULT '{}',    -- ['VP', 'Director', 'C-Level']
  industries TEXT[] DEFAULT '{}',          -- ['SaaS', 'FinTech', 'B2B Tech']
  company_size_min INT,                    -- 51
  company_size_max INT,                    -- 200
  locations TEXT[] DEFAULT '{}',           -- ['United States', 'United Kingdom', 'Berlin']
  countries TEXT[] DEFAULT '{}',           -- ['US', 'UK', 'DE']

  -- Advanced Criteria
  funding_stages TEXT[] DEFAULT '{}',      -- ['Series A', 'Series B', 'Seed']
  keywords TEXT[] DEFAULT '{}',            -- Additional search keywords
  exclude_keywords TEXT[] DEFAULT '{}',    -- Keywords to exclude

  -- Company Targeting
  target_companies TEXT[] DEFAULT '{}',    -- Specific company names to target
  exclude_companies TEXT[] DEFAULT '{}',   -- Companies to exclude

  -- Metadata
  description TEXT,                        -- User's description of this ICP
  last_search_at TIMESTAMP WITH TIME ZONE,
  last_search_results INT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_workspace_icp_workspace ON workspace_icp(workspace_id);
CREATE INDEX idx_workspace_icp_default ON workspace_icp(workspace_id, is_default) WHERE is_default = true;

-- RLS Policies
ALTER TABLE workspace_icp ENABLE ROW LEVEL SECURITY;

-- Users can view ICPs in their workspaces
CREATE POLICY "Users can view workspace ICPs"
  ON workspace_icp FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can create ICPs in their workspaces
CREATE POLICY "Users can create workspace ICPs"
  ON workspace_icp FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can update ICPs in their workspaces
CREATE POLICY "Users can update workspace ICPs"
  ON workspace_icp FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can delete ICPs in their workspaces
CREATE POLICY "Users can delete workspace ICPs"
  ON workspace_icp FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Service role bypass
CREATE POLICY "Service role full access to workspace_icp"
  ON workspace_icp FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_workspace_icp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workspace_icp_updated_at
  BEFORE UPDATE ON workspace_icp
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_icp_updated_at();

-- Ensure only one default ICP per workspace
CREATE OR REPLACE FUNCTION ensure_single_default_icp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE workspace_icp
    SET is_default = false
    WHERE workspace_id = NEW.workspace_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_icp
  BEFORE INSERT OR UPDATE ON workspace_icp
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_icp();

-- Comments
COMMENT ON TABLE workspace_icp IS 'Stores Ideal Customer Profiles for LinkedIn/Email prospect searches';
COMMENT ON COLUMN workspace_icp.titles IS 'Job titles to target (e.g., VP Sales, Marketing Director)';
COMMENT ON COLUMN workspace_icp.seniority_levels IS 'Seniority levels (e.g., VP, Director, C-Level)';
COMMENT ON COLUMN workspace_icp.industries IS 'Industries to target (e.g., SaaS, FinTech)';
COMMENT ON COLUMN workspace_icp.funding_stages IS 'Funding stages for startups (e.g., Series A, Seed)';
