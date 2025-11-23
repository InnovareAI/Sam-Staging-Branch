#!/usr/bin/env node

/**
 * Detailed report of all CRs from Irish's account
 * Including campaign details and full prospect info
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getDetailedReport() {
  const IRISH_UNIPILE_ID = 'ymtTx4xVQ6OVUFk83ctwtA';

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║        IRISH MAGUAD - CONNECTION REQUESTS REPORT         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // 1. Get Irish's account
  const { data: account } = await supabase
    .from('workspace_accounts')
    .select('id, account_name, unipile_account_id, connection_status')
    .eq('unipile_account_id', IRISH_UNIPILE_ID)
    .single();

  if (!account) {
    console.log('❌ Account not found');
    return;
  }

  console.log('📋 ACCOUNT INFORMATION');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`   Name: ${account.account_name}`);
  console.log(`   Unipile ID: ${account.unipile_account_id}`);
  console.log(`   Status: ${account.connection_status}`);
  console.log('');

  // 2. Get all campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('linkedin_account_id', account.id)
    .order('created_at', { ascending: false });

  console.log('📊 CAMPAIGNS OVERVIEW');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`   Total Campaigns: ${campaigns?.length || 0}\n`);

  if (campaigns && campaigns.length > 0) {
    const statusGroups = campaigns.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {});

    console.log('   By Status:');
    Object.entries(statusGroups).forEach(([status, count]) => {
      console.log(`     ${status}: ${count}`);
    });
    console.log('');

    console.log('   Campaign Details:');
    console.log('   ─────────────────────────────────────────────────────────');
    for (const c of campaigns) {
      console.log(`   ${c.status.toUpperCase().padEnd(10)} | ${c.campaign_name || '(unnamed)'}`);
      console.log(`              Created: ${new Date(c.created_at).toLocaleString()}`);
      console.log(`              ID: ${c.id}`);

      // Get prospect count for this campaign
      const { count } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', c.id);

      const { count: sentCount } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', c.id)
        .in('status', ['connection_request_sent', 'connected', 'messaging', 'replied']);

      console.log(`              Prospects: ${count || 0} total, ${sentCount || 0} contacted`);
      console.log('');
    }
  }

  // 3. Get ALL prospects contacted (regardless of campaign)
  const campaignIds = campaigns?.map(c => c.id) || [];

  if (campaignIds.length > 0) {
    const { data: allProspects } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        first_name,
        last_name,
        linkedin_url,
        status,
        contacted_at,
        campaign_id,
        title,
        company_name
      `)
      .in('campaign_id', campaignIds)
      .in('status', ['connection_request_sent', 'connected', 'messaging', 'replied'])
      .order('contacted_at', { ascending: false });

    console.log('═════════════════════════════════════════════════════════════');
    console.log(`📬 ALL CONNECTION REQUESTS SENT: ${allProspects?.length || 0}`);
    console.log('═════════════════════════════════════════════════════════════\n');

    if (allProspects && allProspects.length > 0) {
      // Group by date
      const byDate = {};
      allProspects.forEach(p => {
        const date = p.contacted_at ? new Date(p.contacted_at).toLocaleDateString() : 'Unknown';
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(p);
      });

      // Show each date group
      for (const [date, prospects] of Object.entries(byDate)) {
        console.log(`📅 ${date} (${prospects.length} CRs)`);
        console.log('─────────────────────────────────────────────────────────────');

        prospects.forEach((p, i) => {
          const time = p.contacted_at ? new Date(p.contacted_at).toLocaleTimeString() : 'N/A';
          console.log(`${i + 1}. ${p.first_name} ${p.last_name} (${p.status})`);
          console.log(`   ${p.title || 'No title'} @ ${p.company_name || 'No company'}`);
          console.log(`   Sent at: ${time}`);
          console.log(`   LinkedIn: ${p.linkedin_url}`);
          console.log('');
        });
      }

      // Summary stats
      console.log('═════════════════════════════════════════════════════════════');
      console.log('📊 SUMMARY STATISTICS');
      console.log('═════════════════════════════════════════════════════════════\n');

      const statusBreakdown = allProspects.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {});

      console.log('Status Breakdown:');
      Object.entries(statusBreakdown).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
      console.log('');

      // Date range
      const dates = allProspects
        .filter(p => p.contacted_at)
        .map(p => new Date(p.contacted_at))
        .sort((a, b) => a - b);

      if (dates.length > 0) {
        console.log('Date Range:');
        console.log(`   First CR: ${dates[0].toLocaleString()}`);
        console.log(`   Last CR:  ${dates[dates.length - 1].toLocaleString()}`);
        console.log('');
      }
    }

    // 4. Check send queue
    console.log('═════════════════════════════════════════════════════════════');
    console.log('📋 SEND QUEUE STATUS');
    console.log('═════════════════════════════════════════════════════════════\n');

    const { data: queue } = await supabase
      .from('send_queue')
      .select('*')
      .in('campaign_id', campaignIds)
      .order('scheduled_for', { ascending: true });

    if (queue && queue.length > 0) {
      const queueByStatus = queue.reduce((acc, q) => {
        acc[q.status] = (acc[q.status] || 0) + 1;
        return acc;
      }, {});

      console.log('Queue Status:');
      Object.entries(queueByStatus).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
      console.log('');

      // Show pending items
      const pending = queue.filter(q => q.status === 'pending');
      if (pending.length > 0) {
        console.log(`⏳ Pending Messages (${pending.length}):`);
        pending.slice(0, 5).forEach((q, i) => {
          console.log(`   ${i + 1}. Scheduled: ${new Date(q.scheduled_for).toLocaleString()}`);
        });
        if (pending.length > 5) {
          console.log(`   ... and ${pending.length - 5} more`);
        }
        console.log('');
      }

      // Show recent failures
      const failed = queue.filter(q => q.status === 'failed');
      if (failed.length > 0) {
        console.log(`❌ Failed Messages (${failed.length}):`);
        failed.forEach((q, i) => {
          console.log(`   ${i + 1}. Error: ${q.error_message || 'Unknown'}`);
          console.log(`      Scheduled: ${new Date(q.scheduled_for).toLocaleString()}`);
        });
        console.log('');
      }
    } else {
      console.log('   No queue items found\n');
    }
  }

  console.log('═════════════════════════════════════════════════════════════');
  console.log('✅ Report Complete');
  console.log('═════════════════════════════════════════════════════════════');
}

getDetailedReport().catch(console.error);
