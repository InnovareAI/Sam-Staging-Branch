-- Email Queue Table for Cold Email Campaigns
-- Supports timezone-aware scheduling, business hours, and rate limiting
-- November 22, 2025

CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  account_id VARCHAR(255) NOT NULL,  -- Unipile email account ID

  -- Recipient Information
  prospect_id UUID REFERENCES campaign_prospects(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  recipient_location VARCHAR(255),  -- City, Country from LinkedIn profile
  recipient_timezone VARCHAR(50),   -- e.g., 'America/New_York', extracted from location

  -- Email Content
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_plain TEXT,
  tracking_label VARCHAR(255),

  -- Scheduling (all times in UTC for consistency)
  scheduled_for TIMESTAMP NOT NULL,  -- UTC time when email should send
  sent_at TIMESTAMP,

  -- Status Tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, sent, failed, skipped
  error_message TEXT,
  unipile_message_id VARCHAR(255),  -- Response ID from Unipile

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  UNIQUE(campaign_id, prospect_id, recipient_email)
);

-- Index for efficient queue processing
CREATE INDEX idx_email_queue_pending
  ON email_queue(scheduled_for)
  WHERE status = 'pending';

-- Index for campaign status
CREATE INDEX idx_email_queue_campaign
  ON email_queue(campaign_id, status);

-- Index for workspace isolation
CREATE INDEX idx_email_queue_workspace
  ON email_queue(workspace_id);

-- Row Level Security (RLS)
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify email queues for campaigns in their workspace
CREATE POLICY "email_queue_workspace_isolation" ON email_queue
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_queue_update_timestamp
BEFORE UPDATE ON email_queue
FOR EACH ROW
EXECUTE FUNCTION update_email_queue_updated_at();

-- Comment for clarity
COMMENT ON TABLE email_queue IS 'Queue for cold email campaigns with timezone-aware scheduling and business hours respect. Supports 40 emails/day spread across recipient''s business hours (9 AM - 6 PM in their local timezone).';

COMMENT ON COLUMN email_queue.recipient_timezone IS 'IANA timezone identifier (e.g., America/New_York). Extracted from recipient_location via reverse geocoding.';

COMMENT ON COLUMN email_queue.scheduled_for IS 'When the email should be sent, stored in UTC. Converted from recipient''s timezone to ensure correct local time.';

COMMENT ON COLUMN email_queue.status IS 'pending = waiting to send, sent = sent successfully, failed = error sending, skipped = weekend/holiday/outside business hours.';
