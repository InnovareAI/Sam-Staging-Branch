#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

console.log('⏸️  Pausing Michelle\'s Campaigns & Resetting Prospects\n');

const WORKSPACE_ID = '04666209-fce8-4d71-8eaf-01278edfc73b'; // IA2

// Step 1: Get all campaigns
console.log('Step 1: Getting campaigns...\n');

const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status')
  .eq('workspace_id', WORKSPACE_ID);

console.log(`Found ${campaigns.length} campaigns:\n`);
campaigns.forEach((c, i) => {
  console.log(`  ${i + 1}. ${c.name} (${c.status})`);
});
console.log('');

// Step 2: Pause all active campaigns
console.log('Step 2: Pausing active campaigns...\n');

const { data: paused } = await supabase
  .from('campaigns')
  .update({ status: 'paused' })
  .eq('workspace_id', WORKSPACE_ID)
  .in('status', ['active', 'running'])
  .select();

console.log(`✅ Paused ${paused?.length || 0} campaigns\n`);

// Step 3: Reset queued prospects
console.log('Step 3: Resetting queued prospects...\n');

const { data: reset, error } = await supabase
  .from('campaign_prospects')
  .update({ 
    status: 'pending',
    contacted_at: null
  })
  .in('campaign_id', campaigns.map(c => c.id))
  .eq('status', 'queued_in_n8n')
  .select();

if (error) {
  console.error('Error:', error);
} else {
  console.log(`✅ Reset ${reset?.length || 0} prospects from queued_in_n8n → pending\n`);
}

// Step 4: Summary
console.log('='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log('');
console.log(`Campaigns paused: ${paused?.length || 0}`);
console.log(`Prospects reset: ${reset?.length || 0}`);
console.log('');
console.log('Next Steps:');
console.log('1. Michelle reconnects LinkedIn in SAM');
console.log('2. New Unipile account ID will be created');
console.log('3. Resume campaigns:');
console.log('   UPDATE campaigns SET status = \'active\'');
console.log('   WHERE workspace_id = \'04666209-fce8-4d71-8eaf-01278edfc73b\'');
console.log('');
