-- Add scheduled_send_at column to campaign_prospects
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS scheduled_send_at timestamp with time zone;

-- Add index for efficient querying of prospects ready to send
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_scheduled_send
ON campaign_prospects (scheduled_send_at, status)
WHERE scheduled_send_at IS NOT NULL AND status = 'queued';

-- Add 'queued' to status check constraint if not exists
ALTER TABLE campaign_prospects
DROP CONSTRAINT IF EXISTS campaign_prospects_status_check;

ALTER TABLE campaign_prospects
ADD CONSTRAINT campaign_prospects_status_check
CHECK (status = ANY (ARRAY[
  'pending'::text,
  'approved'::text,
  'ready_to_message'::text,
  'queued'::text,  -- NEW STATUS
  'queued_in_n8n'::text,
  'contacted'::text,
  'connection_requested'::text,
  'connection_request_sent'::text,
  'not_connected'::text,
  'invitation_withdrawn'::text,
  'connected'::text,
  'messaging'::text,
  'replied'::text,
  'not_interested'::text,
  'failed'::text,
  'error'::text
]));
