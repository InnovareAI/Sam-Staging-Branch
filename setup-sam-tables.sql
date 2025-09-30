-- Create SAM Conversation Threads Table
CREATE TABLE IF NOT EXISTS sam_conversation_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID,
  workspace_id UUID,
  title TEXT NOT NULL,
  thread_type TEXT NOT NULL,
  prospect_name TEXT,
  prospect_company TEXT,
  prospect_linkedin_url TEXT,
  campaign_name TEXT,
  tags TEXT[],
  priority TEXT DEFAULT 'medium',
  sales_methodology TEXT DEFAULT 'meddic',
  status TEXT DEFAULT 'active',
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create SAM Conversation Messages Table
CREATE TABLE IF NOT EXISTS sam_conversation_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID REFERENCES sam_conversation_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_sam_threads_user_id ON sam_conversation_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_sam_threads_workspace_id ON sam_conversation_threads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sam_threads_last_active ON sam_conversation_threads(last_active_at);
CREATE INDEX IF NOT EXISTS idx_sam_messages_thread_id ON sam_conversation_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_sam_messages_created_at ON sam_conversation_messages(created_at);

-- Enable Row Level Security
ALTER TABLE sam_conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_conversation_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can only access their own threads" ON sam_conversation_threads;
DROP POLICY IF EXISTS "Users can only access their own messages" ON sam_conversation_messages;

-- Create RLS Policies
CREATE POLICY "Users can only access their own threads"
  ON sam_conversation_threads FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own messages"
  ON sam_conversation_messages FOR ALL
  USING (
    thread_id IN (
      SELECT id FROM sam_conversation_threads 
      WHERE user_id = auth.uid()
    )
  );