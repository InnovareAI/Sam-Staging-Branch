#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name')
  .order('created_at', { ascending: false })
  .limit(1);

const campaign = campaigns?.[0];
console.log('Campaign:', campaign?.name);
console.log('Campaign ID:', campaign?.id);
console.log();

// Get all prospects with their status
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('status, contacted_at, personalization_data, first_name, last_name, linkedin_url')
  .eq('campaign_id', campaign?.id)
  .order('contacted_at', { ascending: false });

console.log('PROSPECT STATUS SUMMARY:');
console.log('='.repeat(60));

const statusCounts = {};
prospects?.forEach(p => {
  statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
});

Object.entries(statusCounts).forEach(([status, count]) => {
  console.log(`${status}: ${count}`);
});

console.log();
console.log('RECENT ACTIVITY:');
console.log('='.repeat(60));

prospects?.slice(0, 5).forEach(p => {
  console.log(`\n${p.first_name} ${p.last_name} (${p.status})`);
  console.log(`  LinkedIn: ${p.linkedin_url}`);
  console.log(`  Contacted: ${p.contacted_at || 'Never'}`);
  if (p.personalization_data) {
    if (p.personalization_data.error) {
      console.log(`  ❌ Error: ${p.personalization_data.error}`);
    }
    if (p.personalization_data.unipile_invitation_id) {
      console.log(`  ✅ Invitation ID: ${p.personalization_data.unipile_invitation_id}`);
    }
  }
});
