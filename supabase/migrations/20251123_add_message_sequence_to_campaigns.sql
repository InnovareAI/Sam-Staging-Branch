
-- Add the message_sequence column to the campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS message_sequence JSONB;

-- Add a comment for clarity
COMMENT ON COLUMN campaigns.message_sequence IS 'Stores the array of message objects for the campaign, including connection request and follow-ups.';

DO $$
BEGIN
   -- Retroactively update any campaigns that might have used the old `messages` column if it exists
   IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'messages') THEN
      UPDATE campaigns SET message_sequence = messages WHERE message_sequence IS NULL;
   END IF;
END $$;

