#!/usr/bin/env node
/**
 * Reset a prospect to 'pending' status for testing
 */
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔄 Resetting prospect to pending status\n');

// Get most recent campaign
const res = await fetch(`${SUPABASE_URL}/rest/v1/campaigns?select=id,name&order=updated_at.desc&limit=1`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});

const campaigns = await res.json();
const campaignId = campaigns[0].id;

console.log('Campaign:', campaigns[0].name);
console.log('ID:', campaignId);
console.log('');

// Get first prospect
const prospectsRes = await fetch(`${SUPABASE_URL}/rest/v1/campaign_prospects?select=id,first_name,last_name,status&campaign_id=eq.${campaignId}&limit=1`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});

const prospects = await prospectsRes.json();

if (prospects.length === 0) {
  console.log('❌ No prospects found in campaign');
  process.exit(1);
}

const prospect = prospects[0];
console.log(`Prospect: ${prospect.first_name} ${prospect.last_name}`);
console.log(`Current status: ${prospect.status}`);
console.log('');

// Update to pending
const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/campaign_prospects?id=eq.${prospect.id}`, {
  method: 'PATCH',
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    status: 'pending',
    contacted_at: null,
    n8n_execution_id: null
  })
});

if (updateRes.ok) {
  console.log('✅ Prospect reset to pending status!');
  console.log('');
  console.log('You can now execute the campaign and it will process this prospect.');
} else {
  const error = await updateRes.json();
  console.log('❌ Failed to update:', error);
}
