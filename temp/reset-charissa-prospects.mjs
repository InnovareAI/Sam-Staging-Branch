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

console.log('🔄 Resetting Charissa\'s Queued Prospects\n');

const WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861'; // IA4

// Get all campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status')
  .eq('workspace_id', WORKSPACE_ID);

console.log(`Found ${campaigns.length} campaigns\n`);

// Reset queued prospects
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
  console.error('❌ Error:', error);
  process.exit(1);
}

console.log(`✅ Reset ${reset.length} prospects from queued_in_n8n → pending\n`);

// Show breakdown by campaign
const resetByCampaign = {};
reset.forEach(p => {
  resetByCampaign[p.campaign_id] = (resetByCampaign[p.campaign_id] || 0) + 1;
});

console.log('Prospects reset per campaign:\n');
campaigns.forEach(c => {
  const count = resetByCampaign[c.id] || 0;
  if (count > 0) {
    console.log(`  ${c.name}: ${count} (${c.status})`);
  }
});

console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log('');
console.log(`Total prospects reset: ${reset.length}`);
console.log('Active campaigns will auto-execute these prospects');
console.log('Paused campaigns will wait until resumed');
console.log('');
console.log('✅ Charissa\'s campaigns are ready to run!');
console.log('');
