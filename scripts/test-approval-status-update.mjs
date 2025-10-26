#!/usr/bin/env node

/**
 * Test updating approval_status directly
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Testing approval_status update\n');

// Get a recent prospect
const { data: prospects, error: fetchError } = await supabase
  .from('prospect_approval_data')
  .select('session_id, prospect_id, approval_status')
  .limit(1)
  .order('created_at', { ascending: false });

if (fetchError) {
  console.error('❌ Error fetching prospect:', fetchError);
  process.exit(1);
}

if (!prospects || prospects.length === 0) {
  console.log('⚠️  No prospects found');
  process.exit(0);
}

const prospect = prospects[0];
console.log('Found prospect:');
console.log(`  session_id: ${prospect.session_id}`);
console.log(`  prospect_id: ${prospect.prospect_id}`);
console.log(`  current approval_status: ${prospect.approval_status}`);
console.log('');

// Test 1: Try UPDATE
console.log('Test 1: UPDATE operation');
const { data: updateData, error: updateError } = await supabase
  .from('prospect_approval_data')
  .update({
    approval_status: 'approved',
    updated_at: new Date().toISOString()
  })
  .eq('session_id', prospect.session_id)
  .eq('prospect_id', prospect.prospect_id)
  .select();

if (updateError) {
  console.error('❌ UPDATE failed:');
  console.error('  Error:', updateError);
  console.error('  Code:', updateError.code);
  console.error('  Message:', updateError.message);
  console.error('  Details:', updateError.details);
  console.error('  Hint:', updateError.hint);
} else {
  console.log('✅ UPDATE succeeded');
  console.log('  Updated data:', updateData);
}
console.log('');

// Test 2: Try UPSERT
console.log('Test 2: UPSERT operation');
const { data: upsertData, error: upsertError } = await supabase
  .from('prospect_approval_data')
  .upsert({
    session_id: prospect.session_id,
    prospect_id: prospect.prospect_id,
    approval_status: 'rejected',
    updated_at: new Date().toISOString()
  }, {
    onConflict: 'session_id,prospect_id',
    ignoreDuplicates: false
  })
  .select();

if (upsertError) {
  console.error('❌ UPSERT failed:');
  console.error('  Error:', upsertError);
  console.error('  Code:', upsertError.code);
  console.error('  Message:', upsertError.message);
  console.error('  Details:', upsertError.details);
  console.error('  Hint:', upsertError.hint);
} else {
  console.log('✅ UPSERT succeeded');
  console.log('  Upserted data:', upsertData);
}
console.log('');

// Verify current status
const { data: finalData } = await supabase
  .from('prospect_approval_data')
  .select('approval_status')
  .eq('session_id', prospect.session_id)
  .eq('prospect_id', prospect.prospect_id)
  .single();

console.log('Final status:', finalData?.approval_status);
