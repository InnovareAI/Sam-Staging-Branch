#!/usr/bin/env node
/**
 * 🚀 ULTRAHARD: Check LinkedIn Accounts Setup
 */
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Checking LinkedIn Account Setup\n');

// Get all workspaces
const workspacesRes = await fetch(`${SUPABASE_URL}/rest/v1/workspaces?select=id,name`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});
const workspaces = await workspacesRes.json();

console.log(`✅ Found ${workspaces.length} workspace(s):\n`);

for (const workspace of workspaces) {
  console.log(`━`.repeat(80));
  console.log(`📁 Workspace: ${workspace.name} (${workspace.id})`);
  console.log(`━`.repeat(80));

  // Check workspace_accounts
  const accountsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/workspace_accounts?select=*&workspace_id=eq.${workspace.id}&provider=eq.linkedin`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const accounts = await accountsRes.json();

  if (Array.isArray(accounts) && accounts.length > 0) {
    console.log(`✅ LinkedIn Account Connected:`);
    accounts.forEach(acc => {
      console.log(`   - ID: ${acc.id}`);
      console.log(`   - Provider: ${acc.provider}`);
      console.log(`   - Unipile Account ID: ${acc.unipile_account_id || '❌ MISSING'}`);
      console.log(`   - Status: ${acc.status || 'active'}`);
      console.log(`   - Created: ${acc.created_at}`);
    });
  } else {
    console.log(`❌ NO LinkedIn Account Connected`);
    console.log(`\n🔧 TO FIX:`);
    console.log(`   1. Go to: https://app.meet-sam.com/workspace/${workspace.id}/settings`);
    console.log(`   2. Navigate to Integrations → LinkedIn`);
    console.log(`   3. Click "Connect LinkedIn"`);
    console.log(`   4. Authenticate with your LinkedIn account via Unipile\n`);
  }

  // Check recent campaigns for this workspace
  const campaignsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/campaigns?select=id,name,status,channel&workspace_id=eq.${workspace.id}&order=created_at.desc&limit=3`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const campaigns = await campaignsRes.json();

  if (Array.isArray(campaigns) && campaigns.length > 0) {
    console.log(`\n📊 Recent Campaigns:`);
    campaigns.forEach(c => {
      console.log(`   - ${c.name} | Channel: ${c.channel || 'linkedin'} | Status: ${c.status}`);
    });
  }

  console.log('');
}

console.log(`\n${'━'.repeat(80)}`);
console.log('💡 SUMMARY');
console.log(`${'━'.repeat(80)}`);
console.log('\nFor campaigns to work, each workspace needs:');
console.log('  1. ✅ A LinkedIn account connected (workspace_accounts table)');
console.log('  2. ✅ The account must have a valid unipile_account_id');
console.log('  3. ✅ The Unipile session must be active');
console.log('\nIf missing, campaigns will fail silently with no message sent.');
console.log('');
