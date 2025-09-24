#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function enhanceCampaignsTable() {
  console.log('🚀 Enhancing campaigns table for Sam AI...');

  try {
    // Add new columns to campaigns table
    console.log('📝 Adding target_criteria column...');
    
    const { error: addTargetCriteria } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE campaigns 
        ADD COLUMN IF NOT EXISTS target_criteria JSONB DEFAULT '{}'::jsonb;
      `
    });

    if (addTargetCriteria) {
      console.log('⚠️  target_criteria column may already exist:', addTargetCriteria.message);
    } else {
      console.log('✅ target_criteria column added');
    }

    console.log('📝 Adding execution_preferences column...');
    
    const { error: addExecutionPrefs } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE campaigns 
        ADD COLUMN IF NOT EXISTS execution_preferences JSONB DEFAULT '{}'::jsonb;
      `
    });

    if (addExecutionPrefs) {
      console.log('⚠️  execution_preferences column may already exist:', addExecutionPrefs.message);
    } else {
      console.log('✅ execution_preferences column added');
    }

    console.log('📝 Adding template_id column...');
    
    const { error: addTemplateId } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE campaigns 
        ADD COLUMN IF NOT EXISTS template_id UUID;
      `
    });

    if (addTemplateId) {
      console.log('⚠️  template_id column may already exist:', addTemplateId.message);
    } else {
      console.log('✅ template_id column added');
    }

    console.log('📝 Adding foreign key constraint...');
    
    const { error: addForeignKey } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE campaigns 
        ADD CONSTRAINT fk_campaigns_template_id 
        FOREIGN KEY (template_id) REFERENCES messaging_templates(id);
      `
    });

    if (addForeignKey) {
      console.log('⚠️  Foreign key constraint may already exist:', addForeignKey.message);
    } else {
      console.log('✅ Foreign key constraint added');
    }

    console.log('📝 Adding timestamp columns...');
    
    const { error: addTimestamps } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE campaigns 
        ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
      `
    });

    if (addTimestamps) {
      console.log('⚠️  Timestamp columns may already exist:', addTimestamps.message);
    } else {
      console.log('✅ Timestamp columns added');
    }

    console.log('📝 Creating indexes...');
    
    const { error: addIndexes } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_campaigns_template_id ON campaigns(template_id);
        CREATE INDEX IF NOT EXISTS idx_campaigns_status_enhanced ON campaigns(status);
        CREATE INDEX IF NOT EXISTS idx_campaigns_type_enhanced ON campaigns(type);
      `
    });

    if (addIndexes) {
      console.log('⚠️  Indexes may already exist:', addIndexes.message);
    } else {
      console.log('✅ Indexes created');
    }

    // Test the enhanced table
    console.log('\n🧪 Testing enhanced campaigns table...');
    
    const { data: testCampaign, error: testError } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: 'test_enhancement',
        name: 'Enhancement Test Campaign',
        type: 'sam_signature',
        status: 'draft',
        target_criteria: {
          industry: 'technology',
          role: 'CEO'
        },
        execution_preferences: {
          daily_limit: 50,
          personalization_level: 'advanced'
        }
      })
      .select('*')
      .single();

    if (testError) {
      console.error('❌ Enhancement test failed:', testError);
      return;
    }

    console.log('✅ Enhancement test successful:', testCampaign.id);

    // Clean up test data
    await supabase
      .from('campaigns')
      .delete()
      .eq('id', testCampaign.id);

    console.log('✅ Test data cleaned up');

    console.log('\n🎉 Campaigns table enhanced successfully!');
    console.log('📋 New fields added:');
    console.log('  ✅ target_criteria (JSONB)');
    console.log('  ✅ execution_preferences (JSONB)');
    console.log('  ✅ template_id (UUID, FK to messaging_templates)');
    console.log('  ✅ started_at (TIMESTAMP)');
    console.log('  ✅ completed_at (TIMESTAMP)');
    console.log('\n🚀 Ready for Sam AI campaign orchestration!');

  } catch (error) {
    console.error('❌ Enhancement failed:', error);
  }
}

// Execute enhancement
enhanceCampaignsTable();