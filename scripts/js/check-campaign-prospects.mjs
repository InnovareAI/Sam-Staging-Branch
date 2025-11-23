#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProspects() {
  const campaignId = '1d3428f8-454d-4ffb-8337-4273f781adfb';
  
  console.log('\n👥 CAMPAIGN PROSPECTS CHECK\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`Found ${prospects.length} prospects\n`);

  // Group by status
  const statusCounts = {};
  prospects.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });

  console.log('Status Breakdown:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  console.log('\n');

  // Show first 5 prospects
  console.log('First 5 prospects:\n');
  prospects.slice(0, 5).forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
    console.log(`   ├─ Status: ${p.status}`);
    console.log(`   ├─ LinkedIn URL: ${p.linkedin_url ? '✅' : '❌ MISSING'}`);
    console.log(`   ├─ LinkedIn User ID: ${p.linkedin_user_id || '❌ MISSING'}`);
    console.log(`   ├─ Contacted at: ${p.contacted_at || 'Not yet'}`);
    console.log(`   ├─ Follow-up due: ${p.follow_up_due_at || 'Not scheduled'}`);
    console.log(`   └─ Notes: ${p.notes || 'None'}\n`);
  });

  console.log('═══════════════════════════════════════════════════════════════\n');
}

checkProspects();
