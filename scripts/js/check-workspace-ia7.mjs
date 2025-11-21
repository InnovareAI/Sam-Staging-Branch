#!/usr/bin/env node
/**
 * Check workspace IA7 status
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = '85e80099-12f9-491a-a0a1-ad48d086a9f0'; // IA7

console.log('🔍 CHECKING WORKSPACE IA7...\n');

// 1. Get workspace details
const { data: workspace } = await supabase
  .from('workspaces')
  .select('*')
  .eq('id', WORKSPACE_ID)
  .single();

console.log('📋 Workspace:');
console.log(`   Name: ${workspace.name}`);
console.log(`   Owner: ${workspace.owner_id}`);
console.log(`   Created: ${workspace.created_at}`);

// 2. Get LinkedIn accounts
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', WORKSPACE_ID);

console.log(`\n💼 LinkedIn Accounts: ${accounts?.length || 0}`);
if (accounts && accounts.length > 0) {
  accounts.forEach(account => {
    console.log(`   - ${account.account_name}`);
    console.log(`     Status: ${account.connection_status}`);
    console.log(`     Active: ${account.is_active}`);
    console.log(`     Unipile ID: ${account.unipile_account_id}`);
  });
} else {
  console.log('   ⚠️  No LinkedIn accounts connected');
}

// 3. Get campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, campaign_name, status, created_at')
  .eq('workspace_id', WORKSPACE_ID);

console.log(`\n📊 Campaigns: ${campaigns?.length || 0}`);
if (campaigns && campaigns.length > 0) {
  campaigns.forEach(campaign => {
    console.log(`   - ${campaign.campaign_name}`);
    console.log(`     Status: ${campaign.status}`);
    console.log(`     Created: ${campaign.created_at}`);
  });
} else {
  console.log('   ℹ️  No campaigns created yet');
}

// 4. Get workspace members
const { data: members } = await supabase
  .from('workspace_members')
  .select('*, users(email)')
  .eq('workspace_id', WORKSPACE_ID);

console.log(`\n👥 Members: ${members?.length || 0}`);
if (members && members.length > 0) {
  members.forEach(member => {
    console.log(`   - ${member.users.email}`);
    console.log(`     Role: ${member.role}`);
  });
}

console.log('\n✅ Workspace check complete');
