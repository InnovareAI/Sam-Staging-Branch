-- Create workspace_reply_agent_config table
CREATE TABLE IF NOT EXISTS workspace_reply_agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  approval_mode TEXT NOT NULL DEFAULT 'manual' CHECK (approval_mode IN ('auto', 'manual')),
  response_tone TEXT NOT NULL DEFAULT 'professional' CHECK (response_tone IN ('professional', 'friendly', 'casual', 'formal')),
  reply_delay_hours INTEGER NOT NULL DEFAULT 2 CHECK (reply_delay_hours >= 0 AND reply_delay_hours <= 72),
  ai_model TEXT NOT NULL DEFAULT 'claude-3.5-sonnet',
  reply_guidelines TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id)
);

-- Add RLS policies
ALTER TABLE workspace_reply_agent_config ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view config for their workspace
CREATE POLICY "Users can view reply agent config for their workspace"
  ON workspace_reply_agent_config
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert/update config for their workspace
CREATE POLICY "Users can manage reply agent config for their workspace"
  ON workspace_reply_agent_config
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reply_agent_config_workspace ON workspace_reply_agent_config(workspace_id);

-- Add comment
COMMENT ON TABLE workspace_reply_agent_config IS 'Configuration for automated AI reply agent per workspace';
