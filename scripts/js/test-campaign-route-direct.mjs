#!/usr/bin/env node
/**
 * Test Campaign Execution Route Directly
 * Simulates the API call to diagnose errors
 */
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🧪 Testing Campaign Execution Route\n');

// Get the most recent active campaign
const campaignsRes = await fetch(
  `${SUPABASE_URL}/rest/v1/campaigns?select=*&status=eq.active&order=updated_at.desc&limit=1`,
  { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
);

const campaigns = await campaignsRes.json();

if (!campaigns || campaigns.length === 0) {
  console.log('❌ No active campaigns found');
  process.exit(1);
}

const campaign = campaigns[0];

console.log(`📋 Campaign: ${campaign.name}`);
console.log(`   ID: ${campaign.id}`);
console.log(`   Workspace: ${campaign.workspace_id}\n`);

// Test the execute-via-n8n endpoint
console.log('🚀 Calling /api/campaigns/linkedin/execute-via-n8n...\n');

const executeRes = await fetch('https://app.meet-sam.com/api/campaigns/linkedin/execute-via-n8n', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': process.env.TEST_AUTH_COOKIE || '' // You'll need to add your auth cookie
  },
  body: JSON.stringify({
    campaignId: campaign.id,
    workspaceId: campaign.workspace_id,
    executionType: 'direct_linkedin'
  })
});

const result = await executeRes.json();

console.log(`📊 Response Status: ${executeRes.status}\n`);

if (executeRes.ok) {
  console.log('✅ SUCCESS!');
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('❌ ERROR!');
  console.log(JSON.stringify(result, null, 2));

  if (result.details) {
    console.log('\n🔍 Error Details:');
    console.log(result.details);
  }
}
