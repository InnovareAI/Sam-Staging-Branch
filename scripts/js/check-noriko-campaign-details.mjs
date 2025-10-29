#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = '51803ded-bbc9-4564-aefb-c6d11d69f17c';

console.log('🔍 Noriko\'s Campaign: 20251028-3AI-SEO search 3\n');

const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('id', campaignId)
  .single();

console.log(`Status: ${campaign?.status}`);
console.log(`Created: ${campaign?.created_at}`);
console.log(`Updated: ${campaign?.updated_at}\n`);

// Get ALL prospects with their actual status values
const { data: allProspects } = await supabase
  .from('campaign_prospects')
  .select('status')
  .eq('campaign_id', campaignId);

// Count unique statuses
const statusCounts = {};
allProspects?.forEach(p => {
  statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
});

console.log('📊 Prospect Status Breakdown:');
Object.entries(statusCounts)
  .sort(([,a], [,b]) => b - a)
  .forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

console.log(`\n📤 Total prospects: ${allProspects?.length || 0}`);

// Check for any error messages
const { data: withErrors } = await supabase
  .from('campaign_prospects')
  .select('id, status, first_name, last_name, error_message, personalization_data')
  .eq('campaign_id', campaignId)
  .not('error_message', 'is', null)
  .limit(3);

if (withErrors && withErrors.length > 0) {
  console.log(`\n❌ Prospects with errors (${withErrors.length}):`);
  withErrors.forEach(p => {
    console.log(`   ${p.first_name} ${p.last_name}: ${p.error_message}`);
  });
}

// Summary
const sent = statusCounts['connection_requested'] || 0;
const pending = (statusCounts['pending'] || 0) + (statusCounts['approved'] || 0) + (statusCounts['ready_to_message'] || 0);

console.log('\n✅ Campaign Summary:');
console.log(`   Sent: ${sent} connection requests`);
console.log(`   Pending: ${pending} to be sent`);
console.log(`   Automation: ${campaign?.status === 'active' ? 'Running' : 'Stopped'}`);
