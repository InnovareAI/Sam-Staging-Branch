-- Reply Agent System - Full Implementation
-- November 27, 2025

-- ============================================================================
-- 1. REPLY AGENT SETTINGS (workspace-level configuration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS reply_agent_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Section 1: SAM Product Knowledge
  sam_description TEXT,
  sam_differentiators TEXT,
  ideal_customer TEXT,
  objection_handling JSONB DEFAULT '[]'::jsonb,  -- Array of {objection, response}
  proof_points TEXT,
  pricing_guidance TEXT,

  -- Section 2: Brand Voice
  voice_reference TEXT,
  tone_of_voice TEXT,
  writing_style TEXT,
  dos_and_donts TEXT,

  -- Section 5: Reply Settings
  default_cta VARCHAR(50) DEFAULT 'book_call',  -- book_call, send_calendar, share_case_study, ask_question
  calendar_link TEXT,
  pushiness_level VARCHAR(20) DEFAULT 'balanced',  -- soft, balanced, direct
  handle_not_interested VARCHAR(30) DEFAULT 'graceful_exit',  -- graceful_exit, soft_reengage, exit_immediately
  handle_pricing VARCHAR(30) DEFAULT 'deflect_to_call',  -- deflect_to_call, give_range, be_transparent

  -- Section 6: Advanced
  system_prompt_override TEXT,

  -- General settings
  enabled BOOLEAN DEFAULT false,
  approval_mode VARCHAR(20) DEFAULT 'manual',  -- manual, auto
  ai_model VARCHAR(50) DEFAULT 'anthropic/claude-sonnet-4',
  reply_delay_minutes INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(workspace_id)
);

-- Index for fast workspace lookup
CREATE INDEX IF NOT EXISTS idx_reply_agent_settings_workspace ON reply_agent_settings(workspace_id);

-- RLS policies
ALTER TABLE reply_agent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reply agent settings for their workspaces"
  ON reply_agent_settings FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage reply agent settings"
  ON reply_agent_settings FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- 2. UPDATE CAMPAIGN_REPLIES TABLE (add intent classification + feedback)
-- ============================================================================

-- Add intent classification columns
ALTER TABLE campaign_replies
ADD COLUMN IF NOT EXISTS intent VARCHAR(30),
ADD COLUMN IF NOT EXISTS intent_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS intent_reasoning TEXT;

-- Add feedback columns
ALTER TABLE campaign_replies
ADD COLUMN IF NOT EXISTS feedback VARCHAR(20),  -- thumbs_up, thumbs_down
ADD COLUMN IF NOT EXISTS feedback_reason TEXT,
ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS feedback_by UUID REFERENCES auth.users(id);

-- Add draft tracking columns
ALTER TABLE campaign_replies
ADD COLUMN IF NOT EXISTS original_draft TEXT,
ADD COLUMN IF NOT EXISTS draft_edited BOOLEAN DEFAULT false;

-- Add channel tracking
ALTER TABLE campaign_replies
ADD COLUMN IF NOT EXISTS reply_channel VARCHAR(20) DEFAULT 'email';  -- email, linkedin

-- Create enum type for intent (for better validation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reply_intent') THEN
    CREATE TYPE reply_intent AS ENUM (
      'interested',
      'curious',
      'objection',
      'timing',
      'wrong_person',
      'not_interested',
      'question',
      'vague_positive'
    );
  END IF;
END $$;

-- Index for finding replies by intent
CREATE INDEX IF NOT EXISTS idx_campaign_replies_intent ON campaign_replies(intent);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_feedback ON campaign_replies(feedback);

-- ============================================================================
-- 3. REPLY FEEDBACK REASONS (for thumbs down tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS reply_feedback_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id UUID NOT NULL REFERENCES campaign_replies(id) ON DELETE CASCADE,
  reason VARCHAR(50) NOT NULL,  -- too_salesy, didnt_answer, wrong_tone, too_long, missed_intent, too_pushy, too_passive, other
  custom_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_reply_feedback_reasons_reply ON reply_feedback_reasons(reply_id);

-- RLS policies
ALTER TABLE reply_feedback_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view feedback for their workspace replies"
  ON reply_feedback_reasons FOR SELECT
  USING (
    reply_id IN (
      SELECT cr.id FROM campaign_replies cr
      JOIN campaigns c ON cr.campaign_id = c.id
      WHERE c.workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can add feedback to their workspace replies"
  ON reply_feedback_reasons FOR INSERT
  WITH CHECK (
    reply_id IN (
      SELECT cr.id FROM campaign_replies cr
      JOIN campaigns c ON cr.campaign_id = c.id
      WHERE c.workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 4. REPLY AGENT METRICS (for tracking performance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS reply_agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Volume metrics
  replies_received INTEGER DEFAULT 0,
  drafts_generated INTEGER DEFAULT 0,
  drafts_approved INTEGER DEFAULT 0,
  drafts_edited INTEGER DEFAULT 0,
  drafts_refused INTEGER DEFAULT 0,

  -- Intent breakdown
  intent_interested INTEGER DEFAULT 0,
  intent_curious INTEGER DEFAULT 0,
  intent_objection INTEGER DEFAULT 0,
  intent_timing INTEGER DEFAULT 0,
  intent_wrong_person INTEGER DEFAULT 0,
  intent_not_interested INTEGER DEFAULT 0,
  intent_question INTEGER DEFAULT 0,
  intent_vague_positive INTEGER DEFAULT 0,

  -- Quality metrics
  avg_intent_confidence DECIMAL(3,2),
  thumbs_up_count INTEGER DEFAULT 0,
  thumbs_down_count INTEGER DEFAULT 0,
  edit_rate DECIMAL(3,2),  -- percentage of drafts that were edited

  -- Channel breakdown
  linkedin_replies INTEGER DEFAULT 0,
  email_replies INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(workspace_id, date)
);

CREATE INDEX IF NOT EXISTS idx_reply_agent_metrics_workspace_date
ON reply_agent_metrics(workspace_id, date DESC);

-- RLS policies
ALTER TABLE reply_agent_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view metrics for their workspaces"
  ON reply_agent_metrics FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. FUNCTION: Update reply agent metrics
-- ============================================================================

CREATE OR REPLACE FUNCTION update_reply_agent_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update daily metrics when a reply is processed
  INSERT INTO reply_agent_metrics (
    workspace_id,
    date,
    replies_received,
    drafts_generated,
    intent_interested,
    intent_curious,
    intent_objection,
    intent_timing,
    intent_wrong_person,
    intent_not_interested,
    intent_question,
    intent_vague_positive
  )
  SELECT
    c.workspace_id,
    CURRENT_DATE,
    1,
    CASE WHEN NEW.ai_suggested_response IS NOT NULL THEN 1 ELSE 0 END,
    CASE WHEN NEW.intent = 'interested' THEN 1 ELSE 0 END,
    CASE WHEN NEW.intent = 'curious' THEN 1 ELSE 0 END,
    CASE WHEN NEW.intent = 'objection' THEN 1 ELSE 0 END,
    CASE WHEN NEW.intent = 'timing' THEN 1 ELSE 0 END,
    CASE WHEN NEW.intent = 'wrong_person' THEN 1 ELSE 0 END,
    CASE WHEN NEW.intent = 'not_interested' THEN 1 ELSE 0 END,
    CASE WHEN NEW.intent = 'question' THEN 1 ELSE 0 END,
    CASE WHEN NEW.intent = 'vague_positive' THEN 1 ELSE 0 END
  FROM campaigns c
  WHERE c.id = NEW.campaign_id
  ON CONFLICT (workspace_id, date) DO UPDATE SET
    replies_received = reply_agent_metrics.replies_received + 1,
    drafts_generated = reply_agent_metrics.drafts_generated +
      CASE WHEN NEW.ai_suggested_response IS NOT NULL THEN 1 ELSE 0 END,
    intent_interested = reply_agent_metrics.intent_interested +
      CASE WHEN NEW.intent = 'interested' THEN 1 ELSE 0 END,
    intent_curious = reply_agent_metrics.intent_curious +
      CASE WHEN NEW.intent = 'curious' THEN 1 ELSE 0 END,
    intent_objection = reply_agent_metrics.intent_objection +
      CASE WHEN NEW.intent = 'objection' THEN 1 ELSE 0 END,
    intent_timing = reply_agent_metrics.intent_timing +
      CASE WHEN NEW.intent = 'timing' THEN 1 ELSE 0 END,
    intent_wrong_person = reply_agent_metrics.intent_wrong_person +
      CASE WHEN NEW.intent = 'wrong_person' THEN 1 ELSE 0 END,
    intent_not_interested = reply_agent_metrics.intent_not_interested +
      CASE WHEN NEW.intent = 'not_interested' THEN 1 ELSE 0 END,
    intent_question = reply_agent_metrics.intent_question +
      CASE WHEN NEW.intent = 'question' THEN 1 ELSE 0 END,
    intent_vague_positive = reply_agent_metrics.intent_vague_positive +
      CASE WHEN NEW.intent = 'vague_positive' THEN 1 ELSE 0 END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update metrics on new replies
DROP TRIGGER IF EXISTS trigger_update_reply_metrics ON campaign_replies;
CREATE TRIGGER trigger_update_reply_metrics
  AFTER INSERT ON campaign_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_reply_agent_metrics();

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON reply_agent_settings TO authenticated;
GRANT ALL ON reply_feedback_reasons TO authenticated;
GRANT ALL ON reply_agent_metrics TO authenticated;
