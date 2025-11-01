#!/usr/bin/env node
/**
 * Check what the API actually saw during the last execution
 */
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Checking latest campaign execution\n');

const campaignId = '9fb680d9-ddd2-4e86-87ff-db1ce75b908e';

// Get current prospect statuses
const res = await fetch(`${SUPABASE_URL}/rest/v1/campaign_prospects?select=id,first_name,status,updated_at&campaign_id=eq.${campaignId}`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});

const prospects = await res.json();

console.log('Current prospect statuses:');
prospects.forEach(p => {
  console.log(`  ${p.first_name}: ${p.status}`);
});
console.log('');

// Check what statuses they had
const statusCounts = {};
prospects.forEach(p => {
  statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
});

console.log('Status breakdown:');
Object.entries(statusCounts).forEach(([status, count]) => {
  console.log(`  ${status}: ${count}`);
});
console.log('');

console.log('Expected filter: status === "pending" && (linkedin_url || email)');
console.log('');

if (statusCounts.pending > 0) {
  console.log(`✅ There ARE ${statusCounts.pending} pending prospects!`);
  console.log('   The API should have found them.');
  console.log('   Check the response in browser console for debug info.');
} else {
  console.log('❌ No pending prospects found.');
  console.log('   They must have changed status between reset and API query.');
}
