#!/usr/bin/env node
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Get the most recent pending prospect
const res = await fetch(`${SUPABASE_URL}/rest/v1/campaign_prospects?select=*&status=eq.pending&order=updated_at.desc&limit=1`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});

const prospects = await res.json();

if (prospects.length === 0) {
  console.log('❌ No pending prospects found');
  process.exit(1);
}

const prospect = prospects[0];

console.log('📋 Prospect Data:\n');
console.log('Name:', prospect.first_name, prospect.last_name);
console.log('Status:', prospect.status);
console.log('LinkedIn URL:', prospect.linkedin_url);
console.log('Email:', prospect.email);
console.log('Company:', prospect.company_name);
console.log('Title:', prospect.title);
console.log('');

// Check if it meets the filter criteria
const hasLinkedIn = !!prospect.linkedin_url;
const hasEmail = !!prospect.email;

console.log('Filter Check (must have linkedin_url OR email):');
console.log('  Has LinkedIn URL:', hasLinkedIn ? '✅' : '❌');
console.log('  Has Email:', hasEmail ? '✅' : '❌');
console.log('  Passes filter:', (hasLinkedIn || hasEmail) ? '✅ YES' : '❌ NO');
console.log('');

if (!hasLinkedIn && !hasEmail) {
  console.log('⚠️  This prospect will be filtered out because it has neither linkedin_url nor email!');
  console.log('');
  console.log('Full data:');
  console.log(JSON.stringify(prospect, null, 2));
}
