-- Multi-Channel Campaign Execution State Table
-- Tracks execution state for each prospect in a campaign
-- Supports LinkedIn, Email, WhatsApp, and future channels

CREATE TABLE IF NOT EXISTS campaign_prospect_execution_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES campaign_prospects(id) ON DELETE CASCADE,

  -- Execution state
  current_step INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending', -- pending, executing, waiting_trigger, completed, failed, paused

  -- Step tracking
  completed_steps INTEGER[] DEFAULT '{}',
  failed_steps INTEGER[] DEFAULT '{}',
  skipped_steps INTEGER[] DEFAULT '{}',

  -- Channel-specific state
  linkedin_state JSONB DEFAULT '{}'::jsonb,
  -- Example: { "connection_status": "pending|accepted|rejected", "last_message_at": "2025-11-15T10:00:00Z", "message_count": 2 }

  email_state JSONB DEFAULT '{}'::jsonb,
  -- Example: { "sent_count": 3, "opened": true, "replied": false, "last_sent_at": "2025-11-15T10:00:00Z", "bounce_status": null }

  whatsapp_state JSONB DEFAULT '{}'::jsonb,
  -- Example: { "sent_count": 1, "delivered": true, "read": false, "replied": false, "last_sent_at": "2025-11-15T10:00:00Z" }

  -- Triggers and waits (for LinkedIn connection acceptance, etc.)
  waiting_for_trigger TEXT,
  -- Values: 'connection_accepted', null

  trigger_check_count INTEGER DEFAULT 0,
  trigger_max_checks INTEGER DEFAULT 168, -- 7 days * 24 hours (check every hour)
  next_check_at TIMESTAMP,

  -- Orchestration metadata
  n8n_execution_id TEXT,
  last_executed_at TIMESTAMP DEFAULT NOW(),
  next_execution_at TIMESTAMP,

  -- Error tracking
  last_error TEXT,
  error_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(campaign_id, prospect_id)
);

-- Indexes for performance
CREATE INDEX idx_execution_state_next_execution
  ON campaign_prospect_execution_state(next_execution_at)
  WHERE status IN ('pending', 'waiting_trigger');

CREATE INDEX idx_execution_state_campaign
  ON campaign_prospect_execution_state(campaign_id);

CREATE INDEX idx_execution_state_status
  ON campaign_prospect_execution_state(status);

CREATE INDEX idx_execution_state_trigger_check
  ON campaign_prospect_execution_state(next_check_at)
  WHERE waiting_for_trigger IS NOT NULL;

-- Comments
COMMENT ON TABLE campaign_prospect_execution_state IS
'Tracks multi-channel campaign execution state for each prospect. Supports LinkedIn, Email, WhatsApp orchestration.';

COMMENT ON COLUMN campaign_prospect_execution_state.current_step IS
'Current step number in the campaign flow_settings.steps array';

COMMENT ON COLUMN campaign_prospect_execution_state.status IS
'Execution status: pending (not started), executing (currently running), waiting_trigger (waiting for LinkedIn acceptance), completed (all steps done), failed (permanent error), paused (user paused or HITL approval needed)';

COMMENT ON COLUMN campaign_prospect_execution_state.waiting_for_trigger IS
'Trigger type being waited for: connection_accepted (LinkedIn), null (no waiting)';

COMMENT ON COLUMN campaign_prospect_execution_state.next_execution_at IS
'Scheduled time for next step execution. N8N polls this to find ready prospects.';

-- RLS Policies
ALTER TABLE campaign_prospect_execution_state ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view execution state for campaigns in their workspace
CREATE POLICY "Users can view execution state in their workspace"
  ON campaign_prospect_execution_state
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      INNER JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = campaign_prospect_execution_state.campaign_id
        AND wm.user_id = auth.uid()
    )
  );

-- Policy: Service role can manage all execution state (for N8N)
CREATE POLICY "Service role can manage all execution state"
  ON campaign_prospect_execution_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_execution_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_execution_state_timestamp
  BEFORE UPDATE ON campaign_prospect_execution_state
  FOR EACH ROW
  EXECUTE FUNCTION update_execution_state_updated_at();

-- Helper function: Initialize execution state for new campaign prospects
CREATE OR REPLACE FUNCTION initialize_execution_state(
  p_campaign_id UUID,
  p_prospect_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_state_id UUID;
BEGIN
  INSERT INTO campaign_prospect_execution_state (
    campaign_id,
    prospect_id,
    current_step,
    status,
    next_execution_at
  ) VALUES (
    p_campaign_id,
    p_prospect_id,
    1,
    'pending',
    NOW() -- Execute immediately for step 1
  )
  ON CONFLICT (campaign_id, prospect_id)
  DO UPDATE SET
    updated_at = NOW()
  RETURNING id INTO v_state_id;

  RETURN v_state_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION initialize_execution_state IS
'Initialize execution state for a new campaign prospect. Called when prospects are uploaded to a campaign.';

-- Helper function: Get next pending prospects for execution
CREATE OR REPLACE FUNCTION get_next_pending_executions(
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  state_id UUID,
  campaign_id UUID,
  prospect_id UUID,
  current_step INTEGER,
  status TEXT,
  next_execution_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    cpes.campaign_id,
    cpes.prospect_id,
    cpes.current_step,
    cpes.status,
    cpes.next_execution_at
  FROM campaign_prospect_execution_state cpes
  WHERE
    cpes.status IN ('pending', 'waiting_trigger')
    AND cpes.next_execution_at <= NOW()
  ORDER BY cpes.next_execution_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_pending_executions IS
'Get next prospects ready for execution. Used by N8N scheduler to find work.';
