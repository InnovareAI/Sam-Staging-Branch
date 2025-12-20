#!/usr/bin/env node

/**
 * LinkedIn Reply Detection Diagnostic Script
 *
 * Investigates why LinkedIn replies from campaigns aren't being detected
 * Queries production database for:
 * - Recent reply_agent_drafts (last 7 days)
 * - Recent campaign_prospects with replies (last 7 days)
 * - LinkedIn account connections
 * - Campaign configuration issues
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('🔍 LinkedIn Reply Detection Diagnostic Report');
  console.log('='.repeat(80));
  console.log('');

  // Calculate date range (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString();

  console.log(`📅 Checking data from: ${sevenDaysAgo.toLocaleString()}`);
  console.log('');

  // 1. Check LinkedIn account connections
  console.log('🔗 1. LINKEDIN ACCOUNT CONNECTIONS');
  console.log('-'.repeat(80));

  const { data: linkedinAccounts, error: accountsError } = await supabase
    .from('user_unipile_accounts')
    .select('id, user_id, unipile_account_id, account_name, platform, connection_status, created_at')
    .eq('platform', 'linkedin')
    .order('created_at', { ascending: false });

  if (accountsError) {
    console.error('❌ Error fetching LinkedIn accounts:', accountsError);
  } else if (!linkedinAccounts || linkedinAccounts.length === 0) {
    console.log('⚠️  NO LINKEDIN ACCOUNTS FOUND');
  } else {
    console.log(`✅ Found ${linkedinAccounts.length} LinkedIn account(s):\n`);
    linkedinAccounts.forEach((acc, i) => {
      console.log(`   ${i + 1}. Unipile Account ID: ${acc.unipile_account_id}`);
      console.log(`      Account Name: ${acc.account_name || 'N/A'}`);
      console.log(`      Connection Status: ${acc.connection_status}`);
      console.log(`      DB ID: ${acc.id}`);
      console.log(`      User ID: ${acc.user_id}`);
      console.log(`      Created: ${new Date(acc.created_at).toLocaleString()}`);
      console.log('');
    });
  }

  // 2. Check recent reply_agent_drafts
  console.log('📝 2. RECENT REPLY AGENT DRAFTS (Last 7 Days)');
  console.log('-'.repeat(80));

  const { data: replyDrafts, error: draftsError } = await supabase
    .from('reply_agent_drafts')
    .select('*')
    .gte('created_at', sevenDaysAgoStr)
    .order('created_at', { ascending: false });

  if (draftsError) {
    console.error('❌ Error fetching reply drafts:', draftsError);
  } else if (!replyDrafts || replyDrafts.length === 0) {
    console.log('⚠️  NO REPLY DRAFTS FOUND in last 7 days');
    console.log('   This suggests reply detection is NOT working.');
  } else {
    console.log(`✅ Found ${replyDrafts.length} reply draft(s):\n`);
    replyDrafts.forEach((draft, i) => {
      console.log(`   ${i + 1}. Draft ID: ${draft.id}`);
      console.log(`      Campaign Prospect ID: ${draft.campaign_prospect_id}`);
      console.log(`      LinkedIn Account ID: ${draft.linkedin_account_id || 'N/A'}`);
      console.log(`      Status: ${draft.status}`);
      console.log(`      Created: ${new Date(draft.created_at).toLocaleString()}`);
      console.log(`      Draft Content: ${draft.draft_content?.substring(0, 100) || 'N/A'}...`);
      console.log('');
    });
  }

  // 3. Check campaign_prospects with replied status
  console.log('💬 3. CAMPAIGN PROSPECTS WITH REPLIES (Last 7 Days)');
  console.log('-'.repeat(80));

  const { data: repliedProspects, error: prospectsError } = await supabase
    .from('campaign_prospects')
    .select('id, campaign_id, linkedin_user_id, first_name, last_name, status, responded_at, created_at')
    .or(`status.eq.replied,responded_at.not.is.null`)
    .gte('created_at', sevenDaysAgoStr)
    .order('responded_at', { ascending: false });

  if (prospectsError) {
    console.error('❌ Error fetching replied prospects:', prospectsError);
  } else if (!repliedProspects || repliedProspects.length === 0) {
    console.log('⚠️  NO PROSPECTS WITH REPLIES FOUND in last 7 days');
  } else {
    console.log(`✅ Found ${repliedProspects.length} prospect(s) with replies:\n`);
    repliedProspects.forEach((prospect, i) => {
      const name = [prospect.first_name, prospect.last_name].filter(Boolean).join(' ') || 'N/A';
      console.log(`   ${i + 1}. Prospect: ${name}`);
      console.log(`      ID: ${prospect.id}`);
      console.log(`      Campaign ID: ${prospect.campaign_id}`);
      console.log(`      LinkedIn User ID: ${prospect.linkedin_user_id || 'N/A'}`);
      console.log(`      Status: ${prospect.status}`);
      console.log(`      Responded At: ${prospect.responded_at ? new Date(prospect.responded_at).toLocaleString() : 'N/A'}`);
      console.log('');
    });
  }

  // 4. Check campaigns from last night with LinkedIn account IDs
  console.log('🎯 4. RECENT CAMPAIGNS CONFIGURATION');
  console.log('-'.repeat(80));

  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, linkedin_account_id, campaign_type, status, created_at')
    .gte('created_at', sevenDaysAgoStr)
    .order('created_at', { ascending: false });

  if (campaignsError) {
    console.error('❌ Error fetching campaigns:', campaignsError);
  } else if (!campaigns || campaigns.length === 0) {
    console.log('⚠️  NO CAMPAIGNS CREATED in last 7 days');
  } else {
    console.log(`✅ Found ${campaigns.length} campaign(s):\n`);
    for (const campaign of campaigns) {
      console.log(`   Campaign: ${campaign.name}`);
      console.log(`   ID: ${campaign.id}`);
      console.log(`   LinkedIn Account ID: ${campaign.linkedin_account_id || '❌ MISSING'}`);
      console.log(`   Type: ${campaign.campaign_type || 'linkedin_only'}`);
      console.log(`   Status: ${campaign.status}`);
      console.log(`   Created: ${new Date(campaign.created_at).toLocaleString()}`);

      // Check prospects for this campaign
      const { data: campaignProspects, error: cpError } = await supabase
        .from('campaign_prospects')
        .select('id, linkedin_user_id, status')
        .eq('campaign_id', campaign.id)
        .limit(5);

      if (!cpError && campaignProspects && campaignProspects.length > 0) {
        console.log(`   Prospects: ${campaignProspects.length} total`);
        const withLinkedInId = campaignProspects.filter(p => p.linkedin_user_id).length;
        const withoutLinkedInId = campaignProspects.length - withLinkedInId;
        console.log(`   - With LinkedIn User ID: ${withLinkedInId}`);
        if (withoutLinkedInId > 0) {
          console.log(`   - ❌ Missing LinkedIn User ID: ${withoutLinkedInId}`);
        }
      }
      console.log('');
    }
  }

  // 5. Check send_queue for recent messages
  console.log('📬 5. RECENT SEND QUEUE MESSAGES (Last 7 Days)');
  console.log('-'.repeat(80));

  const { data: queueMessages, error: queueError } = await supabase
    .from('send_queue')
    .select('id, prospect_id, campaign_id, status, message_type, created_at, sent_at')
    .gte('created_at', sevenDaysAgoStr)
    .order('created_at', { ascending: false })
    .limit(10);

  if (queueError) {
    console.error('❌ Error fetching send queue:', queueError);
  } else if (!queueMessages || queueMessages.length === 0) {
    console.log('⚠️  NO MESSAGES IN SEND QUEUE from last 7 days');
  } else {
    console.log(`✅ Found ${queueMessages.length} recent message(s) (showing up to 10):\n`);
    queueMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. Queue ID: ${msg.id}`);
      console.log(`      Prospect ID: ${msg.prospect_id}`);
      console.log(`      Campaign ID: ${msg.campaign_id}`);
      console.log(`      Message Type: ${msg.message_type}`);
      console.log(`      Status: ${msg.status}`);
      console.log(`      Created: ${new Date(msg.created_at).toLocaleString()}`);
      console.log(`      Sent: ${msg.sent_at ? new Date(msg.sent_at).toLocaleString() : 'Not sent'}`);
      console.log('');
    });
  }

  // 6. Summary and diagnostics
  console.log('🔎 6. DIAGNOSTIC SUMMARY');
  console.log('-'.repeat(80));

  const issues = [];

  if (!linkedinAccounts || linkedinAccounts.length === 0) {
    issues.push('❌ NO LinkedIn accounts connected');
  }

  if (!replyDrafts || replyDrafts.length === 0) {
    issues.push('❌ NO reply drafts generated (reply detection not working)');
  }

  if (campaigns && campaigns.length > 0) {
    const missingAccountId = campaigns.filter(c => !c.linkedin_account_id);
    if (missingAccountId.length > 0) {
      issues.push(`❌ ${missingAccountId.length} campaign(s) missing linkedin_account_id`);
    }
  }

  if (issues.length > 0) {
    console.log('⚠️  ISSUES FOUND:\n');
    issues.forEach(issue => console.log(`   ${issue}`));
  } else {
    console.log('✅ No obvious configuration issues found');
  }

  console.log('');
  console.log('💡 NEXT STEPS:');
  console.log('   1. Check Netlify function logs: netlify functions:log poll-message-replies');
  console.log('   2. Verify Unipile API is working: Check Unipile dashboard');
  console.log('   3. Test reply detection manually with a known replied message');
  console.log('');
}

main()
  .then(() => {
    console.log('✅ Diagnostic complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
