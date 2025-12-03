-- Create workspace_reply_agent_config table for Reply Agent settings
CREATE TABLE IF NOT EXISTS workspace_reply_agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT false,
  approval_mode VARCHAR(20) DEFAULT 'manual' CHECK (approval_mode IN ('auto', 'manual')),
  response_tone VARCHAR(50) DEFAULT 'professional',
  reply_delay_hours INTEGER DEFAULT 2,
  ai_model VARCHAR(100) DEFAULT 'claude-opus-4-5-20251101',
  reply_guidelines TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE workspace_reply_agent_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view reply agent config for their workspaces"
  ON workspace_reply_agent_config FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert reply agent config for their workspaces"
  ON workspace_reply_agent_config FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update reply agent config for their workspaces"
  ON workspace_reply_agent_config FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
