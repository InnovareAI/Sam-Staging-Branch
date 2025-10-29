#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking prospect_approval_data schema...\n');

// Get latest approved prospects
const { data: approvedProspects, error } = await supabase
  .from('prospect_approval_data')
  .select('*')
  .eq('approval_status', 'approved')
  .order('created_at', { ascending: false })
  .limit(3);

if (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

if (!approvedProspects || approvedProspects.length === 0) {
  console.log('⚠️ No approved prospects found');
  process.exit(0);
}

console.log(`✅ Found ${approvedProspects.length} approved prospects\n`);
console.log('📋 Sample prospect structure:');
console.log(JSON.stringify(approvedProspects[0], null, 2));
console.log('\n🔑 Key fields:');
console.log('- id:', approvedProspects[0].id);
console.log('- prospect_id:', approvedProspects[0].prospect_id);
console.log('- session_id:', approvedProspects[0].session_id);
console.log('- name:', approvedProspects[0].name);
console.log('- title:', approvedProspects[0].title);
