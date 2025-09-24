#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deployTemplatesSchema() {
  console.log('🚀 Deploying messaging templates schema...');

  try {
    // Create messaging_templates table
    const { error: templatesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS messaging_templates (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          template_name TEXT NOT NULL,
          campaign_type TEXT CHECK (campaign_type IN ('sam_signature', 'event_invitation', 'product_launch', 'partnership', 'custom')),
          industry TEXT,
          target_role TEXT,
          target_company_size TEXT CHECK (target_company_size IN ('startup', 'smb', 'mid_market', 'enterprise')),
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
      `
    });

    if (templatesError) {
      console.error('❌ Error creating messaging_templates:', templatesError);
      return;
    }

    // Create template_performance table
    const { error: performanceError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS template_performance (
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
      `
    });

    if (performanceError) {
      console.error('❌ Error creating template_performance:', performanceError);
      return;
    }

    // Create indexes
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_messaging_templates_workspace ON messaging_templates(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_messaging_templates_campaign_type ON messaging_templates(campaign_type);
        CREATE INDEX IF NOT EXISTS idx_messaging_templates_industry ON messaging_templates(industry);
        CREATE INDEX IF NOT EXISTS idx_template_performance_template_id ON template_performance(template_id);
      `
    });

    if (indexError) {
      console.error('❌ Error creating indexes:', indexError);
      return;
    }

    // Enable RLS
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE messaging_templates ENABLE ROW LEVEL SECURITY;
        ALTER TABLE template_performance ENABLE ROW LEVEL SECURITY;
      `
    });

    if (rlsError) {
      console.error('❌ Error enabling RLS:', rlsError);
      return;
    }

    console.log('✅ Messaging templates schema deployed successfully!');
    console.log('📊 Tables created:');
    console.log('  - messaging_templates');
    console.log('  - template_performance');
    console.log('🔒 RLS enabled');
    console.log('📝 Indexes created');

  } catch (error) {
    console.error('❌ Deployment failed:', error);
  }
}

// Execute if run directly
deployTemplatesSchema();

export { deployTemplatesSchema };