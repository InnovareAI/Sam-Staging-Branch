-- Add model_used column to sam_conversation_messages table
ALTER TABLE public.sam_conversation_messages
ADD COLUMN IF NOT EXISTS model_used TEXT DEFAULT 'anthropic/claude-3.7-sonnet';

-- Add comment
COMMENT ON COLUMN public.sam_conversation_messages.model_used IS 'The AI model used to generate this message (for assistant messages)';