-- ============================================
-- Migration: Create Meetings Table
-- Meeting Agent - Full Lifecycle Management
-- Created: December 16, 2025
-- ============================================

-- Main meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES campaign_prospects(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Booking source
  booking_url TEXT,                           -- calendly.com/john/30min
  booking_platform TEXT,                      -- 'calendly', 'cal.com', 'hubspot', 'google', 'microsoft'
  booking_event_type TEXT,                    -- '30min', 'discovery-call', etc.

  -- Meeting details
  title TEXT,                                 -- "Discovery Call with John Smith"
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  timezone TEXT DEFAULT 'America/New_York',

  -- Location/Link
  meeting_link TEXT,                          -- Zoom/Google Meet/Teams link
  meeting_platform TEXT,                      -- 'zoom', 'google_meet', 'teams', 'phone'
  phone_number TEXT,                          -- If phone call

  -- Attendees
  our_attendee_email TEXT,                    -- Who from our side
  our_attendee_name TEXT,
  prospect_email TEXT,
  prospect_name TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'scheduled',  -- 'scheduled', 'confirmed', 'cancelled', 'no_show', 'completed', 'rescheduled'
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,                          -- 'prospect', 'us', 'system'
  cancellation_reason TEXT,
  no_show_detected_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rescheduled_to UUID,                        -- References new meeting if rescheduled

  -- Reminder tracking
  reminder_24h_sent_at TIMESTAMPTZ,
  reminder_1h_sent_at TIMESTAMPTZ,
  reminder_15m_sent_at TIMESTAMPTZ,

  -- Follow-up tracking
  no_show_follow_up_sent_at TIMESTAMPTZ,
  post_meeting_follow_up_sent_at TIMESTAMPTZ,
  reschedule_attempts INTEGER DEFAULT 0,
  max_reschedule_attempts INTEGER DEFAULT 3,

  -- Calendar sync
  our_calendar_event_id TEXT,                 -- Unipile event ID in our calendar
  their_calendar_event_id TEXT,               -- Event ID from Calendly/external
  calendar_synced_at TIMESTAMPTZ,

  -- Meeting outcome (filled after meeting)
  outcome TEXT,                               -- 'positive', 'neutral', 'negative', 'no_decision'
  next_steps TEXT,
  notes TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_meetings_workspace_id ON meetings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meetings_prospect_id ON meetings(prospect_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_at ON meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_status_scheduled ON meetings(status, scheduled_at)
  WHERE status IN ('scheduled', 'confirmed');

-- Meeting reminders queue (for precise timing)
CREATE TABLE IF NOT EXISTS meeting_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  reminder_type TEXT NOT NULL,                -- '24h', '1h', '15m'
  scheduled_for TIMESTAMPTZ NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending',     -- 'pending', 'sent', 'cancelled', 'failed'
  sent_at TIMESTAMPTZ,
  error_message TEXT,

  -- Channel preference
  channel TEXT DEFAULT 'email',               -- 'email', 'linkedin', 'both'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_reminders_status_scheduled
  ON meeting_reminders(status, scheduled_for) WHERE status = 'pending';

-- Meeting follow-up drafts (similar to follow_up_drafts for Reply Agent)
CREATE TABLE IF NOT EXISTS meeting_follow_up_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES campaign_prospects(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Follow-up type
  follow_up_type TEXT NOT NULL,               -- 'no_show', 'cancelled', 'post_meeting', 'reschedule'

  -- Generated message
  subject TEXT,
  message TEXT NOT NULL,
  channel TEXT DEFAULT 'email',               -- 'email', 'linkedin'

  -- HITL approval
  status TEXT NOT NULL DEFAULT 'pending_generation', -- 'pending_generation', 'pending_approval', 'approved', 'sent', 'rejected', 'archived'
  approval_token TEXT UNIQUE,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  rejected_reason TEXT,

  -- Sending
  sent_at TIMESTAMPTZ,
  send_error TEXT,

  -- AI metadata
  ai_model TEXT,
  ai_tokens_used INTEGER,
  generation_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_follow_up_drafts_status
  ON meeting_follow_up_drafts(status) WHERE status IN ('pending_generation', 'pending_approval', 'approved');

-- Booking link detection patterns
CREATE TABLE IF NOT EXISTS booking_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name TEXT NOT NULL UNIQUE,         -- 'calendly', 'cal.com', 'hubspot'
  url_pattern TEXT NOT NULL,                  -- Regex pattern to detect links
  scrape_enabled BOOLEAN DEFAULT TRUE,
  booking_enabled BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default booking platforms
INSERT INTO booking_platforms (platform_name, url_pattern, scrape_enabled, booking_enabled) VALUES
  ('calendly', 'calendly\.com\/[^\/\s]+\/[^\/\s]+', TRUE, TRUE),
  ('cal.com', 'cal\.com\/[^\/\s]+\/[^\/\s]+', TRUE, TRUE),
  ('hubspot', 'meetings\.hubspot\.com\/[^\/\s]+', TRUE, FALSE),
  ('google_calendar', 'calendar\.google\.com\/calendar\/appointments', FALSE, FALSE),
  ('microsoft_bookings', 'outlook\.office365\.com\/owa\/calendar', FALSE, FALSE)
ON CONFLICT (platform_name) DO NOTHING;

-- RLS Policies
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_follow_up_drafts ENABLE ROW LEVEL SECURITY;

-- Meetings: workspace members can view/edit
CREATE POLICY meetings_workspace_access ON meetings
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Meeting reminders: workspace members can view
CREATE POLICY meeting_reminders_workspace_access ON meeting_reminders
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Meeting follow-up drafts: workspace members can view/approve
CREATE POLICY meeting_follow_up_drafts_workspace_access ON meeting_follow_up_drafts
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Service role bypass for cron jobs
CREATE POLICY meetings_service_role ON meetings
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY meeting_reminders_service_role ON meeting_reminders
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY meeting_follow_up_drafts_service_role ON meeting_follow_up_drafts
  FOR ALL USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_meetings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_meetings_updated_at();

CREATE TRIGGER meeting_reminders_updated_at
  BEFORE UPDATE ON meeting_reminders
  FOR EACH ROW EXECUTE FUNCTION update_meetings_updated_at();

CREATE TRIGGER meeting_follow_up_drafts_updated_at
  BEFORE UPDATE ON meeting_follow_up_drafts
  FOR EACH ROW EXECUTE FUNCTION update_meetings_updated_at();

-- Add meeting_scheduled_at to campaign_prospects for easy access
ALTER TABLE campaign_prospects
  ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id),
  ADD COLUMN IF NOT EXISTS meeting_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meeting_status TEXT;

COMMENT ON TABLE meetings IS 'Meeting lifecycle management - booking, reminders, no-show handling, follow-ups';
COMMENT ON TABLE meeting_reminders IS 'Scheduled meeting reminders (24h, 1h, 15m before)';
COMMENT ON TABLE meeting_follow_up_drafts IS 'AI-generated meeting follow-ups pending HITL approval';
COMMENT ON TABLE booking_platforms IS 'Supported booking platforms with URL detection patterns';
