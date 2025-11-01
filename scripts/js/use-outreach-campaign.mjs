#!/usr/bin/env node
/**
 * Use the empty Outreach Campaign and add fresh prospects
 */
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🎯 Setting up Outreach Campaign for testing\n');

// Use the 20251101-IAI-Outreach Campaign (it has 0 prospects)
const campaignId = '5067bfd4-e4c6-4082-a242-04323c8860c8';
const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

console.log('Campaign: 20251101-IAI-Outreach Campaign');
console.log(`ID: ${campaignId}\n`);

// Add 2 fresh test prospects
console.log('Adding 2 test prospects...');

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
      campaign_id: campaignId,
      workspace_id: workspaceId,
      first_name: 'Alex',
      last_name: 'TestUser',
      email: 'alex@example.com',
      linkedin_url: 'https://linkedin.com/in/alextest',
      company_name: 'Test Company A',
      title: 'CEO',
      status: 'pending'
    },
    {
      campaign_id: campaignId,
      workspace_id: workspaceId,
      first_name: 'Sarah',
      last_name: 'TestUser',
      email: 'sarah@example.com',
      linkedin_url: 'https://linkedin.com/in/sarahtest',
      company_name: 'Test Company B',
      title: 'VP Marketing',
      status: 'pending'
    }
  ])
});

if (prospectsRes.ok) {
  const prospects = await prospectsRes.json();
  console.log(`✅ Added ${prospects.length} prospects with status='pending'\n`);

  console.log('━'.repeat(60));
  console.log('✅ READY TO TEST!');
  console.log('━'.repeat(60));
  console.log('');
  console.log('Campaign: 20251101-IAI-Outreach Campaign');
  console.log('Prospects: 2 (both status=pending)');
  console.log('');
  console.log('Go to UI, find "20251101-IAI-Outreach Campaign", and execute!');
  console.log('');
} else {
  const error = await prospectsRes.text();
  console.log('❌ Failed to add prospects:');
  console.log(error);
}
