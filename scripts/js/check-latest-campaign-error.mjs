#!/usr/bin/env node
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Checking Latest Campaign Execution Error\n');

// Get most recently updated campaign prospects
const prospectsRes = await fetch(
  `${SUPABASE_URL}/rest/v1/campaign_prospects?select=*,campaigns(name)&order=updated_at.desc&limit=10`,
  { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
);

const prospects = await prospectsRes.json();

console.log('📊 Most Recent Campaign Prospect Updates:\n');

prospects.forEach((p, idx) => {
  console.log(`${idx + 1}. ${p.first_name} ${p.last_name}`);
  console.log(`   Campaign: ${p.campaigns?.name || 'Unknown'}`);
  console.log(`   Status: ${p.status}`);
  console.log(`   Updated: ${p.updated_at}`);

  if (p.personalization_data?.error) {
    console.log(`   ❌ ERROR: ${JSON.stringify(p.personalization_data.error, null, 2)}`);
  }

  if (p.personalization_data?.unipile_message_id) {
    console.log(`   ✅ Message ID: ${p.personalization_data.unipile_message_id}`);
  }

  console.log('');
});

// Get most recently updated campaigns
console.log('\n📋 Most Recently Updated Campaigns:\n');

const campaignsRes = await fetch(
  `${SUPABASE_URL}/rest/v1/campaigns?select=*&order=updated_at.desc&limit=5`,
  { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
);

const campaigns = await campaignsRes.json();

campaigns.forEach((c, idx) => {
  console.log(`${idx + 1}. ${c.name}`);
  console.log(`   ID: ${c.id}`);
  console.log(`   Status: ${c.status}`);
  console.log(`   Updated: ${c.updated_at}`);

  if (c.metadata?.error) {
    console.log(`   ❌ ERROR: ${JSON.stringify(c.metadata.error, null, 2)}`);
  }

  if (c.metadata?.last_execution) {
    console.log(`   📊 Last Execution: ${JSON.stringify(c.metadata.last_execution, null, 2)}`);
  }

  console.log('');
});
