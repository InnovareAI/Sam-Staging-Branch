#!/usr/bin/env node
/**
 * Identify which campaign in the UI has pending prospects
 */
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const targetId = '9fb680d9-ddd2-4e86-87ff-db1ce75b908e';

console.log('🎯 Finding the correct campaign to execute\n');

const res = await fetch(`${SUPABASE_URL}/rest/v1/campaigns?select=id,name,created_at&id=eq.${targetId}`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});

const campaign = (await res.json())[0];

// Get prospect count
const pRes = await fetch(`${SUPABASE_URL}/rest/v1/campaign_prospects?select=status&campaign_id=eq.${targetId}`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});

const prospects = await pRes.json();
const pendingCount = prospects.filter(p => p.status === 'pending').length;

console.log('✅ THE CAMPAIGN TO EXECUTE:');
console.log('━'.repeat(60));
console.log(`Name: ${campaign.name}`);
console.log(`Created: ${new Date(campaign.created_at).toLocaleString()}`);
console.log(`Prospects: ${prospects.length} total, ${pendingCount} pending`);
console.log('━'.repeat(60));
console.log('');
console.log('👉 Look for this EXACT creation date/time in your UI');
console.log(`   Created on: ${new Date(campaign.created_at).toLocaleString()}`);
console.log('');
console.log('There are multiple campaigns named "20251101-IAI-test 10".');
console.log('You need to execute the one created at the time shown above!');
console.log('');
