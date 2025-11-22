-- Migration: Create send_queue table for queue-based campaign execution
-- Date: November 22, 2025
-- Purpose: Store connection requests and follow-up messages for gradual sending (1 per 30 min)

CREATE TABLE IF NOT EXISTS send_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES campaign_prospects(id) ON DELETE CASCADE,

  -- LinkedIn data
  linkedin_user_id TEXT NOT NULL,

  -- Message
  message TEXT NOT NULL,

  -- Timing
  scheduled_for TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- pending: waiting to send
    -- sent: successfully sent
    -- failed: error occurred

  error_message TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes for performance
  UNIQUE(campaign_id, prospect_id)
);

-- Index for cron job queries (find next message to send)
CREATE INDEX IF NOT EXISTS idx_send_queue_pending
  ON send_queue(scheduled_for)
  WHERE status = 'pending';

-- Enable RLS for multi-tenant safety
ALTER TABLE send_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access send_queue for campaigns in their workspace
CREATE POLICY "Users can view send_queue for their campaigns"
  ON send_queue
  FOR SELECT
  USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policy: Service role and cron jobs can access all send_queue records
-- (relies on SUPABASE_SERVICE_ROLE_KEY which bypasses RLS)
