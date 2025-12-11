-- Migration: Create follow_up_drafts table for HITL follow-up approval
-- Created: 2025-12-11
-- Purpose: Store AI-generated follow-up messages pending human approval

-- ============================================
-- FOLLOW-UP DRAFTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.follow_up_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  prospect_id UUID NOT NULL REFERENCES public.campaign_prospects(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Message content
  message TEXT NOT NULL,
  subject TEXT, -- For email channel only

  -- Follow-up metadata
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('linkedin', 'email', 'inmail')),
  tone VARCHAR(30) NOT NULL CHECK (tone IN ('light_bump', 'value_add', 'different_angle', 'breakup')),
  touch_number INTEGER NOT NULL CHECK (touch_number >= 1 AND touch_number <= 6),
  scenario VARCHAR(50) NOT NULL CHECK (scenario IN (
    'no_reply_to_cr',
    'replied_then_silent',
    'no_show_to_call',
    'post_demo_silence',
    'check_back_later',
    'trial_no_activity',
    'standard'
  )),

  -- AI generation metadata
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  reasoning TEXT,

  -- Status tracking
  status VARCHAR(30) NOT NULL DEFAULT 'pending_approval' CHECK (status IN (
    'pending_generation',
    'pending_approval',
    'approved',
    'rejected',
    'sent',
    'failed',
    'archived'
  )),

  -- Scheduling
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- Approval tracking
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Fast lookup for pending approvals by workspace
CREATE INDEX idx_follow_up_drafts_workspace_pending
  ON public.follow_up_drafts(workspace_id, status)
  WHERE status = 'pending_approval';

-- Fast lookup for approved drafts ready to send
CREATE INDEX idx_follow_up_drafts_approved_scheduled
  ON public.follow_up_drafts(scheduled_for)
  WHERE status = 'approved';

-- Fast lookup by prospect
CREATE INDEX idx_follow_up_drafts_prospect
  ON public.follow_up_drafts(prospect_id);

-- Fast lookup by campaign
CREATE INDEX idx_follow_up_drafts_campaign
  ON public.follow_up_drafts(campaign_id);

-- Status and created_at for queue processing
CREATE INDEX idx_follow_up_drafts_status_created
  ON public.follow_up_drafts(status, created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.follow_up_drafts ENABLE ROW LEVEL SECURITY;

-- Users can view drafts in their workspace
CREATE POLICY "Users can view follow-up drafts in their workspace"
  ON public.follow_up_drafts FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can create drafts in their workspace
CREATE POLICY "Users can create follow-up drafts in their workspace"
  ON public.follow_up_drafts FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can update drafts in their workspace
CREATE POLICY "Users can update follow-up drafts in their workspace"
  ON public.follow_up_drafts FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can delete drafts in their workspace
CREATE POLICY "Users can delete follow-up drafts in their workspace"
  ON public.follow_up_drafts FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything (for cron jobs)
CREATE POLICY "Service role full access to follow-up drafts"
  ON public.follow_up_drafts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- UPDATE TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_follow_up_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_follow_up_drafts_updated_at
  BEFORE UPDATE ON public.follow_up_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_up_drafts_updated_at();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.follow_up_drafts IS 'Stores AI-generated follow-up messages pending human approval (HITL)';
COMMENT ON COLUMN public.follow_up_drafts.scenario IS 'The follow-up scenario: no_reply_to_cr, replied_then_silent, no_show_to_call, post_demo_silence, check_back_later, trial_no_activity, or standard';
COMMENT ON COLUMN public.follow_up_drafts.tone IS 'The message tone: light_bump (touch 1), value_add (touch 2), different_angle (touch 3), or breakup (touch 4)';
COMMENT ON COLUMN public.follow_up_drafts.confidence_score IS 'AI confidence in the generated message (0.0 to 1.0)';
