-- =====================================================
-- Follow-up Agent System
-- Tracks and automates follow-ups for silent prospects
-- Created: October 30, 2025
-- =====================================================

-- Table: prospect_follow_ups
-- Tracks follow-up sequences for prospects who go silent
CREATE TABLE IF NOT EXISTS prospect_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES workspace_prospects(id) ON DELETE CASCADE,
  reply_id UUID REFERENCES campaign_replies(id) ON DELETE SET NULL,

  -- Follow-up sequence tracking
  follow_up_sequence TEXT NOT NULL DEFAULT 'initial', -- 'initial', 'follow_up_1', 'follow_up_2', 'follow_up_3'
  follow_up_attempt INT NOT NULL DEFAULT 0,
  max_follow_ups INT NOT NULL DEFAULT 3,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'scheduled', 'sent', 'replied', 'exhausted', 'paused', 'cancelled'

  -- Timing
  last_contacted_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  days_since_last_contact INT,

  -- Follow-up message
  follow_up_message TEXT,
  follow_up_subject TEXT,
  channel TEXT NOT NULL DEFAULT 'email', -- 'email', 'linkedin', 'both'

  -- HITL review
  requires_review BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_status TEXT, -- 'approved', 'edited', 'refused'

  -- Execution tracking
  sent_at TIMESTAMPTZ,
  external_message_id TEXT,
  n8n_execution_id TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_follow_ups_workspace ON prospect_follow_ups(workspace_id);
CREATE INDEX idx_follow_ups_campaign ON prospect_follow_ups(campaign_id);
CREATE INDEX idx_follow_ups_prospect ON prospect_follow_ups(prospect_id);
CREATE INDEX idx_follow_ups_status ON prospect_follow_ups(status);
CREATE INDEX idx_follow_ups_next_follow_up ON prospect_follow_ups(next_follow_up_at) WHERE status = 'scheduled';
CREATE INDEX idx_follow_ups_requires_review ON prospect_follow_ups(requires_review) WHERE requires_review = true;

-- RLS Policies
ALTER TABLE prospect_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view follow-ups in their workspace"
  ON prospect_follow_ups FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert follow-ups in their workspace"
  ON prospect_follow_ups FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update follow-ups in their workspace"
  ON prospect_follow_ups FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Table: follow_up_templates
-- Customizable follow-up message templates per workspace
CREATE TABLE IF NOT EXISTS follow_up_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Template info
  name TEXT NOT NULL,
  description TEXT,
  follow_up_sequence TEXT NOT NULL, -- 'follow_up_1', 'follow_up_2', 'follow_up_3'

  -- Template content
  subject_template TEXT NOT NULL,
  message_template TEXT NOT NULL,

  -- Variables available: {prospect_name}, {company}, {previous_message}, {days_since_contact}

  -- Settings
  is_active BOOLEAN DEFAULT true,
  channel TEXT NOT NULL DEFAULT 'email',

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_follow_up_templates_workspace ON follow_up_templates(workspace_id);
CREATE INDEX idx_follow_up_templates_sequence ON follow_up_templates(follow_up_sequence);

-- RLS Policies
ALTER TABLE follow_up_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates in their workspace"
  ON follow_up_templates FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage templates"
  ON follow_up_templates FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Function: Calculate next follow-up date
CREATE OR REPLACE FUNCTION calculate_next_follow_up_date(
  attempt INT,
  last_contacted TIMESTAMPTZ
) RETURNS TIMESTAMPTZ AS $$
BEGIN
  CASE attempt
    WHEN 1 THEN RETURN last_contacted + INTERVAL '3 days';
    WHEN 2 THEN RETURN last_contacted + INTERVAL '7 days';
    WHEN 3 THEN RETURN last_contacted + INTERVAL '14 days';
    ELSE RETURN NULL; -- No more follow-ups
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Create follow-up sequence when reply is sent
CREATE OR REPLACE FUNCTION create_follow_up_sequence()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create follow-up if message was sent (not refused)
  IF NEW.status IN ('approved', 'edited') AND NEW.response_sent_at IS NOT NULL THEN
    INSERT INTO prospect_follow_ups (
      workspace_id,
      campaign_id,
      prospect_id,
      reply_id,
      follow_up_sequence,
      follow_up_attempt,
      status,
      last_contacted_at,
      next_follow_up_at,
      channel,
      metadata
    )
    VALUES (
      (SELECT workspace_id FROM campaigns WHERE id = NEW.campaign_id),
      NEW.campaign_id,
      NEW.prospect_id,
      NEW.id,
      'initial',
      0,
      'scheduled', -- Schedule first follow-up
      NEW.response_sent_at,
      calculate_next_follow_up_date(1, NEW.response_sent_at), -- 3 days later
      COALESCE((SELECT channel FROM campaigns WHERE id = NEW.campaign_id), 'email'),
      jsonb_build_object(
        'initial_reply_id', NEW.id,
        'initial_message', NEW.final_message
      )
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-create follow-up when reply is sent
CREATE TRIGGER trigger_create_follow_up_on_reply_sent
  AFTER UPDATE OF response_sent_at ON campaign_replies
  FOR EACH ROW
  WHEN (OLD.response_sent_at IS NULL AND NEW.response_sent_at IS NOT NULL)
  EXECUTE FUNCTION create_follow_up_sequence();

-- Function: Reset follow-up when prospect replies back
CREATE OR REPLACE FUNCTION reset_follow_up_on_prospect_reply()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark all pending follow-ups as cancelled (prospect replied!)
  UPDATE prospect_follow_ups
  SET
    status = 'replied',
    updated_at = NOW(),
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{cancelled_reason}',
      '"prospect_replied_back"'::jsonb
    )
  WHERE prospect_id = NEW.prospect_id
    AND campaign_id = NEW.campaign_id
    AND status IN ('scheduled', 'pending')
    AND NEW.reply_text IS NOT NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Cancel follow-ups when prospect replies
CREATE TRIGGER trigger_reset_follow_up_on_reply
  AFTER INSERT ON campaign_replies
  FOR EACH ROW
  WHEN (NEW.reply_text IS NOT NULL)
  EXECUTE FUNCTION reset_follow_up_on_prospect_reply();

-- Function: Update follow-up status when message is sent
CREATE OR REPLACE FUNCTION update_follow_up_on_send()
RETURNS TRIGGER AS $$
BEGIN
  -- Find and update the corresponding follow-up record
  UPDATE prospect_follow_ups
  SET
    status = 'sent',
    sent_at = NEW.sent_at,
    external_message_id = NEW.external_message_id,
    n8n_execution_id = NEW.n8n_execution_id,
    updated_at = NOW(),
    -- Schedule next follow-up if not exhausted
    next_follow_up_at = CASE
      WHEN follow_up_attempt < max_follow_ups
      THEN calculate_next_follow_up_date(follow_up_attempt + 1, NEW.sent_at)
      ELSE NULL
    END,
    -- Update status based on attempts remaining
    status = CASE
      WHEN follow_up_attempt >= max_follow_ups THEN 'exhausted'
      ELSE 'sent'
    END
  WHERE id = (NEW.metadata->>'follow_up_id')::UUID
    AND status = 'scheduled';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- View: Follow-ups ready for execution
CREATE OR REPLACE VIEW follow_ups_ready_to_send AS
SELECT
  fu.*,
  wp.name as prospect_name,
  wp.email as prospect_email,
  wp.linkedin_url as prospect_linkedin,
  wp.company as prospect_company,
  c.name as campaign_name,
  c.channel as campaign_channel
FROM prospect_follow_ups fu
JOIN workspace_prospects wp ON fu.prospect_id = wp.id
JOIN campaigns c ON fu.campaign_id = c.id
WHERE fu.status = 'scheduled'
  AND fu.next_follow_up_at <= NOW()
  AND fu.follow_up_attempt < fu.max_follow_ups
ORDER BY fu.next_follow_up_at ASC;

-- Default follow-up templates (inserted per workspace on creation)
-- These will be inserted via application code when workspace is created

COMMENT ON TABLE prospect_follow_ups IS 'Tracks automated follow-up sequences for prospects who go silent';
COMMENT ON TABLE follow_up_templates IS 'Customizable follow-up message templates per workspace';
COMMENT ON FUNCTION calculate_next_follow_up_date IS 'Calculates when to send next follow-up based on attempt number';
COMMENT ON VIEW follow_ups_ready_to_send IS 'Prospects ready for automated follow-up (used by N8N)';
