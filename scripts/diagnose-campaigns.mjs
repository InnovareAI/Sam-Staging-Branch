#!/usr/bin/env node

/**
 * Diagnose Campaign Starting Issues
 *
 * Checks:
 * - Campaign records and their status
 * - Campaign prospects and LinkedIn IDs
 * - User LinkedIn accounts
 * - Workspace accounts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Diagnosing Campaign System\n');
console.log('='.repeat(60));

// 1. Check campaigns
console.log('\n📊 CAMPAIGNS:');
const { data: campaigns, error: campaignsError } = await supabase
  .from('campaigns')
  .select('id, name, campaign_type, status, created_at')
  .order('created_at', { ascending: false })
  .limit(10);

if (campaignsError) {
  console.error('❌ Error fetching campaigns:', campaignsError);
} else if (!campaigns || campaigns.length === 0) {
  console.log('⚠️  No campaigns found');
} else {
  console.log(`✅ Found ${campaigns.length} campaigns (showing latest 10):\n`);
  campaigns.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name || '(no name)'}`);
    console.log(`   ID: ${c.id}`);
    console.log(`   Type: ${c.campaign_type || 'unknown'}`);
    console.log(`   Status: ${c.status || 'unknown'}`);
    console.log(`   Created: ${c.created_at}`);
    console.log('');
  });
}

// 2. Check campaign prospects
if (campaigns && campaigns.length > 0) {
  const campaignId = campaigns[0].id;
  console.log(`\n👥 PROSPECTS for campaign "${campaigns[0].name}":`);

  const { data: prospects, error: prospectsError } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url, linkedin_user_id, status')
    .eq('campaign_id', campaignId)
    .limit(5);

  if (prospectsError) {
    console.error('❌ Error fetching prospects:', prospectsError);
  } else if (!prospects || prospects.length === 0) {
    console.log('⚠️  No prospects found for this campaign');
  } else {
    console.log(`✅ Found ${prospects.length} prospects (showing first 5):\n`);
    prospects.forEach((p, i) => {
      console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`   LinkedIn URL: ${p.linkedin_url || 'none'}`);
      console.log(`   LinkedIn ID: ${p.linkedin_user_id || 'NOT RESOLVED'}`);
      console.log(`   Status: ${p.status || 'unknown'}`);
      console.log('');
    });
  }
}

// 3. Check user_unipile_accounts
console.log('\n🔗 USER LINKEDIN ACCOUNTS:');
const { data: userAccounts, error: userAccountsError } = await supabase
  .from('user_unipile_accounts')
  .select('unipile_account_id, user_id, platform, account_name, connection_status, workspace_id')
  .eq('platform', 'LINKEDIN');

if (userAccountsError) {
  console.error('❌ Error fetching user accounts:', userAccountsError);
} else if (!userAccounts || userAccounts.length === 0) {
  console.log('⚠️  No LinkedIn accounts found in user_unipile_accounts');
} else {
  console.log(`✅ Found ${userAccounts.length} LinkedIn accounts:\n`);
  userAccounts.forEach((a, i) => {
    console.log(`${i + 1}. ${a.account_name || '(no name)'}`);
    console.log(`   Unipile ID: ${a.unipile_account_id}`);
    console.log(`   User ID: ${a.user_id}`);
    console.log(`   Workspace ID: ${a.workspace_id || 'NOT SET'}`);
    console.log(`   Status: ${a.connection_status}`);
    console.log('');
  });
}

// 4. Check workspace_accounts
console.log('\n🏢 WORKSPACE ACCOUNTS:');
const { data: workspaceAccounts, error: workspaceAccountsError } = await supabase
  .from('workspace_accounts')
  .select('unipile_account_id, workspace_id, platform, account_name, connection_status');

if (workspaceAccountsError) {
  console.error('❌ Error fetching workspace accounts:', workspaceAccountsError);
} else if (!workspaceAccounts || workspaceAccounts.length === 0) {
  console.log('⚠️  No accounts found in workspace_accounts');
} else {
  console.log(`✅ Found ${workspaceAccounts.length} workspace accounts:\n`);
  workspaceAccounts.forEach((a, i) => {
    console.log(`${i + 1}. ${a.account_name || '(no name)'} (${a.platform})`);
    console.log(`   Unipile ID: ${a.unipile_account_id}`);
    console.log(`   Workspace ID: ${a.workspace_id}`);
    console.log(`   Status: ${a.connection_status}`);
    console.log('');
  });
}

// 5. Check account mapping
console.log('\n🔄 ACCOUNT MAPPING STATUS:');
const { data: mappingStatus, error: mappingError } = await supabase
  .from('v_linkedin_account_status')
  .select('*');

if (mappingError) {
  console.error('❌ Error fetching mapping status:', mappingError);
  console.log('ℹ️  The view v_linkedin_account_status might not exist');
} else if (!mappingStatus || mappingStatus.length === 0) {
  console.log('⚠️  No mapping data found');
} else {
  const grouped = mappingStatus.reduce((acc, item) => {
    const status = item.mapping_status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  console.log('Account mapping summary:');
  Object.entries(grouped).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
}

console.log('\n' + '='.repeat(60));
console.log('\n✅ Diagnosis complete');
