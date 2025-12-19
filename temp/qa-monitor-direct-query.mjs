#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔍 DIRECT QA MONITOR QUERY\n');

// Get all LinkedIn accounts with error stats
async function getAccountErrorStats() {
  console.log('📊 LINKEDIN ACCOUNT ERROR RATES\n');

  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('id, display_name, email, unipile_account_id')
    .eq('provider', 'LINKEDIN')
    .order('display_name');

  if (!accounts || accounts.length === 0) {
    console.log('No LinkedIn accounts found');
    return;
  }

  console.log(`Found ${accounts.length} LinkedIn accounts\n`);

  for (const account of accounts) {
    // Get queue stats for this account
    const { data: queueItems } = await supabase
      .from('send_queue')
      .select('status')
      .eq('linkedin_account_id', account.id);

    if (!queueItems || queueItems.length === 0) continue;

    const stats = {};
    queueItems.forEach(item => {
      stats[item.status] = (stats[item.status] || 0) + 1;
    });

    const total = queueItems.length;
    const failed = stats['failed'] || 0;
    const errorRate = (failed / total * 100).toFixed(1);

    // Only show accounts with >20% error rate
    if (parseFloat(errorRate) > 20) {
      console.log(`\n🔴 ${account.display_name || account.email}`);
      console.log(`   ID: ${account.id}`);
      console.log(`   Error rate: ${errorRate}% (${failed}/${total})`);
      console.log(`   Status breakdown:`);
      Object.entries(stats)
        .sort((a, b) => b[1] - a[1])
        .forEach(([status, count]) => {
          const pct = (count / total * 100).toFixed(1);
          console.log(`     ${status}: ${count} (${pct}%)`);
        });

      // Get recent errors
      const { data: recentErrors } = await supabase
        .from('send_queue')
        .select('id, error_message, created_at')
        .eq('linkedin_account_id', account.id)
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentErrors && recentErrors.length > 0) {
        console.log(`   Recent errors:`);
        recentErrors.forEach(err => {
          console.log(`     • ${err.error_message?.substring(0, 100)}...`);
        });
      }
    }
  }
}

// Get campaigns with prospects waiting >3 days
async function getWaitingProspects() {
  console.log('\n\n📅 PROSPECTS WAITING >3 DAYS FOR APPROVAL\n');

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select(`
      id,
      first_name,
      last_name,
      linkedin_url,
      linkedin_status,
      created_at,
      campaign_id,
      campaigns (
        campaign_name
      )
    `)
    .eq('linkedin_status', 'pending_approval')
    .lt('created_at', threeDaysAgo.toISOString())
    .order('created_at', { ascending: true });

  console.log(`Found ${prospects?.length || 0} prospects waiting >3 days\n`);

  if (prospects && prospects.length > 0) {
    prospects.forEach(p => {
      const daysWaiting = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
      console.log(`\n  🕐 ${p.first_name} ${p.last_name}`);
      console.log(`     Campaign: ${p.campaigns?.campaign_name || 'Unknown'}`);
      console.log(`     LinkedIn: ${p.linkedin_url}`);
      console.log(`     Waiting: ${daysWaiting} days (since ${p.created_at})`);
      console.log(`     Prospect ID: ${p.id}`);
    });
  }
}

// Get queue-prospect inconsistencies
async function getStatusInconsistencies() {
  console.log('\n\n🔄 QUEUE-PROSPECT STATUS INCONSISTENCIES\n');

  // Query for sent queue items with mismatched prospect status
  const { data: issues, error } = await supabase.rpc('check_queue_prospect_status_sync');

  if (error) {
    // Function might not exist, do manual check
    console.log('Manual check for inconsistencies...\n');

    const { data: sentQueue } = await supabase
      .from('send_queue')
      .select(`
        id,
        prospect_id,
        status,
        sent_at,
        campaign_prospects (
          id,
          first_name,
          last_name,
          linkedin_status,
          connection_status
        )
      `)
      .eq('status', 'sent')
      .not('prospect_id', 'is', null)
      .limit(200);

    if (sentQueue) {
      const inconsistencies = sentQueue.filter(q => {
        const p = q.campaign_prospects;
        if (!p) return false;

        // Queue is 'sent' but prospect is not marked as sent/connection_sent
        return p.linkedin_status !== 'sent' &&
               p.linkedin_status !== 'connection_sent' &&
               p.connection_status !== 'pending';
      });

      console.log(`Found ${inconsistencies.length} inconsistencies:\n`);

      inconsistencies.forEach(inc => {
        const p = inc.campaign_prospects;
        console.log(`  ⚠️  Queue ID: ${inc.id}`);
        console.log(`     Prospect: ${p.first_name} ${p.last_name} (ID: ${inc.prospect_id})`);
        console.log(`     Queue status: ${inc.status} (sent at ${inc.sent_at})`);
        console.log(`     Prospect linkedin_status: ${p.linkedin_status}`);
        console.log(`     Prospect connection_status: ${p.connection_status}`);
        console.log('');
      });

      return inconsistencies;
    }
  }

  return [];
}

// Get vanity slug stats
async function getVanitySlugStats() {
  console.log('\n\n🔗 VANITY SLUG RESOLUTION STATUS\n');

  // Count total queue items
  const { count: totalCount } = await supabase
    .from('send_queue')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'scheduled']);

  // Count vanity slugs
  const { count: vanityCount } = await supabase
    .from('send_queue')
    .select('id', { count: 'exact', head: true })
    .like('recipient_profile_id', '%/in/%')
    .in('status', ['pending', 'scheduled']);

  console.log(`Total pending/scheduled queue items: ${totalCount || 0}`);
  console.log(`Vanity slugs (contain '/in/'): ${vanityCount || 0}`);

  if (vanityCount && totalCount) {
    const pct = (vanityCount / totalCount * 100).toFixed(1);
    console.log(`Percentage: ${pct}%`);
  }

  // Sample some vanity slugs
  const { data: samples } = await supabase
    .from('send_queue')
    .select('id, recipient_profile_id, status')
    .like('recipient_profile_id', '%/in/%')
    .in('status', ['pending', 'scheduled'])
    .limit(10);

  if (samples && samples.length > 0) {
    console.log('\nSample vanity slugs:');
    samples.forEach(s => {
      console.log(`  Queue ${s.id}: ${s.recipient_profile_id} (${s.status})`);
    });
  }

  console.log('\n📝 Note: Vanity slugs are resolved to numeric IDs at send time.');
  console.log('   This is normal behavior - no action needed unless sends are failing.');
}

// Get campaign failure patterns
async function getCampaignFailures() {
  console.log('\n\n❌ CAMPAIGN FAILURE ANALYSIS\n');

  // Get all campaigns with failed sends
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, campaign_name, linkedin_account_id')
    .not('linkedin_account_id', 'is', null);

  if (!campaigns) {
    console.log('No campaigns found');
    return;
  }

  const campaignStats = [];

  for (const campaign of campaigns) {
    const { data: queueItems } = await supabase
      .from('send_queue')
      .select('status')
      .eq('campaign_id', campaign.id);

    if (!queueItems || queueItems.length === 0) continue;

    const stats = {};
    queueItems.forEach(item => {
      stats[item.status] = (stats[item.status] || 0) + 1;
    });

    const total = queueItems.length;
    const failed = stats['failed'] || 0;
    const errorRate = (failed / total * 100).toFixed(1);

    if (failed > 10 || parseFloat(errorRate) > 25) {
      campaignStats.push({
        id: campaign.id,
        name: campaign.campaign_name,
        linkedin_account_id: campaign.linkedin_account_id,
        total,
        failed,
        errorRate,
        stats
      });
    }
  }

  // Sort by failure count
  campaignStats.sort((a, b) => b.failed - a.failed);

  console.log(`Found ${campaignStats.length} campaigns with high failure rates\n`);

  for (const campaign of campaignStats.slice(0, 10)) {
    console.log(`\n🔴 ${campaign.name}`);
    console.log(`   Campaign ID: ${campaign.id}`);
    console.log(`   LinkedIn Account: ${campaign.linkedin_account_id}`);
    console.log(`   Error rate: ${campaign.errorRate}% (${campaign.failed}/${campaign.total})`);
    console.log(`   Status breakdown:`);
    Object.entries(campaign.stats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        const pct = (count / campaign.total * 100).toFixed(1);
        console.log(`     ${status}: ${count} (${pct}%)`);
      });

    // Get error examples
    const { data: errors } = await supabase
      .from('send_queue')
      .select('error_message')
      .eq('campaign_id', campaign.id)
      .eq('status', 'failed')
      .limit(3);

    if (errors && errors.length > 0) {
      console.log(`   Error examples:`);
      errors.forEach(err => {
        console.log(`     • ${err.error_message?.substring(0, 100)}...`);
      });
    }
  }
}

// Main execution
async function main() {
  try {
    await getAccountErrorStats();
    await getWaitingProspects();
    const inconsistencies = await getStatusInconsistencies();
    await getVanitySlugStats();
    await getCampaignFailures();

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Analysis complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
