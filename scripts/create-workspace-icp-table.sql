-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new

-- Workspace ICP (Ideal Customer Profile) table
CREATE TABLE IF NOT EXISTS workspace_icp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default ICP',
  is_default BOOLEAN DEFAULT false,
  titles TEXT[] DEFAULT '{}',
  seniority_levels TEXT[] DEFAULT '{}',
  industries TEXT[] DEFAULT '{}',
  company_size_min INT,
  company_size_max INT,
  locations TEXT[] DEFAULT '{}',
  countries TEXT[] DEFAULT '{}',
  funding_stages TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  exclude_keywords TEXT[] DEFAULT '{}',
  target_companies TEXT[] DEFAULT '{}',
  exclude_companies TEXT[] DEFAULT '{}',
  description TEXT,
  last_search_at TIMESTAMP WITH TIME ZONE,
  last_search_results INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspace_icp_workspace ON workspace_icp(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_icp_default ON workspace_icp(workspace_id, is_default) WHERE is_default = true;

-- RLS
ALTER TABLE workspace_icp ENABLE ROW LEVEL SECURITY;

-- Policies (drop first if exist)
DROP POLICY IF EXISTS "Users can view workspace ICPs" ON workspace_icp;
DROP POLICY IF EXISTS "Users can create workspace ICPs" ON workspace_icp;
DROP POLICY IF EXISTS "Users can update workspace ICPs" ON workspace_icp;
DROP POLICY IF EXISTS "Users can delete workspace ICPs" ON workspace_icp;
DROP POLICY IF EXISTS "Service role full access to workspace_icp" ON workspace_icp;

CREATE POLICY "Users can view workspace ICPs"
  ON workspace_icp FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can create workspace ICPs"
  ON workspace_icp FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update workspace ICPs"
  ON workspace_icp FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete workspace ICPs"
  ON workspace_icp FOR DELETE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access to workspace_icp"
  ON workspace_icp FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_workspace_icp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_workspace_icp_updated_at ON workspace_icp;
CREATE TRIGGER trigger_update_workspace_icp_updated_at
  BEFORE UPDATE ON workspace_icp
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_icp_updated_at();

-- Trigger for single default ICP
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

DROP TRIGGER IF EXISTS trigger_ensure_single_default_icp ON workspace_icp;
CREATE TRIGGER trigger_ensure_single_default_icp
  BEFORE INSERT OR UPDATE ON workspace_icp
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_icp();

SELECT 'workspace_icp table created successfully!' as result;
