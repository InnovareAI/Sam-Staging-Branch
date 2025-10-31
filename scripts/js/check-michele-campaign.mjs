#!/usr/bin/env node
/**
 * Check Michele's Campaign Execution Results
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking Michele\'s Campaign Execution\n');

async function checkCampaignResults() {
  // Find Michele's workspace
  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name, owner_id')
    .or('name.ilike.%michele%,name.ilike.%3cubed%');

  if (wsError) {
    console.error('❌ Error fetching workspaces:', wsError.message);
    return;
  }

  console.log(`📊 Found ${workspaces?.length || 0} matching workspaces\n`);

  if (!workspaces || workspaces.length === 0) {
    // Check recent campaigns across all workspaces
    console.log('Checking recent campaigns across all workspaces...\n');

    const { data: recentCampaigns, error: campError } = await supabase
      .from('campaigns')
      .select('id, name, status, workspace_id, updated_at')
      .gte('updated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order('updated_at', { ascending: false })
      .limit(5);

    if (campError) {
      console.error('❌ Error fetching campaigns:', campError.message);
      return;
    }

    console.log(`📊 Found ${recentCampaigns?.length || 0} recent campaigns\n`);

    for (const campaign of recentCampaigns || []) {
      await checkCampaign(campaign.id, campaign.workspace_id, campaign.name);
    }
    return;
  }

  // Check campaigns for Michele's workspace
  for (const workspace of workspaces) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`WORKSPACE: ${workspace.name}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const { data: campaigns, error: campError } = await supabase
      .from('campaigns')
      .select('id, name, status, created_at, updated_at')
      .eq('workspace_id', workspace.id)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (campError) {
      console.error('❌ Error fetching campaigns:', campError.message);
      continue;
    }

    console.log(`📊 Found ${campaigns?.length || 0} campaigns\n`);

    for (const campaign of campaigns || []) {
      await checkCampaign(campaign.id, workspace.id, campaign.name);
    }
  }
}

async function checkCampaign(campaignId, workspaceId, campaignName) {
  console.log(`\n📋 Campaign: ${campaignName || campaignId}`);
  console.log(`   Workspace ID: ${workspaceId}`);
  console.log(`   Campaign ID: ${campaignId}\n`);

  // Get campaign prospects
  const { data: prospects, error: prospError } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, company_name, status, contacted_at, linkedin_url, personalization_data')
    .eq('campaign_id', campaignId)
    .order('contacted_at', { ascending: false, nullsFirst: false })
    .limit(10);

  if (prospError) {
    console.error('   ❌ Error fetching prospects:', prospError.message);
    return;
  }

  console.log(`   📊 Total Prospects: ${prospects?.length || 0}\n`);

  if (!prospects || prospects.length === 0) {
    console.log('   ℹ️  No prospects found\n');
    return;
  }

  // Count by status
  const statusCounts = {};
  let contactedCount = 0;
  let messagesSent = 0;

  for (const p of prospects) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    if (p.contacted_at) contactedCount++;

    const messageId = p.personalization_data?.unipile_message_id;
    if (messageId) messagesSent++;
  }

  console.log('   📊 Status Breakdown:');
  console.log('   ─────────────────────────────────────');
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`   ${status}: ${count}`);
  }
  console.log('   ─────────────────────────────────────');
  console.log(`   Contacted: ${contactedCount}`);
  console.log(`   Messages Sent: ${messagesSent}\n`);

  // Show recent prospects
  console.log('   📝 Recent Prospects:');
  console.log('   ─────────────────────────────────────');

  for (const p of prospects.slice(0, 5)) {
    const name = `${p.first_name} ${p.last_name}`;
    const company = p.company_name || 'Unknown';
    const contactedTime = p.contacted_at
      ? new Date(p.contacted_at).toLocaleString()
      : 'Not contacted';

    const messageId = p.personalization_data?.unipile_message_id;
    const messageStatus = messageId
      ? messageId.startsWith('untracked_')
        ? '⚠️ Fallback ID'
        : '✅ Tracked'
      : '❌ No ID';

    console.log(`   ${name} (${company})`);
    console.log(`   Status: ${p.status} | Contacted: ${contactedTime}`);
    console.log(`   LinkedIn: ${p.linkedin_url || 'N/A'}`);
    console.log(`   Message: ${messageStatus}${messageId ? ` (${messageId.substring(0, 20)}...)` : ''}`);
    console.log('   ─────────────────────────────────────');
  }

  console.log('');
}

checkCampaignResults().catch(console.error);
