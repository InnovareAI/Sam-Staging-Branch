
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/security/route-auth';

// Pool imported from lib/db
export async function POST(request: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    console.log('🚀 Starting table creation...');
    
    // First, let's create the threads table by trying to insert a dummy record and catch the error
    try {
      const { error: createThreadsError } = await pool
        .from('sam_conversation_threads')
        .insert([{
          title: 'test',
          thread_type: 'test',
          user_id: '00000000-0000-0000-0000-000000000000' // This will fail but help us understand the schema
        }]);
      
      if (createThreadsError) {
        console.log('Threads table creation needed:', createThreadsError.message);
      }
    } catch (err) {
      console.log('Expected error during table check:', err);
    }

    // Use direct SQL execution via the admin client
    const threadsSQL = `
      CREATE TABLE IF NOT EXISTS sam_conversation_threads (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        organization_id UUID,
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
    `;

    const messagesSQL = `
      CREATE TABLE IF NOT EXISTS sam_conversation_messages (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        thread_id UUID REFERENCES sam_conversation_threads(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    const indexSQL = `
      CREATE INDEX IF NOT EXISTS idx_sam_threads_user_id ON sam_conversation_threads(user_id);
      CREATE INDEX IF NOT EXISTS idx_sam_threads_last_active ON sam_conversation_threads(last_active_at);
      CREATE INDEX IF NOT EXISTS idx_sam_messages_thread_id ON sam_conversation_messages(thread_id);
      CREATE INDEX IF NOT EXISTS idx_sam_messages_created_at ON sam_conversation_messages(created_at);
    `;

    const rlsSQL = `
      ALTER TABLE sam_conversation_threads ENABLE ROW LEVEL SECURITY;
      ALTER TABLE sam_conversation_messages ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "Users can only access their own threads" ON sam_conversation_threads;
      DROP POLICY IF EXISTS "Users can only access their own messages" ON sam_conversation_messages;
      
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

    // Try to execute SQL using fetch with Supabase Management API
    const managementUrl = 'https://api.supabase.com/v1/projects/latxadqrvrrrcvkktrog/database/query';
    const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
    
    if (!accessToken) {
      throw new Error('SUPABASE_ACCESS_TOKEN not found');
    }

    console.log('Executing SQL via Management API...');
    const response = await fetch(managementUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: threadsSQL + '\n' + messagesSQL + '\n' + indexSQL + '\n' + rlsSQL
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`Management API error: ${JSON.stringify(result)}`);
    }
    
    const threadsError = null;
    const messagesError = null;
    const indexError = null; 
    const rlsError = null;

    return NextResponse.json({
      success: true,
      message: 'Database tables created successfully!',
      results: {
        threads: threadsError ? `Error: ${threadsError.message}` : 'Success',
        messages: messagesError ? `Error: ${messagesError.message}` : 'Success',  
        indexes: indexError ? `Error: ${indexError.message}` : 'Success',
        rls: rlsError ? `Error: ${rlsError.message}` : 'Success'
      },
      next_steps: [
        'Test health check: /api/admin/check-db',
        'Test chat functionality: /api/sam/threads'
      ]
    });

  } catch (error) {
    console.error('Table creation failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create tables',
      details: String(error),
      manual_fix: 'Copy SQL from create-tables.sql and run in Supabase SQL Editor'
    }, { status: 500 });
  }
}

export async function GET() {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  return NextResponse.json({
    message: 'Use POST to create tables',
    health_check: '/api/admin/check-db',
    sql_file: 'create-tables.sql'
  });
}
