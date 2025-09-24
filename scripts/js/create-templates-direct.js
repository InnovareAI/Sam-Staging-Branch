#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTemplatesTable() {
  console.log('🚀 Creating messaging templates table...');

  try {
    // First check if table exists
    const { data: existingTables, error: checkError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'messaging_templates');

    if (checkError) {
      console.log('ℹ️ Cannot check existing tables, proceeding with creation...');
    }

    // Create a test entry to trigger table creation
    const { data, error } = await supabase
      .from('messaging_templates')
      .insert({
        workspace_id: 'test_workspace',
        template_name: 'Test Template',
        campaign_type: 'sam_signature',
        connection_message: 'Hi {first_name}, test message...',
        follow_up_messages: ['Follow up 1', 'Follow up 2'],
        language: 'en'
      })
      .select();

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Table does not exist. Creating via SQL...');
        
        // Try alternative approach using raw SQL via pg admin
        console.log('📝 Please create the table manually using this SQL:');
        console.log(`
CREATE TABLE messaging_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  template_name TEXT NOT NULL,
  campaign_type TEXT CHECK (campaign_type IN ('sam_signature', 'event_invitation', 'product_launch', 'partnership', 'custom')),
  industry TEXT,
  target_role TEXT,
  target_company_size TEXT,
  connection_message TEXT NOT NULL,
  alternative_message TEXT,
  follow_up_messages JSONB DEFAULT '[]'::jsonb,
  language TEXT DEFAULT 'en',
  tone TEXT DEFAULT 'professional',
  performance_metrics JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, template_name)
);

CREATE TABLE template_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES messaging_templates(id) ON DELETE CASCADE,
  campaign_id UUID,
  total_sent INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  response_rate DECIMAL(5,2) DEFAULT 0.00,
  connection_rate DECIMAL(5,2) DEFAULT 0.00,
  meeting_rate DECIMAL(5,2) DEFAULT 0.00,
  date_start DATE,
  date_end DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messaging_templates_workspace ON messaging_templates(workspace_id);
CREATE INDEX idx_messaging_templates_campaign_type ON messaging_templates(campaign_type);
        `);
        return;
      } else {
        console.error('❌ Error creating table:', error);
        return;
      }
    }

    if (data) {
      console.log('✅ Table already exists! Test insert successful.');
      // Clean up test data
      await supabase
        .from('messaging_templates')
        .delete()
        .eq('template_name', 'Test Template');
      console.log('🧹 Test data cleaned up.');
    }

    console.log('✅ Messaging templates infrastructure ready!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Execute
createTemplatesTable();