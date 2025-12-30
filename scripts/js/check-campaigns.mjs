#!/usr/bin/env node
/**
 * Quick campaign status check
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaigns() {
  console.log('🔍 Checking LinkedIn Campaign Status...\n');

  // Get active campaigns
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, status, workspace_id, created_at, campaign_type')
    .in('status', ['active', 'running', 'paused'])
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Error fetching campaigns:', error.message);
    return;
  }

  console.log('=== ACTIVE/RUNNING/PAUSED CAMPAIGNS ===');
  if (campaigns.length === 0) {
    console.log('   No active campaigns found');
  } else {
    campaigns.forEach(c => {
      console.log(`   • ${c.name || 'Unnamed'} (${c.status}) - ${c.campaign_type || 'linkedin'}`);
    });
  }

  // Check send_queue status
  const { data: queueStats, error: queueError } = await supabase
    .from('send_queue')
    .select('status');

  if (!queueError && queueStats) {
    const stats = queueStats.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    console.log('\n=== SEND QUEUE STATUS ===');
    Object.entries(stats).forEach(([status, count]) => {
      console.log(`   • ${status}: ${count}`);
    });
    console.log(`   Total: ${queueStats.length}`);
  }

  // Check recent sends (last 24h)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentSends, error: sendError } = await supabase
    .from('send_queue')
    .select('status, scheduled_for, sent_at')
    .gte('created_at', yesterday)
    .order('created_at', { ascending: false });

  if (!sendError && recentSends) {
    const sentCount = recentSends.filter(s => s.status === 'sent').length;
    const pendingCount = recentSends.filter(s => s.status === 'pending').length;
    const failedCount = recentSends.filter(s => s.status === 'failed').length;

    console.log('\n=== LAST 24 HOURS ===');
    console.log(`   • Sent: ${sentCount}`);
    console.log(`   • Pending: ${pendingCount}`);
    console.log(`   • Failed: ${failedCount}`);
  }

  // Check campaign_prospects status
  const { data: prospectStats, error: prospectError } = await supabase
    .from('campaign_prospects')
    .select('status');

  if (!prospectError && prospectStats) {
    const stats = prospectStats.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    console.log('\n=== CAMPAIGN PROSPECTS STATUS ===');
    Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`   • ${status}: ${count}`);
    });
    console.log(`   Total: ${prospectStats.length}`);
  }

  // Check for stuck items (scheduled_for in the past but still pending)
  const now = new Date().toISOString();
  const { data: stuckItems, error: stuckError } = await supabase
    .from('send_queue')
    .select('id, scheduled_for, status')
    .eq('status', 'pending')
    .lt('scheduled_for', now);

  if (!stuckError && stuckItems && stuckItems.length > 0) {
    console.log('\n⚠️  STUCK ITEMS (past due but still pending):');
    console.log(`   ${stuckItems.length} items need attention`);
  } else {
    console.log('\n✅ No stuck queue items');
  }

  console.log('\n' + '='.repeat(50));

  // Check Sebastian's campaign specifically
  const { data: sebastian } = await supabase
    .from('campaigns')
    .select('id, name, linkedin_account_id, timezone, country_code')
    .ilike('name', '%sebastian%')
    .single();

  if (sebastian) {
    console.log('\n=== SEBASTIAN CAMPAIGN ===');
    console.log(`   Name: ${sebastian.name}`);
    console.log(`   Timezone: ${sebastian.timezone}`);
    console.log(`   Country: ${sebastian.country_code}`);
    console.log(`   LinkedIn Account: ${sebastian.linkedin_account_id}`);

    // Check queue for this campaign
    const { data: queue } = await supabase
      .from('send_queue')
      .select('id, status, scheduled_for')
      .eq('campaign_id', sebastian.id)
      .order('scheduled_for', { ascending: true })
      .limit(5);

    if (queue && queue.length > 0) {
      console.log(`   Queue items: ${queue.length}`);
      queue.forEach(q => console.log(`     - ${q.status}: ${q.scheduled_for}`));
    } else {
      console.log('   Queue items: 0');
    }

    // Check prospects
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('status')
      .eq('campaign_id', sebastian.id);

    if (prospects) {
      const stats = prospects.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {});
      console.log('   Prospects:');
      Object.entries(stats).forEach(([s, c]) => console.log(`     - ${s}: ${c}`));
    }
  }
}

checkCampaigns().catch(console.error);

// Queue prospects for Sebastian
async function queueForSebastian() {
  console.log('\n=== QUEUING PROSPECTS FOR SEBASTIAN ===');

  // Get Sebastian's campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, linkedin_account_id, workspace_id, connection_message')
    .ilike('name', '%sebastian%')
    .single();

  if (!campaign) {
    console.log('Campaign not found');
    return;
  }

  console.log('Campaign:', campaign.name);

  // Get approved prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, linkedin_profile_url, first_name, last_name')
    .eq('campaign_id', campaign.id)
    .eq('status', 'approved')
    .limit(10);

  console.log('Approved prospects:', prospects?.length || 0);

  if (!prospects || prospects.length === 0) {
    console.log('No approved prospects to queue');
    return;
  }

  // Check which are already in send_queue
  const prospectIds = prospects.map(p => p.id);
  const { data: existing } = await supabase
    .from('send_queue')
    .select('prospect_id')
    .in('prospect_id', prospectIds)
    .in('status', ['pending', 'sent']);

  const existingIds = new Set((existing || []).map(e => e.prospect_id));
  const toQueue = prospects.filter(p => existingIds.has(p.id) === false);

  console.log('Already queued:', existingIds.size);
  console.log('To queue:', toQueue.length);

  if (toQueue.length > 0) {
    const now = new Date();
    const queueItems = toQueue.map((p, i) => ({
      campaign_id: campaign.id,
      prospect_id: p.id,
      workspace_id: campaign.workspace_id,
      linkedin_account_id: campaign.linkedin_account_id,
      linkedin_profile_url: p.linkedin_profile_url,
      message: campaign.connection_message,
      status: 'pending',
      scheduled_for: new Date(now.getTime() + (i * 30 * 60 * 1000)).toISOString(),
      created_at: now.toISOString()
    }));

    const { error } = await supabase
      .from('send_queue')
      .insert(queueItems);

    if (error) {
      console.log('Error queuing:', error.message);
    } else {
      console.log('✅ Queued', toQueue.length, 'prospects');
      queueItems.forEach(q => console.log('  Scheduled:', q.scheduled_for));
    }
  }
}

// Run if --queue-sebastian flag is passed
if (process.argv.includes('--queue-sebastian')) {
  queueForSebastian().catch(console.error);
}
