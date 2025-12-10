-- Create workspace_integrations table for storing third-party integrations (Slack, etc.)
-- December 10, 2025

CREATE TABLE IF NOT EXISTS workspace_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  integration_type VARCHAR(50) NOT NULL, -- 'slack', 'hubspot', 'salesforce', etc.
  status VARCHAR(20) NOT NULL DEFAULT 'inactive', -- 'active', 'inactive', 'error'
  config JSONB DEFAULT '{}', -- Integration-specific config (webhook_url, api_key, etc.)
  connected_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint: one integration type per workspace
  UNIQUE(workspace_id, integration_type)
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_workspace_integrations_workspace ON workspace_integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_integrations_type ON workspace_integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_workspace_integrations_status ON workspace_integrations(status);

-- Enable RLS
ALTER TABLE workspace_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their workspace integrations"
  ON workspace_integrations FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their workspace integrations"
  ON workspace_integrations FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON workspace_integrations TO authenticated;
GRANT ALL ON workspace_integrations TO service_role;
