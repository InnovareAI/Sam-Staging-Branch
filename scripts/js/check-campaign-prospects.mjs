#!/usr/bin/env node
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const campaignId = '5067bfd4-e4c6-4082-a242-04323c8860c8';

console.log('🔍 Checking campaign prospects status\n');

const res = await fetch(`${SUPABASE_URL}/rest/v1/campaign_prospects?select=id,first_name,last_name,status,created_at&campaign_id=eq.${campaignId}&order=created_at.desc`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});

const prospects = await res.json();

console.log(`Total prospects: ${prospects.length}\n`);

const statusCounts = {};
prospects.forEach(p => {
  statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
});

console.log('Status breakdown:');
Object.entries(statusCounts).forEach(([status, count]) => {
  console.log(`  ${status}: ${count}`);
});

console.log('\nAll prospects:');
prospects.forEach(p => {
  const time = new Date(p.created_at).toLocaleTimeString();
  console.log(`  ${p.first_name} ${p.last_name} - ${p.status} (added at ${time})`);
});
