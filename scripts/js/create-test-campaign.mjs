#!/usr/bin/env node
/**
 * Create a test campaign with pending prospects
 */
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

console.log('🚀 Creating test campaign with pending prospects\n');

// Create campaign
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
    name: `TEST-N8N-${Date.now()}`,
    status: 'active',
    channel: 'linkedin',
    campaign_type: 'connector'
  })
});

const campaign = (await campaignRes.json())[0];

if (!campaign) {
  console.log('❌ Failed to create campaign');
  process.exit(1);
}

console.log(`✅ Campaign created: ${campaign.name}`);
console.log(`   ID: ${campaign.id}\n`);

// Add 2 test prospects
const prospects = [
  {
    campaign_id: campaign.id,
    workspace_id: workspaceId,
    first_name: 'Test',
    last_name: 'Prospect1',
    email: 'test1@example.com',
    linkedin_url: 'https://linkedin.com/in/test1',
    company_name: 'Test Company 1',
    title: 'VP Sales',
    status: 'pending'
  },
  {
    campaign_id: campaign.id,
    workspace_id: workspaceId,
    first_name: 'Test',
    last_name: 'Prospect2',
    email: 'test2@example.com',
    linkedin_url: 'https://linkedin.com/in/test2',
    company_name: 'Test Company 2',
    title: 'Director Marketing',
    status: 'pending'
  }
];

const prospectsRes = await fetch(`${SUPABASE_URL}/rest/v1/campaign_prospects`, {
  method: 'POST',
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify(prospects)
});

const createdProspects = await prospectsRes.json();

console.log(`✅ Added ${createdProspects.length} prospects with status='pending'\n`);

console.log('━'.repeat(60));
console.log('✅ READY TO TEST!');
console.log('━'.repeat(60));
console.log('');
console.log(`Campaign: ${campaign.name}`);
console.log(`ID: ${campaign.id}`);
console.log('Status: active');
console.log('Prospects: 2 (both status=pending)');
console.log('');
console.log('Go to the UI and execute this campaign!');
console.log('');
