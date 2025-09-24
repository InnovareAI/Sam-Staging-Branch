#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCampaignsTable() {
  console.log('🔍 Debugging campaigns table structure...');

  try {
    // Try to select from campaigns table to see what exists
    console.log('📝 Attempting to query campaigns table...');
    
    const { data: campaigns, error: selectError } = await supabase
      .from('campaigns')
      .select('*')
      .limit(1);

    if (selectError) {
      console.error('❌ Cannot query campaigns table:', selectError);
      
      if (selectError.code === 'PGRST116') {
        console.log('\n📋 Campaigns table does not exist. Creating complete table...');
        
        // Create a minimal test to trigger table creation
        console.log('🔧 Creating campaigns table via insert (this will fail but might show us the structure)...');
        
        const { data: insertTest, error: insertError } = await supabase
          .from('campaigns')
          .insert({
            id: 'test',
            name: 'test'
          });

        console.log('Insert result:', { insertTest, insertError });
      }
      return;
    }

    if (campaigns && campaigns.length > 0) {
      console.log('✅ Campaigns table exists with data');
      console.log('📋 Current structure (from existing record):');
      const sampleRecord = campaigns[0];
      Object.keys(sampleRecord).forEach(key => {
        console.log(`  - ${key}: ${typeof sampleRecord[key]} = ${sampleRecord[key]}`);
      });
    } else {
      console.log('✅ Campaigns table exists but is empty');
      console.log('📝 Attempting minimal insert to discover structure...');
      
      const { data: testInsert, error: testError } = await supabase
        .from('campaigns')
        .insert({
          name: 'structure_test'
        })
        .select('*');

      if (testError) {
        console.error('❌ Test insert failed:', testError);
        
        // Analyze the error to understand what columns are required
        if (testError.message.includes('null value in column')) {
          const match = testError.message.match(/null value in column "(\w+)"/);
          if (match) {
            console.log(`\n📋 Required column found: ${match[1]}`);
          }
        }
        
        if (testError.message.includes('column') && testError.message.includes('does not exist')) {
          console.log('\n📋 This suggests the table has a different structure than expected');
        }
      } else {
        console.log('✅ Test insert successful:', testInsert);
        
        // Clean up test data
        if (testInsert && testInsert[0]) {
          await supabase
            .from('campaigns')
            .delete()
            .eq('id', testInsert[0].id);
          console.log('🧹 Test record cleaned up');
        }
      }
    }

    // Try to get table schema information
    console.log('\n🔍 Attempting to get table schema...');
    
    const { data: schemaInfo, error: schemaError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', 'campaigns');

    if (schemaError) {
      console.log('⚠️ Cannot access schema information:', schemaError.message);
    } else if (schemaInfo && schemaInfo.length > 0) {
      console.log('📋 Table schema from information_schema:');
      schemaInfo.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
      });
    } else {
      console.log('❌ No schema information found');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Execute debug
debugCampaignsTable();