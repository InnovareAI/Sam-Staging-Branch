#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking InnovareAI Test Campaign\n');

// Check the test campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, name, status, created_at, updated_at')
  .eq('id', 'e33716ce-453f-436d-bb54-bcd16d20a92f')
  .single();

console.log('📋 Campaign:', campaign?.name);
console.log('   Status:', campaign?.status);
console.log('   Updated:', new Date(campaign?.updated_at).toLocaleString());
console.log('');

// Get all prospects
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', 'e33716ce-453f-436d-bb54-bcd16d20a92f')
  .order('updated_at', { ascending: false });

console.log(`📊 Total Prospects: ${prospects?.length || 0}\n`);

if (prospects && prospects.length > 0) {
  const statusCounts = {};
  let contacted = 0;
  let withMessageId = 0;

  for (const p of prospects) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    if (p.contacted_at) contacted++;
    if (p.personalization_data?.unipile_message_id) withMessageId++;
  }

  console.log('Status Breakdown:');
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`  ${status}: ${count}`);
  }
  console.log(`  Contacted: ${contacted}`);
  console.log(`  With Message ID: ${withMessageId}\n`);

  console.log('Recent Prospects (top 5):');
  console.log('─────────────────────────────────────');
  for (const p of prospects.slice(0, 5)) {
    console.log(`${p.first_name} ${p.last_name} (${p.company_name || 'Unknown'})`);
    console.log(`  Status: ${p.status}`);
    console.log(`  Updated: ${new Date(p.updated_at).toLocaleString()}`);
    console.log(`  Contacted: ${p.contacted_at ? new Date(p.contacted_at).toLocaleString() : 'Not yet'}`);
    if (p.personalization_data?.unipile_message_id) {
      console.log(`  Message ID: ${p.personalization_data.unipile_message_id.substring(0, 30)}...`);
    }
    console.log('─────────────────────────────────────');
  }
}
