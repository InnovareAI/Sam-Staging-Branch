-- Add missing columns to sam_conversation_messages table
ALTER TABLE sam_conversation_messages
ADD COLUMN IF NOT EXISTS message_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index on message_order for faster queries
CREATE INDEX IF NOT EXISTS idx_sam_messages_order ON sam_conversation_messages(thread_id, message_order);
