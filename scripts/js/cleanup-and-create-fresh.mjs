#!/usr/bin/env node
/**
 * Clean up all test campaigns and create one fresh campaign
 */
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

console.log('🧹 Cleaning up test campaigns\n');

// Get all test campaigns
const res = await fetch(`${SUPABASE_URL}/rest/v1/campaigns?select=id,name&workspace_id=eq.${workspaceId}&name=ilike.%test%`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});

const campaigns = await res.json();

console.log(`Found ${campaigns.length} test campaigns to delete:\n`);

// Delete each campaign (this will cascade delete prospects due to foreign keys)
for (const campaign of campaigns) {
  console.log(`  Deleting: ${campaign.name} (${campaign.id.substring(0, 8)}...)`);

  await fetch(`${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaign.id}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
}

console.log('\n✅ All test campaigns deleted!\n');

// Now create a fresh campaign
console.log('🚀 Creating fresh campaign with pending prospects\n');

const campaignRes = await fetch(`${SUPABASE_URL}/rest/v1/campaigns`, {
  method: 'POST',
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    workspace_id: workspaceId,
    name: 'N8N-Test-Campaign',
    status: 'active',
    channel: 'linkedin',
    campaign_type: 'connector',
    settings: {}
  })
});

if (!campaignRes.ok) {
  console.log('❌ Failed to create campaign:', await campaignRes.text());
  process.exit(1);
}

const campaign = (await campaignRes.json())[0];

console.log(`✅ Campaign created: ${campaign.name}`);
console.log(`   ID: ${campaign.id}\n`);

// Add 2 test prospects
const prospectsRes = await fetch(`${SUPABASE_URL}/rest/v1/campaign_prospects`, {
  method: 'POST',
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify([
    {
      campaign_id: campaign.id,
      workspace_id: workspaceId,
      first_name: 'John',
      last_name: 'TestProspect',
      email: 'john.test@example.com',
      linkedin_url: 'https://linkedin.com/in/johntest',
      company_name: 'Test Corp',
      title: 'VP Sales',
      status: 'pending'
    },
    {
      campaign_id: campaign.id,
      workspace_id: workspaceId,
      first_name: 'Jane',
      last_name: 'TestProspect',
      email: 'jane.test@example.com',
      linkedin_url: 'https://linkedin.com/in/janetest',
      company_name: 'Test Inc',
      title: 'Director Marketing',
      status: 'pending'
    }
  ])
});

if (!prospectsRes.ok) {
  console.log('❌ Failed to add prospects:', await prospectsRes.text());
  process.exit(1);
}

const prospects = await prospectsRes.json();

console.log(`✅ Added ${prospects.length} prospects with status='pending'\n`);

console.log('━'.repeat(60));
console.log('✅ READY TO TEST!');
console.log('━'.repeat(60));
console.log('');
console.log('Campaign Name: N8N-Test-Campaign');
console.log(`Campaign ID: ${campaign.id}`);
console.log('Status: active');
console.log('Prospects: 2 (both status=pending)');
console.log('');
console.log('Go to the UI, refresh, find "N8N-Test-Campaign", and execute it!');
console.log('');
