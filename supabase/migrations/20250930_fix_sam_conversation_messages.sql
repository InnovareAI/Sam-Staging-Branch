-- Fix sam_conversation_messages table - add missing columns
-- This migration adds columns that the API expects but are missing from the table

-- Add user_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'sam_conversation_messages' 
                 AND column_name = 'user_id') THEN
    ALTER TABLE sam_conversation_messages 
    ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_sam_messages_user_id 
    ON sam_conversation_messages(user_id);
  END IF;
END $$;

-- Add message_order column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'sam_conversation_messages' 
                 AND column_name = 'message_order') THEN
    ALTER TABLE sam_conversation_messages 
    ADD COLUMN message_order INTEGER NOT NULL DEFAULT 0;
    
    CREATE INDEX IF NOT EXISTS idx_sam_messages_order 
    ON sam_conversation_messages(thread_id, message_order);
  END IF;
END $$;

-- Add has_prospect_intelligence column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'sam_conversation_messages' 
                 AND column_name = 'has_prospect_intelligence') THEN
    ALTER TABLE sam_conversation_messages 
    ADD COLUMN has_prospect_intelligence BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add prospect_intelligence_data column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'sam_conversation_messages' 
                 AND column_name = 'prospect_intelligence_data') THEN
    ALTER TABLE sam_conversation_messages 
    ADD COLUMN prospect_intelligence_data JSONB;
  END IF;
END $$;

-- Add message_metadata column if it doesn't exist (distinct from metadata)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'sam_conversation_messages' 
                 AND column_name = 'message_metadata') THEN
    ALTER TABLE sam_conversation_messages 
    ADD COLUMN message_metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Update the RLS policy to also check user_id directly
DROP POLICY IF EXISTS "Users can only access their own messages" ON sam_conversation_messages;

CREATE POLICY "Users can only access their own messages"
  ON sam_conversation_messages FOR ALL
  USING (
    auth.uid() = user_id OR
    thread_id IN (
      SELECT id FROM sam_conversation_threads 
      WHERE user_id = auth.uid()
    )
  );

-- Ensure proper constraints
ALTER TABLE sam_conversation_messages 
  ALTER COLUMN message_order SET NOT NULL;

COMMENT ON TABLE sam_conversation_messages IS 'Stores messages within SAM conversation threads';
COMMENT ON COLUMN sam_conversation_messages.user_id IS 'User who created the message';
COMMENT ON COLUMN sam_conversation_messages.message_order IS 'Order of message within thread';
COMMENT ON COLUMN sam_conversation_messages.has_prospect_intelligence IS 'Whether message contains prospect research data';
COMMENT ON COLUMN sam_conversation_messages.prospect_intelligence_data IS 'Prospect intelligence JSON data';
COMMENT ON COLUMN sam_conversation_messages.message_metadata IS 'Additional message metadata';