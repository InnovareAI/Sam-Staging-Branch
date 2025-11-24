-- Migration: Create email_send_queue table for queue-based email campaign execution
-- Date: November 24, 2025
-- Purpose: Store emails for gradual sending (40/day, 8 AM - 5 PM, ~13.5 min intervals)
--
-- COMPLIANCE RULES:
-- - Max 40 emails per day
-- - No weekends (Saturday/Sunday)
-- - No US public holidays
-- - Business hours: 8 AM - 5 PM (9-hour window)
-- - Interval: 9 hours / 40 emails = 13.5 minutes per email

CREATE TABLE IF NOT EXISTS email_send_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES campaign_prospects(id) ON DELETE CASCADE,

  -- Email data
  email_account_id TEXT NOT NULL,  -- Unipile account ID
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  from_name TEXT,

  -- Timing
  scheduled_for TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- pending: waiting to send
    -- sent: successfully sent
    -- failed: error occurred

  error_message TEXT,

  -- Unipile response
  message_id TEXT,  -- Unipile message ID after successful send

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes for performance
  UNIQUE(campaign_id, prospect_id)
);

-- Index for cron job queries (find next message to send)
CREATE INDEX IF NOT EXISTS idx_email_send_queue_pending
  ON email_send_queue(scheduled_for)
  WHERE status = 'pending';

-- Index for campaign queries
CREATE INDEX IF NOT EXISTS idx_email_send_queue_campaign
  ON email_send_queue(campaign_id);

-- Enable RLS for multi-tenant safety
ALTER TABLE email_send_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access email_send_queue for campaigns in their workspace
CREATE POLICY "Users can view email_send_queue for their campaigns"
  ON email_send_queue
  FOR SELECT
  USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policy: Allow INSERT for service role (bypasses RLS anyway)
CREATE POLICY "Allow INSERT for service role on email_send_queue"
  ON email_send_queue
  FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Allow UPDATE for service role
CREATE POLICY "Allow UPDATE for service role on email_send_queue"
  ON email_send_queue
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
