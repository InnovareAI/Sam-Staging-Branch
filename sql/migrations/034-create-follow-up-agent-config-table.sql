-- Migration: Create workspace_follow_up_agent_config table
-- Created: 2025-12-11
-- Purpose: Store Follow-Up Agent configuration per workspace

CREATE TABLE IF NOT EXISTS public.workspace_follow_up_agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,

  -- Agent settings
  enabled BOOLEAN NOT NULL DEFAULT true,
  approval_mode VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (approval_mode IN ('auto', 'manual')),
  max_touches INTEGER NOT NULL DEFAULT 4 CHECK (max_touches >= 1 AND max_touches <= 10),
  default_channel VARCHAR(20) NOT NULL DEFAULT 'linkedin' CHECK (default_channel IN ('linkedin', 'email', 'auto')),
  business_hours_only BOOLEAN NOT NULL DEFAULT true,

  -- AI settings
  ai_model VARCHAR(100) NOT NULL DEFAULT 'claude-sonnet-4-5-20250929',
  follow_up_guidelines TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX idx_follow_up_agent_config_workspace
  ON public.workspace_follow_up_agent_config(workspace_id);

-- RLS
ALTER TABLE public.workspace_follow_up_agent_config ENABLE ROW LEVEL SECURITY;

-- Users can view config in their workspace
CREATE POLICY "Users can view follow-up agent config in their workspace"
  ON public.workspace_follow_up_agent_config FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can upsert config in their workspace
CREATE POLICY "Users can upsert follow-up agent config in their workspace"
  ON public.workspace_follow_up_agent_config FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update follow-up agent config in their workspace"
  ON public.workspace_follow_up_agent_config FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Service role full access
CREATE POLICY "Service role full access to follow-up agent config"
  ON public.workspace_follow_up_agent_config FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Update trigger
CREATE TRIGGER trigger_update_follow_up_agent_config_updated_at
  BEFORE UPDATE ON public.workspace_follow_up_agent_config
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_up_drafts_updated_at();

COMMENT ON TABLE public.workspace_follow_up_agent_config IS 'Follow-Up Agent configuration per workspace';
