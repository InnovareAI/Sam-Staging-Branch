#!/usr/bin/env node

/**
 * Complete LinkedIn Reply Detection Report
 *
 * Full investigation of reply detection system status
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('  LINKEDIN REPLY DETECTION - COMPREHENSIVE DIAGNOSTIC REPORT');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // ===== 1. LinkedIn Account Status =====
  console.log('1️⃣  LINKEDIN ACCOUNT STATUS');
  console.log('─'.repeat(79));

  const { data: linkedinAccounts, error: accountsError } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('platform', 'linkedin')
    .order('created_at', { ascending: false });

  if (accountsError) {
    console.log(`❌ Error: ${accountsError.message}`);
  } else if (!linkedinAccounts || linkedinAccounts.length === 0) {
    console.log('🔴 CRITICAL: NO LinkedIn accounts found in database');
    console.log('   This means reply polling CANNOT work - no accounts to check!');
  } else {
    console.log(`✅ Found ${linkedinAccounts.length} LinkedIn account(s):`);
    linkedinAccounts.forEach((acc, i) => {
      console.log(`\n   Account ${i + 1}:`);
      console.log(`   ├─ Unipile Account ID: ${acc.unipile_account_id}`);
      console.log(`   ├─ Account Name: ${acc.account_name || 'N/A'}`);
      console.log(`   ├─ DB ID (for campaigns): ${acc.id}`);
      console.log(`   ├─ Status: ${acc.connection_status || 'unknown'}`);
      console.log(`   ├─ Workspace ID: ${acc.workspace_id || 'N/A'}`);
      console.log(`   └─ Created: ${new Date(acc.created_at).toLocaleString()}`);
    });
  }
  console.log('');

  // ===== 2. Reply Detection - Last 7 Days =====
  console.log('2️⃣  REPLY DETECTION RESULTS (Last 7 Days)');
  console.log('─'.repeat(79));

  const { data: repliedProspects, error: repliedError } = await supabase
    .from('campaign_prospects')
    .select(`
      id,
      first_name,
      last_name,
      linkedin_user_id,
      status,
      responded_at,
      campaign_id,
      campaigns!inner (
        id,
        name,
        linkedin_account_id
      )
    `)
    .eq('status', 'replied')
    .gte('responded_at', sevenDaysAgo.toISOString())
    .order('responded_at', { ascending: false });

  if (repliedError) {
    console.log(`❌ Error: ${repliedError.message}`);
  } else if (!repliedProspects || repliedProspects.length === 0) {
    console.log('⚠️  No replied prospects found in last 7 days');
    console.log('   Either reply detection is not working OR no one has replied');
  } else {
    console.log(`✅ Detected ${repliedProspects.length} replies in last 7 days:\n`);

    for (const prospect of repliedProspects) {
      const name = [prospect.first_name, prospect.last_name].filter(Boolean).join(' ') || 'N/A';
      const campaign = prospect.campaigns;

      console.log(`   ├─ ${name}`);
      console.log(`   │  ├─ LinkedIn ID: ${prospect.linkedin_user_id}`);
      console.log(`   │  ├─ Replied: ${new Date(prospect.responded_at).toLocaleString()}`);
      console.log(`   │  ├─ Campaign: ${campaign.name}`);
      console.log(`   │  └─ Campaign has linkedin_account_id: ${campaign.linkedin_account_id ? '✅ Yes' : '❌ MISSING'}`);
      console.log('   │');
    }
  }
  console.log('');

  // ===== 3. Reply Agent Drafts - Last 7 Days =====
  console.log('3️⃣  REPLY AGENT DRAFTS GENERATED (Last 7 Days)');
  console.log('─'.repeat(79));

  const { data: replyDrafts, error: draftsError } = await supabase
    .from('reply_agent_drafts')
    .select(`
      id,
      campaign_prospect_id,
      linkedin_account_id,
      status,
      draft_content,
      created_at,
      sent_at
    `)
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  if (draftsError) {
    console.log(`❌ Error: ${draftsError.message}`);
  } else if (!replyDrafts || replyDrafts.length === 0) {
    console.log('⚠️  No reply drafts generated in last 7 days');
    console.log('   This suggests either:');
    console.log('   - Reply detection is working but no drafts approved');
    console.log('   - Reply detection is broken');
  } else {
    console.log(`✅ Generated ${replyDrafts.length} reply draft(s):\n`);

    const statusCounts = replyDrafts.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {});

    console.log(`   Status breakdown:`);
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ├─ ${status}: ${count}`);
    });

    console.log('\n   Recent drafts:');
    replyDrafts.slice(0, 5).forEach((draft, i) => {
      console.log(`   ├─ Draft ${i + 1}: ${draft.status}`);
      console.log(`   │  ├─ Prospect ID: ${draft.campaign_prospect_id || 'N/A'}`);
      console.log(`   │  ├─ Created: ${new Date(draft.created_at).toLocaleString()}`);
      console.log(`   │  └─ Sent: ${draft.sent_at ? new Date(draft.sent_at).toLocaleString() : 'Not yet'}`);
    });
  }
  console.log('');

  // ===== 4. Active Campaigns Configuration =====
  console.log('4️⃣  ACTIVE CAMPAIGN CONFIGURATION');
  console.log('─'.repeat(79));

  const { data: activeCampaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, linkedin_account_id, campaign_type, status, created_at')
    .in('status', ['active', 'paused'])
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (campaignsError) {
    console.log(`❌ Error: ${campaignsError.message}`);
  } else if (!activeCampaigns || activeCampaigns.length === 0) {
    console.log('⚠️  No active campaigns created in last 7 days');
  } else {
    const withLinkedIn = activeCampaigns.filter(c => c.linkedin_account_id);
    const withoutLinkedIn = activeCampaigns.filter(c => !c.linkedin_account_id);

    console.log(`Found ${activeCampaigns.length} active campaign(s):`);
    console.log(`├─ With linkedin_account_id: ${withLinkedIn.length} ✅`);
    console.log(`└─ Missing linkedin_account_id: ${withoutLinkedIn.length} ${withoutLinkedIn.length > 0 ? '❌' : ''}`);

    if (withoutLinkedIn.length > 0) {
      console.log('\n   ⚠️  Campaigns missing linkedin_account_id (reply detection will FAIL):');
      withoutLinkedIn.forEach(c => {
        console.log(`   ├─ ${c.name} (${c.campaign_type || 'linkedin_only'})`);
      });
    }
  }
  console.log('');

  // ===== 5. Poll Function Status Check =====
  console.log('5️⃣  POLL-MESSAGE-REPLIES FUNCTION STATUS');
  console.log('─'.repeat(79));

  // Check if the cron function is configured
  const { data: prospects, error: prospectsError } = await supabase
    .from('campaign_prospects')
    .select(`
      id,
      first_name,
      last_name,
      linkedin_user_id,
      status,
      responded_at,
      campaigns!inner (
        linkedin_account_id
      )
    `)
    .in('status', ['connected', 'connection_request_sent'])
    .is('responded_at', null)
    .not('linkedin_user_id', 'is', null)
    .limit(10);

  if (prospectsError) {
    console.log(`❌ Error checking prospects: ${prospectsError.message}`);
  } else {
    const eligibleCount = prospects?.length || 0;
    console.log(`Prospects eligible for reply polling: ${eligibleCount}`);

    if (eligibleCount > 0) {
      const withAccount = prospects.filter(p => p.campaigns?.linkedin_account_id);
      console.log(`├─ With linkedin_account_id in campaign: ${withAccount.length} ✅`);
      console.log(`└─ Missing linkedin_account_id: ${eligibleCount - withAccount.length} ${eligibleCount - withAccount.length > 0 ? '❌' : ''}`);
    }
  }
  console.log('');

  // ===== 6. DIAGNOSTIC SUMMARY =====
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('  DIAGNOSTIC SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');

  const issues = [];
  const warnings = [];
  const successes = [];

  // Check LinkedIn accounts
  if (!linkedinAccounts || linkedinAccounts.length === 0) {
    issues.push('🔴 CRITICAL: No LinkedIn accounts connected - reply polling CANNOT work');
  } else {
    successes.push(`✅ ${linkedinAccounts.length} LinkedIn account(s) connected`);
  }

  // Check reply detection
  if (repliedProspects && repliedProspects.length > 0) {
    successes.push(`✅ Reply detection IS working - ${repliedProspects.length} replies detected in 7 days`);
  } else {
    warnings.push('⚠️  No replies detected in 7 days - either not working or no actual replies');
  }

  // Check reply drafts
  if (replyDrafts && replyDrafts.length > 0) {
    successes.push(`✅ Reply agent IS generating drafts - ${replyDrafts.length} drafts in 7 days`);
  } else {
    warnings.push('⚠️  No reply drafts generated in 7 days');
  }

  // Check campaign configuration
  if (activeCampaigns && activeCampaigns.length > 0) {
    const missing = activeCampaigns.filter(c => !c.linkedin_account_id).length;
    if (missing > 0) {
      issues.push(`🔴 ${missing} active campaign(s) missing linkedin_account_id`);
    }
  }

  // Print results
  if (successes.length > 0) {
    console.log('✅ WORKING:');
    successes.forEach(s => console.log(`   ${s}`));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    warnings.forEach(w => console.log(`   ${w}`));
    console.log('');
  }

  if (issues.length > 0) {
    console.log('🔴 CRITICAL ISSUES:');
    issues.forEach(i => console.log(`   ${i}`));
    console.log('');
  }

  if (issues.length === 0 && warnings.length === 0) {
    console.log('🎉 ALL SYSTEMS OPERATIONAL');
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('  NEXT STEPS');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');

  if (!linkedinAccounts || linkedinAccounts.length === 0) {
    console.log('1. Connect a LinkedIn account via Unipile integration');
    console.log('2. Ensure campaigns have linkedin_account_id set');
  } else if (repliedProspects && repliedProspects.length > 0) {
    console.log('✅ Reply detection is WORKING!');
    console.log('   - Check the UI to see if drafts are showing up');
    console.log('   - Verify the reply agent is generating quality responses');
  } else {
    console.log('1. Wait for prospects to reply (may take time)');
    console.log('2. Check Unipile API status');
    console.log('3. Verify cron job is running: /api/cron/poll-message-replies');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
