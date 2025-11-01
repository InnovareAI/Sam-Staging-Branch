#!/usr/bin/env node
/**
 * Find which campaign has the 3 pending prospects
 */
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

console.log('🔍 Finding campaign with pending prospects\n');

// Get all active campaigns
const res = await fetch(`${SUPABASE_URL}/rest/v1/campaigns?select=id,name,created_at,status&workspace_id=eq.${workspaceId}&status=eq.active&order=created_at.desc`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});

const campaigns = await res.json();

for (const campaign of campaigns) {
  // Get prospect counts
  const pRes = await fetch(`${SUPABASE_URL}/rest/v1/campaign_prospects?select=status&campaign_id=eq.${campaign.id}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });

  const prospects = await pRes.json();
  const statusCounts = {};
  prospects.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });

  const hasPending = statusCounts.pending > 0;
  const icon = hasPending ? '✅' : '  ';

  console.log(`${icon} ${campaign.name}`);
  console.log(`   ID: ${campaign.id}`);
  console.log(`   Total: ${prospects.length} prospects`);
  console.log(`   Status:`, statusCounts);

  if (hasPending) {
    console.log(`   👉 THIS CAMPAIGN HAS ${statusCounts.pending} PENDING PROSPECTS!`);
  }

  console.log('');
}
