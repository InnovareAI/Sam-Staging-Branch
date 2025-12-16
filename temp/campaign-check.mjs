#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 CAMPAIGN STATUS CHECK - ' + new Date().toISOString().split('T')[0]);
console.log('='.repeat(70));

// 1. Campaign status distribution
const { data: allCampaigns } = await supabase
  .from('campaigns')
  .select('status');

const statusDist = {};
allCampaigns?.forEach(c => {
  statusDist[c.status] = (statusDist[c.status] || 0) + 1;
});

console.log('\n📊 CAMPAIGN STATUS DISTRIBUTION:');
Object.entries(statusDist || {}).forEach(([status, count]) => {
  console.log('  ' + status.padEnd(20) + count);
});

// 2. Send queue status
const { data: queueStats } = await supabase
  .from('send_queue')
  .select('status, scheduled_for')
  .order('scheduled_for', { ascending: true });

const queueByStatus = {};
queueStats?.forEach(q => {
  queueByStatus[q.status] = (queueByStatus[q.status] || 0) + 1;
});

console.log('\n📬 SEND QUEUE STATUS:');
if (Object.keys(queueByStatus).length === 0) {
  console.log('  Queue is empty');
} else {
  Object.entries(queueByStatus || {}).forEach(([status, count]) => {
    console.log('  ' + status.padEnd(20) + count);
  });

  const pending = queueStats?.filter(q => q.status === 'pending');
  if (pending?.length > 0) {
    console.log('  Next scheduled:', pending[0].scheduled_for);
    console.log('  Last scheduled:', pending[pending.length - 1].scheduled_for);
  }
}

// 3. Active campaigns with prospects
const { data: activeCampaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, created_at, workspace_id')
  .in('status', ['active', 'running', 'pending'])
  .order('created_at', { ascending: false })
  .limit(15);

console.log('\n🚀 ACTIVE/RUNNING CAMPAIGNS:');
if (!activeCampaigns || activeCampaigns.length === 0) {
  console.log('  No active campaigns');
} else {
  for (const c of activeCampaigns) {
    const { data: prospectCounts, count } = await supabase
      .from('campaign_prospects')
      .select('status', { count: 'exact' })
      .eq('campaign_id', c.id);

    const byStatus = {};
    prospectCounts?.forEach(p => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    });

    console.log('  📋 ' + c.name);
    console.log('     Status: ' + c.status + ' | Total: ' + (count || 0));
    if (Object.keys(byStatus).length > 0) {
      console.log('     Breakdown: ' + JSON.stringify(byStatus));
    }
  }
}

// 4. Recent CR activity (last 24h)
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { data: recentActivity, count: recentCount } = await supabase
  .from('campaign_prospects')
  .select('status, updated_at', { count: 'exact' })
  .gte('updated_at', yesterday)
  .in('status', ['connection_request_sent', 'connected', 'replied']);

console.log('\n⏰ LAST 24H ACTIVITY:');
console.log('  Total updates:', recentCount || 0);
const activityByStatus = {};
recentActivity?.forEach(p => {
  activityByStatus[p.status] = (activityByStatus[p.status] || 0) + 1;
});
Object.entries(activityByStatus).forEach(([status, count]) => {
  console.log('  ' + status.padEnd(25) + count);
});

// 5. Check for overdue items in queue
const { data: stuckItems, count: stuckCount } = await supabase
  .from('send_queue')
  .select('*', { count: 'exact' })
  .eq('status', 'pending')
  .lt('scheduled_for', new Date().toISOString());

console.log('\n⚠️  OVERDUE QUEUE ITEMS:', stuckCount || 0);
if (stuckItems && stuckItems.length > 0) {
  stuckItems.slice(0, 5).forEach(item => {
    console.log('  - Scheduled:', item.scheduled_for, '| Campaign:', item.campaign_id?.slice(0, 8));
  });
}

// 6. Check Asphericon campaigns specifically
console.log('\n🎯 ASPHERICON CAMPAIGNS:');
const { data: asphericonCampaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, created_at')
  .ilike('name', '%asphericon%')
  .order('created_at', { ascending: false });

if (!asphericonCampaigns || asphericonCampaigns.length === 0) {
  console.log('  No Asphericon campaigns found');
} else {
  for (const c of asphericonCampaigns) {
    const { data: prospects, count } = await supabase
      .from('campaign_prospects')
      .select('status', { count: 'exact' })
      .eq('campaign_id', c.id);

    const byStatus = {};
    prospects?.forEach(p => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    });

    console.log('  📋 ' + c.name);
    console.log('     ID: ' + c.id);
    console.log('     Status: ' + c.status + ' | Total: ' + (count || 0));
    console.log('     Created: ' + c.created_at);
    if (Object.keys(byStatus).length > 0) {
      console.log('     Breakdown: ' + JSON.stringify(byStatus));
    }

    // Get queue items for this campaign
    const { data: queueItems, count: queueCount } = await supabase
      .from('send_queue')
      .select('status, scheduled_for', { count: 'exact' })
      .eq('campaign_id', c.id);

    if (queueCount > 0) {
      const qByStatus = {};
      queueItems?.forEach(q => {
        qByStatus[q.status] = (qByStatus[q.status] || 0) + 1;
      });
      console.log('     Queue: ' + JSON.stringify(qByStatus));
    }
    console.log();
  }
}

console.log('='.repeat(70));
console.log('✅ Campaign check complete');
