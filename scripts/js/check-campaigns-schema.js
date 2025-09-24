#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCampaignsSchema() {
  console.log('🔍 Checking campaigns table schema...');

  try {
    // Try to insert a basic campaign first
    console.log('📝 Testing basic campaign insert...');
    
    const { data: basicTest, error: basicError } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: 'test_basic',
        name: 'Basic Test Campaign',
        type: 'linkedin', // Use existing type
        status: 'draft'
      })
      .select('*')
      .single();

    if (basicError) {
      console.error('❌ Basic campaign insert failed:', basicError);
      return;
    }

    console.log('✅ Basic campaign created:', basicTest.id);

    // Check what columns exist
    const columns = Object.keys(basicTest);
    console.log('\n📋 Existing columns in campaigns table:');
    columns.forEach(col => console.log('  -', col));

    // Check if our needed columns exist
    const neededColumns = ['target_criteria', 'execution_preferences', 'template_id', 'started_at', 'completed_at'];
    const missingColumns = neededColumns.filter(col => !columns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log('\n❌ Missing columns for Sam AI:');
      missingColumns.forEach(col => console.log('  -', col));
    } else {
      console.log('\n✅ All Sam AI columns exist!');
    }

    // Clean up test data
    await supabase
      .from('campaigns')
      .delete()
      .eq('id', basicTest.id);

    console.log('✅ Test data cleaned up');

    if (missingColumns.length > 0) {
      console.log('\n🚀 Solution: Need to add missing columns to campaigns table');
      console.log('📝 SQL commands needed:');
      missingColumns.forEach(col => {
        switch(col) {
          case 'target_criteria':
            console.log(`  ALTER TABLE campaigns ADD COLUMN ${col} JSONB DEFAULT '{}'::jsonb;`);
            break;
          case 'execution_preferences':
            console.log(`  ALTER TABLE campaigns ADD COLUMN ${col} JSONB DEFAULT '{}'::jsonb;`);
            break;
          case 'template_id':
            console.log(`  ALTER TABLE campaigns ADD COLUMN ${col} UUID;`);
            break;
          case 'started_at':
          case 'completed_at':
            console.log(`  ALTER TABLE campaigns ADD COLUMN ${col} TIMESTAMP WITH TIME ZONE;`);
            break;
        }
      });
    }

  } catch (error) {
    console.error('❌ Schema check failed:', error);
  }
}

// Execute schema check
checkCampaignsSchema();