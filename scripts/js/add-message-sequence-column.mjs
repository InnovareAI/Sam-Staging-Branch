#!/usr/bin/env node

/**
 * Add message_sequence column to campaigns table via Supabase SQL Editor
 * 
 * This script will execute the migration directly using Supabase service role
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addMessageSequenceColumn() {
  console.log('\n🔧 Adding message_sequence column to campaigns table...\n');

  // Read the migration file
  const migrationPath = 'supabase/migrations/20251123_add_message_sequence_to_campaigns.sql';
  let migrationSQL;
  
  try {
    migrationSQL = readFileSync(migrationPath, 'utf8');
    console.log('📄 Read migration file:', migrationPath);
  } catch (error) {
    console.error('❌ Failed to read migration file:', error.message);
    process.exit(1);
  }

  console.log('\n📝 Migration SQL:');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(migrationSQL);
  console.log('───────────────────────────────────────────────────────────────\n');

  // Execute the migration by making a direct SQL query
  // Note: Supabase client doesn't have direct SQL execution, so we'll use a workaround
  
  console.log('⚠️  MANUAL STEP REQUIRED:\n');
  console.log('1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new');
  console.log('2. Copy and paste the following SQL:\n');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(migrationSQL);
  console.log('───────────────────────────────────────────────────────────────\n');
  console.log('3. Click "Run" to execute the migration\n');

  // Try to verify if column exists by selecting from campaigns
  console.log('🔍 Verifying current schema...\n');
  
  const { data: sampleCampaign, error } = await supabase
    .from('campaigns')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('❌ Failed to fetch sample campaign:', error.message);
    return;
  }

  if (!sampleCampaign) {
    console.log('⚠️  No campaigns in database yet (this is OK)');
    console.log('   Column check will be performed after first campaign is created\n');
    return;
  }

  const hasMessageSequence = 'message_sequence' in sampleCampaign;
  const hasMessageTemplates = 'message_templates' in sampleCampaign;

  console.log('Current schema status:');
  console.log(`${hasMessageTemplates ? '✅' : '❌'} message_templates exists`);
  console.log(`${hasMessageSequence ? '✅' : '⚠️ '} message_sequence exists`);
  
  if (!hasMessageSequence) {
    console.log('\n⚠️  message_sequence column MISSING - please run the SQL above in Supabase dashboard\n');
  } else {
    console.log('\n✅ message_sequence column already exists!\n');
  }
}

addMessageSequenceColumn();
