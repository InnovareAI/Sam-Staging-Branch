#!/usr/bin/env node
/**
 * Test Campaign Execution - Live API Call
 * This will show the full error details from the API
 */
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🧪 Testing Campaign Execution Live\n');

// Get the most recent active campaign
console.log('1️⃣ Fetching most recent active campaign...');
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

console.log(`✅ Campaign: ${campaign.name}`);
console.log(`   ID: ${campaign.id}`);
console.log(`   Workspace: ${campaign.workspace_id}\n`);

// Get user auth to make the API call
console.log('2️⃣ Note: This script cannot authenticate as a user.');
console.log('   Please run this in the browser console instead:\n');

console.log('Copy and paste this into your browser console on app.meet-sam.com:\n');
console.log('─'.repeat(80));
console.log(`
fetch('/api/campaigns/linkedin/execute-via-n8n', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    campaignId: '${campaign.id}',
    workspaceId: '${campaign.workspace_id}',
    executionType: 'direct_linkedin'
  })
})
.then(res => res.json())
.then(data => {
  console.log('📊 Response:', data);
  if (data.error) {
    console.error('❌ ERROR DETAILS:');
    console.error('Error:', data.error);
    console.error('Details:', data.details);
    console.error('Type:', data.error_type);
    console.error('Stack:', data.stack);
  }
})
.catch(err => console.error('Request failed:', err));
`);
console.log('─'.repeat(80));
console.log('\nThis will show the full error details including stack trace.\n');
