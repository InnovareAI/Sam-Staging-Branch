#!/usr/bin/env node

/**
 * Check all Connection Requests sent from Irish's LinkedIn account
 *
 * This script queries:
 * 1. Irish's workspace_accounts record
 * 2. All campaigns using Irish's account
 * 3. All prospects with status 'connection_request_sent' or 'connected'
 * 4. Send queue history for Irish's campaigns
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkIrishAccount() {
  console.log('🔍 Looking up Irish\'s LinkedIn account...\n');

  // 1. Find Irish's workspace account using known Unipile Account ID from CLAUDE.md
  const IRISH_UNIPILE_ID = 'ymtTx4xVQ6OVUFk83ctwtA';

  const { data: accounts, error: accountError } = await supabase
    .from('workspace_accounts')
    .select('*')
    .or(`account_name.ilike.%irish%,unipile_account_id.eq.${IRISH_UNIPILE_ID}`)
    .eq('account_type', 'linkedin');

  if (accountError) {
    console.error('❌ Error fetching account:', accountError);
    return;
  }

  if (!accounts || accounts.length === 0) {
    console.log('❌ No account found for Irish');
    console.log('   Trying with Unipile ID only...');

    // Try with just the Unipile ID
    const { data: accountById, error: idError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('unipile_account_id', IRISH_UNIPILE_ID)
      .single();

    if (idError || !accountById) {
      console.error('❌ Still not found:', idError);
      return;
    }

    accounts.push(accountById);
  }

  console.log(`✅ Found ${accounts.length} account(s):\n`);

  for (const account of accounts) {
    console.log('📋 Account Details:');
    console.log(`   ID: ${account.id}`);
    console.log(`   Name: ${account.account_name}`);
    console.log(`   Unipile Account ID: ${account.unipile_account_id}`);
    console.log(`   Status: ${account.connection_status}`);
    console.log(`   Created: ${account.created_at}`);
    console.log('');

    // 2. Find all campaigns using this account
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, campaign_name, status, created_at')
      .eq('linkedin_account_id', account.id)
      .order('created_at', { ascending: false });

    if (campaignError) {
      console.error('❌ Error fetching campaigns:', campaignError);
      continue;
    }

    console.log(`📊 Campaigns using this account: ${campaigns?.length || 0}`);
    if (campaigns && campaigns.length > 0) {
      campaigns.forEach(c => {
        console.log(`   - ${c.campaign_name} (${c.status}) - Created: ${new Date(c.created_at).toLocaleDateString()}`);
      });
      console.log('');
    }

    // 3. Get all prospects with CRs sent from these campaigns
    if (campaigns && campaigns.length > 0) {
      const campaignIds = campaigns.map(c => c.id);

      const { data: prospects, error: prospectError } = await supabase
        .from('campaign_prospects')
        .select('id, first_name, last_name, linkedin_url, status, contacted_at, campaign_id, campaigns(campaign_name)')
        .in('campaign_id', campaignIds)
        .in('status', ['connection_request_sent', 'connected', 'messaging', 'replied'])
        .order('contacted_at', { ascending: false });

      if (prospectError) {
        console.error('❌ Error fetching prospects:', prospectError);
      } else {
        console.log(`✅ Total CRs sent: ${prospects?.length || 0}\n`);

        if (prospects && prospects.length > 0) {
          console.log('📝 Recent Connection Requests:\n');
          prospects.slice(0, 20).forEach((p, i) => {
            const campaignName = p.campaigns?.campaign_name || 'Unknown';
            console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
            console.log(`   Status: ${p.status}`);
            console.log(`   Sent: ${p.contacted_at ? new Date(p.contacted_at).toLocaleString() : 'N/A'}`);
            console.log(`   Campaign: ${campaignName}`);
            console.log(`   LinkedIn: ${p.linkedin_url}`);
            console.log('');
          });

          if (prospects.length > 20) {
            console.log(`... and ${prospects.length - 20} more\n`);
          }

          // Group by status
          const statusCounts = prospects.reduce((acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
          }, {});

          console.log('📊 Status Breakdown:');
          Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`   ${status}: ${count}`);
          });
          console.log('');

          // Group by campaign
          const campaignCounts = prospects.reduce((acc, p) => {
            const name = p.campaigns?.campaign_name || 'Unknown';
            acc[name] = (acc[name] || 0) + 1;
            return acc;
          }, {});

          console.log('📊 CRs by Campaign:');
          Object.entries(campaignCounts).forEach(([name, count]) => {
            console.log(`   ${name}: ${count} CRs`);
          });
          console.log('');
        }
      }

      // 4. Check send_queue for this account's campaigns
      const { data: queueItems, error: queueError } = await supabase
        .from('send_queue')
        .select('id, status, scheduled_for, sent_at, campaign_id, campaigns(campaign_name)')
        .in('campaign_id', campaignIds)
        .order('scheduled_for', { ascending: false });

      if (queueError) {
        console.error('❌ Error fetching queue:', queueError);
      } else {
        console.log(`📬 Send Queue Items: ${queueItems?.length || 0}`);

        if (queueItems && queueItems.length > 0) {
          const queueStatusCounts = queueItems.reduce((acc, q) => {
            acc[q.status] = (acc[q.status] || 0) + 1;
            return acc;
          }, {});

          console.log('   Queue Status:');
          Object.entries(queueStatusCounts).forEach(([status, count]) => {
            console.log(`     ${status}: ${count}`);
          });

          // Show most recent queue items
          console.log('\n   Recent Queue Items:');
          queueItems.slice(0, 10).forEach((q, i) => {
            const campaignName = q.campaigns?.campaign_name || 'Unknown';
            console.log(`   ${i + 1}. ${q.status.toUpperCase()} - Scheduled: ${new Date(q.scheduled_for).toLocaleString()}`);
            console.log(`      Campaign: ${campaignName}`);
            if (q.sent_at) {
              console.log(`      Sent: ${new Date(q.sent_at).toLocaleString()}`);
            }
          });
        }
        console.log('');
      }
    }

    console.log('═══════════════════════════════════════════════════\n');
  }
}

checkIrishAccount().catch(console.error);
