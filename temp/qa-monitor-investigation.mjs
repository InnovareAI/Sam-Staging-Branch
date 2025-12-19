#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔍 QA MONITOR INVESTIGATION\n');
console.log('='.repeat(80));

// Issue 1: High error rates for specific accounts
async function investigateHighErrorRates() {
  console.log('\n📊 ISSUE 1: HIGH ERROR RATES (27-33%)\n');

  const problematicAccounts = [
    { name: 'Rony Chatterjee', rate: '33.3%' },
    { name: 'Thorsten Linz', rate: '29%' },
    { name: 'Samantha Truman', rate: '27.6%' }
  ];

  for (const account of problematicAccounts) {
    console.log(`\n--- ${account.name} (${account.rate} error rate) ---`);

    // Find the account
    const { data: accounts } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .ilike('display_name', `%${account.name}%`)
      .limit(1);

    if (!accounts || accounts.length === 0) {
      console.log(`❌ Account not found: ${account.name}`);
      continue;
    }

    const linkedinAccountId = accounts[0].id;
    console.log(`✓ Found account ID: ${linkedinAccountId}`);

    // Get recent failed sends
    const { data: failedSends } = await supabase
      .from('send_queue')
      .select('*')
      .eq('linkedin_account_id', linkedinAccountId)
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(20);

    console.log(`\nFailed sends: ${failedSends?.length || 0}`);

    if (failedSends && failedSends.length > 0) {
      // Analyze error patterns
      const errorCounts = {};
      const errorExamples = {};

      failedSends.forEach(send => {
        const errorType = send.error_message?.substring(0, 100) || 'Unknown error';
        errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
        if (!errorExamples[errorType]) {
          errorExamples[errorType] = {
            id: send.id,
            created_at: send.created_at,
            full_error: send.error_message
          };
        }
      });

      console.log('\nError patterns:');
      Object.entries(errorCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([error, count]) => {
          console.log(`  • ${count}x: ${error}`);
          console.log(`    Example: Queue ID ${errorExamples[error].id}`);
          console.log(`    Full error: ${errorExamples[error].full_error}`);
        });
    }

    // Get total stats
    const { data: totalStats } = await supabase
      .from('send_queue')
      .select('status')
      .eq('linkedin_account_id', linkedinAccountId);

    if (totalStats) {
      const statusCounts = {};
      totalStats.forEach(s => {
        statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
      });
      console.log('\nTotal stats:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        const pct = ((count / totalStats.length) * 100).toFixed(1);
        console.log(`  ${status}: ${count} (${pct}%)`);
      });
    }
  }
}

// Issue 2: Prospects waiting >3 days
async function investigateWaitingProspects() {
  console.log('\n\n📅 ISSUE 2: PROSPECTS WAITING >3 DAYS\n');

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  // Find prospects in Tursio.ai campaign
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, campaign_name')
    .ilike('campaign_name', '%Tursio%')
    .ilike('campaign_name', '%Credit Union%');

  if (!campaigns || campaigns.length === 0) {
    console.log('❌ Tursio.ai Credit Union campaign not found');
    return;
  }

  console.log(`Found campaigns: ${campaigns.map(c => c.campaign_name).join(', ')}`);

  for (const campaign of campaigns) {
    console.log(`\n--- ${campaign.campaign_name} (ID: ${campaign.id}) ---`);

    // Find prospects waiting for approval
    const { data: waitingProspects } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaign.id)
      .eq('linkedin_status', 'pending_approval')
      .lt('created_at', threeDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    console.log(`Waiting >3 days: ${waitingProspects?.length || 0}`);

    if (waitingProspects && waitingProspects.length > 0) {
      waitingProspects.forEach(p => {
        const daysWaiting = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`\n  Prospect: ${p.first_name} ${p.last_name}`);
        console.log(`  LinkedIn: ${p.linkedin_url}`);
        console.log(`  Status: ${p.linkedin_status}`);
        console.log(`  Waiting: ${daysWaiting} days`);
        console.log(`  Created: ${p.created_at}`);
        console.log(`  Prospect ID: ${p.id}`);
      });
    }
  }
}

// Issue 3: Queue-prospect status inconsistencies
async function investigateStatusInconsistencies() {
  console.log('\n\n🔄 ISSUE 3: QUEUE-PROSPECT STATUS INCONSISTENCIES\n');

  // Find queue items marked as 'sent' with corresponding prospects not marked as 'sent'
  const { data: sentQueue } = await supabase
    .from('send_queue')
    .select('id, prospect_id, status, sent_at, created_at')
    .eq('status', 'sent')
    .not('prospect_id', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(100);

  console.log(`Checking ${sentQueue?.length || 0} recent 'sent' queue items...`);

  if (sentQueue && sentQueue.length > 0) {
    const inconsistencies = [];

    for (const queueItem of sentQueue) {
      const { data: prospect } = await supabase
        .from('campaign_prospects')
        .select('id, first_name, last_name, linkedin_status, connection_status')
        .eq('id', queueItem.prospect_id)
        .single();

      if (prospect) {
        // Check if prospect status doesn't match queue status
        if (prospect.linkedin_status !== 'sent' &&
            prospect.linkedin_status !== 'connection_sent' &&
            prospect.connection_status !== 'pending') {
          inconsistencies.push({
            queueId: queueItem.id,
            prospectId: prospect.id,
            prospectName: `${prospect.first_name} ${prospect.last_name}`,
            queueStatus: queueItem.status,
            prospectLinkedinStatus: prospect.linkedin_status,
            prospectConnectionStatus: prospect.connection_status,
            sentAt: queueItem.sent_at
          });
        }
      }
    }

    console.log(`\nFound ${inconsistencies.length} inconsistencies:`);
    inconsistencies.forEach(inc => {
      console.log(`\n  Queue ID: ${inc.queueId}`);
      console.log(`  Prospect: ${inc.prospectName} (ID: ${inc.prospectId})`);
      console.log(`  Queue status: ${inc.queueStatus}`);
      console.log(`  Prospect linkedin_status: ${inc.prospectLinkedinStatus}`);
      console.log(`  Prospect connection_status: ${inc.prospectConnectionStatus}`);
      console.log(`  Sent at: ${inc.sentAt}`);
    });

    if (inconsistencies.length > 0) {
      return inconsistencies;
    }
  }

  return [];
}

// Issue 4: Vanity slug resolution
async function investigateVanitySlugs() {
  console.log('\n\n🔗 ISSUE 4: VANITY SLUG RESOLUTION\n');

  // Count vanity URLs in queue
  const { data: vanitySlugs } = await supabase
    .from('send_queue')
    .select('id, recipient_profile_id, status')
    .like('recipient_profile_id', '%/in/%')
    .in('status', ['pending', 'scheduled']);

  console.log(`Vanity slugs in queue (pending/scheduled): ${vanitySlugs?.length || 0}`);

  if (vanitySlugs && vanitySlugs.length > 0) {
    // Sample a few
    console.log('\nSample vanity slugs:');
    vanitySlugs.slice(0, 5).forEach(item => {
      console.log(`  Queue ID ${item.id}: ${item.recipient_profile_id} (${item.status})`);
    });

    // Check if there's a resolution mechanism
    console.log('\n📝 Note: Vanity slugs should be resolved to numeric IDs at send time.');
    console.log('This is NORMAL and expected behavior.');
    console.log('The queue processor should handle resolution when sending.');
  }
}

// Issue 5: Campaign failures
async function investigateCampaignFailures() {
  console.log('\n\n❌ ISSUE 5: CAMPAIGN FAILURES (Irish\'s IA-Canada-Startup)\n');

  // Find Irish's campaigns
  const { data: irishAccount } = await supabase
    .from('user_unipile_accounts')
    .select('id, display_name')
    .ilike('display_name', '%Irish%')
    .limit(1);

  if (!irishAccount || irishAccount.length === 0) {
    console.log('❌ Irish\'s account not found');
    return;
  }

  console.log(`Found account: ${irishAccount[0].display_name} (ID: ${irishAccount[0].id})`);

  // Find IA-Canada-Startup campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, campaign_name, linkedin_account_id, status')
    .eq('linkedin_account_id', irishAccount[0].id)
    .ilike('campaign_name', '%IA-Canada-Startup%');

  console.log(`\nFound campaigns: ${campaigns?.length || 0}`);

  if (campaigns && campaigns.length > 0) {
    for (const campaign of campaigns) {
      console.log(`\n--- ${campaign.campaign_name} (ID: ${campaign.id}) ---`);
      console.log(`Campaign status: ${campaign.status}`);

      // Get failed queue items for this campaign
      const { data: failures } = await supabase
        .from('send_queue')
        .select('id, error_message, created_at, status')
        .eq('campaign_id', campaign.id)
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(20);

      console.log(`Failed sends: ${failures?.length || 0}`);

      if (failures && failures.length > 0) {
        // Analyze error patterns
        const errorCounts = {};

        failures.forEach(f => {
          const errorType = f.error_message?.substring(0, 150) || 'Unknown error';
          errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
        });

        console.log('\nError patterns:');
        Object.entries(errorCounts)
          .sort((a, b) => b[1] - a[1])
          .forEach(([error, count]) => {
            console.log(`  • ${count}x: ${error}`);
          });
      }

      // Get total stats for this campaign
      const { data: totalStats } = await supabase
        .from('send_queue')
        .select('status')
        .eq('campaign_id', campaign.id);

      if (totalStats) {
        const statusCounts = {};
        totalStats.forEach(s => {
          statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
        });
        console.log('\nCampaign queue stats:');
        Object.entries(statusCounts).forEach(([status, count]) => {
          const pct = ((count / totalStats.length) * 100).toFixed(1);
          console.log(`  ${status}: ${count} (${pct}%)`);
        });
      }
    }
  }
}

// Main execution
async function main() {
  try {
    await investigateHighErrorRates();
    await investigateWaitingProspects();
    const inconsistencies = await investigateStatusInconsistencies();
    await investigateVanitySlugs();
    await investigateCampaignFailures();

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Investigation complete!\n');

    // Return inconsistencies for fixing
    if (inconsistencies && inconsistencies.length > 0) {
      console.log('🔧 STATUS INCONSISTENCIES TO FIX:');
      console.log(JSON.stringify(inconsistencies, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
