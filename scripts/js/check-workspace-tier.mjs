#!/usr/bin/env node
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

console.log('🔍 Checking Workspace Tier Configuration\n');

// Check workspace tier
const tierRes = await fetch(`${SUPABASE_URL}/rest/v1/workspace_tiers?select=*&workspace_id=eq.${workspaceId}`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});

const tiers = await tierRes.json();

if (!tiers || tiers.length === 0) {
  console.log('❌ NO WORKSPACE TIER FOUND!');
  console.log('This would cause error: "Workspace tier configuration not found"\n');
  console.log('The execute-via-n8n route requires a workspace tier.');
  console.log('Creating a default tier...\n');

  // Create default tier
  const createRes = await fetch(`${SUPABASE_URL}/rest/v1/workspace_tiers`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      tier_type: 'startup',
      tier_status: 'active',
      monthly_email_limit: 800,
      monthly_linkedin_limit: 400,
      max_campaigns: 5,
      max_team_members: 3
    })
  });

  const newTier = await createRes.json();

  if (createRes.ok) {
    console.log('✅ Created default tier:');
    console.log(JSON.stringify(newTier, null, 2));
  } else {
    console.log('❌ Failed to create tier:');
    console.log(newTier);
  }
} else {
  console.log('✅ Workspace tier found:');
  console.log(JSON.stringify(tiers[0], null, 2));
}
