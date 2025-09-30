import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTables() {
  console.log('🚀 Creating SAM conversation tables...\n');

  const sql = `
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
`;

  try {
    // Execute via RPC if available, or via REST API
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('❌ RPC method not available, trying direct table creation...\n');
      
      // Try creating a test record to trigger table creation
      const { error: testError } = await supabase
        .from('sam_conversation_threads')
        .select('id')
        .limit(1);
      
      if (testError && testError.message.includes('does not exist')) {
        console.error('❌ Tables do not exist and cannot be created via API.');
        console.error('\n📋 Please run the SQL manually in Supabase:');
        console.error('   1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql');
        console.error('   2. Copy the SQL from: setup-sam-tables.sql');
        console.error('   3. Paste and run it in the SQL editor\n');
        process.exit(1);
      }
      
      console.log('✅ Tables already exist!');
    } else {
      console.log('✅ Tables created successfully!');
    }
    
    // Test the tables
    console.log('\n🔍 Testing table access...');
    const { data: threads, error: threadsError } = await supabase
      .from('sam_conversation_threads')
      .select('id')
      .limit(1);
    
    if (threadsError) {
      console.error('❌ Error accessing threads table:', threadsError.message);
    } else {
      console.log('✅ Threads table accessible');
    }
    
    const { data: messages, error: messagesError } = await supabase
      .from('sam_conversation_messages')
      .select('id')
      .limit(1);
    
    if (messagesError) {
      console.error('❌ Error accessing messages table:', messagesError.message);
    } else {
      console.log('✅ Messages table accessible');
    }
    
    console.log('\n✨ Setup complete! You can now use SAM conversations.\n');
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    console.error('\n📋 Please run the SQL manually in Supabase:');
    console.error('   1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql');
    console.error('   2. Copy the SQL from: setup-sam-tables.sql');
    console.error('   3. Paste and run it in the SQL editor\n');
    process.exit(1);
  }
}

createTables();