-- Add 'not_connected' and 'invitation_withdrawn' statuses to campaign_prospects
-- not_connected: CR not accepted after 21 days
-- invitation_withdrawn: LinkedIn CR officially withdrawn via Unipile API

-- Drop the old constraint
ALTER TABLE campaign_prospects DROP CONSTRAINT IF EXISTS campaign_prospects_status_check;

-- Add updated constraint with additional statuses
ALTER TABLE campaign_prospects ADD CONSTRAINT campaign_prospects_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'approved'::text,
    'ready_to_message'::text,
    'queued_in_n8n'::text,
    'contacted'::text,
    'connection_requested'::text,
    'not_connected'::text,        -- NEW: CR not accepted after 21 days
    'invitation_withdrawn'::text, -- NEW: CR withdrawn via Unipile API
    'connected'::text,
    'messaging'::text,
    'replied'::text,
    'not_interested'::text,
    'failed'::text,
    'error'::text
  ]));

-- Add comment
COMMENT ON CONSTRAINT campaign_prospects_status_check ON campaign_prospects IS
  'Valid prospect statuses including not_connected and invitation_withdrawn for LinkedIn CR timeout/withdrawal';
