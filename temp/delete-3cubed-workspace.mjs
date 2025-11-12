#!/usr/bin/env node

/**
 * Delete 3cubed Workspace
 *
 * This will DELETE all data associated with the workspace:
 * - Workspace record
 * - All campaigns
 * - All prospects
 * - All workspace members
 * - All workspace accounts
 * - All knowledge base entries
 *
 * ⚠️ THIS CANNOT BE UNDONE ⚠️
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKSPACE_ID = 'ecb08e55-2b7e-4d49-8f50-d38e39ce2482'; // 3cubed Workspace

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

console.log('🗑️  DELETING 3cubed Workspace\n');
console.log('⚠️  WARNING: This will permanently delete ALL data\n');

// Step 1: Get workspace details
const { data: workspace } = await supabase
  .from('workspaces')
  .select('*')
  .eq('id', WORKSPACE_ID)
  .single();

if (!workspace) {
  console.error('❌ Workspace not found');
  process.exit(1);
}

console.log(`📊 Workspace: ${workspace.name}`);
console.log(`   ID: ${workspace.id}`);
console.log('');

// Step 2: Count related data
console.log('📊 Data to be deleted:\n');

const { count: campaignCount } = await supabase
  .from('campaigns')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', WORKSPACE_ID);

const { count: prospectCount } = await supabase
  .from('campaign_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', WORKSPACE_ID);

const { count: memberCount } = await supabase
  .from('workspace_members')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', WORKSPACE_ID);

const { count: accountCount } = await supabase
  .from('workspace_accounts')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', WORKSPACE_ID);

const { count: kbCount } = await supabase
  .from('knowledge_base')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', WORKSPACE_ID);

console.log(`   Campaigns: ${campaignCount || 0}`);
console.log(`   Prospects: ${prospectCount || 0}`);
console.log(`   Members: ${memberCount || 0}`);
console.log(`   Accounts: ${accountCount || 0}`);
console.log(`   Knowledge base entries: ${kbCount || 0}`);
console.log('');

// Step 3: Delete related data (cascade should handle most, but being explicit)
console.log('🗑️  Deleting related data...\n');

// Delete campaign prospects first (child of campaigns)
if (prospectCount > 0) {
  const { error: prospectError } = await supabase
    .from('campaign_prospects')
    .delete()
    .eq('workspace_id', WORKSPACE_ID);

  if (prospectError) {
    console.error('❌ Error deleting prospects:', prospectError);
  } else {
    console.log(`   ✅ Deleted ${prospectCount} prospects`);
  }
}

// Delete campaigns
if (campaignCount > 0) {
  const { error: campaignError } = await supabase
    .from('campaigns')
    .delete()
    .eq('workspace_id', WORKSPACE_ID);

  if (campaignError) {
    console.error('❌ Error deleting campaigns:', campaignError);
  } else {
    console.log(`   ✅ Deleted ${campaignCount} campaigns`);
  }
}

// Delete workspace members
if (memberCount > 0) {
  const { error: memberError } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', WORKSPACE_ID);

  if (memberError) {
    console.error('❌ Error deleting members:', memberError);
  } else {
    console.log(`   ✅ Deleted ${memberCount} members`);
  }
}

// Delete workspace accounts
if (accountCount > 0) {
  const { error: accountError } = await supabase
    .from('workspace_accounts')
    .delete()
    .eq('workspace_id', WORKSPACE_ID);

  if (accountError) {
    console.error('❌ Error deleting accounts:', accountError);
  } else {
    console.log(`   ✅ Deleted ${accountCount} accounts`);
  }
}

// Delete knowledge base
if (kbCount > 0) {
  const { error: kbError } = await supabase
    .from('knowledge_base')
    .delete()
    .eq('workspace_id', WORKSPACE_ID);

  if (kbError) {
    console.error('❌ Error deleting knowledge base:', kbError);
  } else {
    console.log(`   ✅ Deleted ${kbCount} knowledge base entries`);
  }
}

// Step 4: Delete workspace
console.log('\n🗑️  Deleting workspace...\n');

const { error: workspaceError } = await supabase
  .from('workspaces')
  .delete()
  .eq('id', WORKSPACE_ID);

if (workspaceError) {
  console.error('❌ Error deleting workspace:', workspaceError);
  process.exit(1);
}

console.log('✅ Workspace deleted successfully');

// Step 5: Verify deletion
const { data: verifyWorkspace } = await supabase
  .from('workspaces')
  .select('*')
  .eq('id', WORKSPACE_ID)
  .single();

if (!verifyWorkspace) {
  console.log('✅ Verified: Workspace no longer exists\n');
} else {
  console.error('⚠️  WARNING: Workspace still exists in database\n');
}

console.log('✅ DONE - 3cubed workspace deleted\n');
