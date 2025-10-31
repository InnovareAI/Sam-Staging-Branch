#!/usr/bin/env node
/**
 * Check Most Recent Campaign Executions (Last Hour)
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

console.log('🔍 Checking Recent Campaign Executions (Last Hour)\n');

async function checkRecentCampaigns() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Get campaigns updated in last hour
  const { data: campaigns, error: campError } = await supabase
    .from('campaigns')
    .select('id, name, status, workspace_id, created_at, updated_at')
    .gte('updated_at', oneHourAgo)
    .order('updated_at', { ascending: false });

  if (campError) {
    console.error('❌ Error fetching campaigns:', campError.message);
    return;
  }

  console.log(`📊 Found ${campaigns?.length || 0} campaigns updated in last hour\n`);

  if (!campaigns || campaigns.length === 0) {
    console.log('ℹ️  No recent campaign activity\n');
    return;
  }

  // Check prospects contacted in last hour
  const { data: recentProspects, error: prospError } = await supabase
    .from('campaign_prospects')
    .select('id, campaign_id, first_name, last_name, company_name, status, contacted_at, linkedin_url, personalization_data')
    .gte('contacted_at', oneHourAgo)
    .order('contacted_at', { ascending: false });

  if (prospError) {
    console.error('❌ Error fetching prospects:', prospError.message);
    return;
  }

  console.log(`📊 Found ${recentProspects?.length || 0} prospects contacted in last hour\n`);

  // Get workspace names
  const workspaceIds = [...new Set(campaigns.map(c => c.workspace_id))];
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .in('id', workspaceIds);

  const workspaceMap = {};
  for (const ws of workspaces || []) {
    workspaceMap[ws.id] = ws.name;
  }

  // Show recent campaigns
  for (const campaign of campaigns) {
    const workspaceName = workspaceMap[campaign.workspace_id] || 'Unknown';
    const campaignProspects = recentProspects?.filter(p => p.campaign_id === campaign.id) || [];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Campaign: ${campaign.name}`);
    console.log(`   Workspace: ${workspaceName}`);
    console.log(`   Campaign ID: ${campaign.id}`);
    console.log(`   Updated: ${new Date(campaign.updated_at).toLocaleString()}`);
    console.log(`   Recently Contacted: ${campaignProspects.length} prospects\n`);

    if (campaignProspects.length > 0) {
      console.log('   Recent Activity:');
      console.log('   ─────────────────────────────────────');

      for (const p of campaignProspects.slice(0, 5)) {
        const name = `${p.first_name} ${p.last_name}`;
        const contactedTime = new Date(p.contacted_at).toLocaleString();
        const messageId = p.personalization_data?.unipile_message_id;
        const hasMessageId = messageId && !messageId.startsWith('untracked_');

        console.log(`   ${hasMessageId ? '✅' : '⚠️'} ${name} (${p.company_name || 'Unknown'})`);
        console.log(`      Status: ${p.status}`);
        console.log(`      Contacted: ${contactedTime}`);
        if (messageId) {
          console.log(`      Message ID: ${messageId.substring(0, 30)}...`);
        }
        console.log('   ─────────────────────────────────────');
      }

      if (campaignProspects.length > 5) {
        console.log(`   ... and ${campaignProspects.length - 5} more\n`);
      }
    } else {
      console.log('   ℹ️  No prospects contacted in last hour for this campaign\n');
    }
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Total campaigns updated: ${campaigns.length}`);
  console.log(`Total prospects contacted: ${recentProspects?.length || 0}`);

  const withMessageIds = recentProspects?.filter(p => {
    const messageId = p.personalization_data?.unipile_message_id;
    return messageId && !messageId.startsWith('untracked_');
  }).length || 0;

  console.log(`Prospects with tracked message IDs: ${withMessageIds}/${recentProspects?.length || 0}\n`);
}

checkRecentCampaigns().catch(console.error);
