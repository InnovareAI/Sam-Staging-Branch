-- Add the message_sequence column to the campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS message_sequence JSONB;

-- Add a comment for clarity
COMMENT ON COLUMN campaigns.message_sequence IS 'Stores the array of message objects for the campaign, including connection request and follow-ups with timestamps.';
