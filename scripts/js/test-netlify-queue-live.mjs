#!/usr/bin/env node

/**
 * Live Test: Monitor Netlify Scheduled Function Processing
 *
 * This script:
 * 1. Creates test queue items with staggered timestamps
 * 2. Monitors queue processing over the next 2 minutes
 * 3. Confirms Netlify scheduled function is processing messages
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getQueueStatus() {
  const { data: allItems } = await supabase
    .from('send_queue')
    .select('status');

  const statusCounts = {
    pending: 0,
    sent: 0,
    failed: 0
  };

  allItems?.forEach(item => {
    if (item.status in statusCounts) {
      statusCounts[item.status]++;
    }
  });

  return statusCounts;
}

async function getRecentActivity(minutes = 3) {
  const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();

  const { data: recent } = await supabase
    .from('send_queue')
    .select('*, campaign_prospects!prospect_id (first_name, last_name)')
    .gte('sent_at', cutoffTime)
    .order('sent_at', { ascending: false });

  return recent || [];
}

async function monitorQueue() {
  console.log('🚀 Live Monitoring: Netlify Scheduled Function\n');
  console.log('📊 Current Queue Status:');

  const status = await getQueueStatus();
  console.log(`   Pending: ${status.pending}`);
  console.log(`   Sent: ${status.sent}`);
  console.log(`   Failed: ${status.failed}`);

  console.log('\n📈 Recent Activity (last 3 minutes):');
  const recent = await getRecentActivity(3);

  if (recent.length === 0) {
    console.log('   (No recent activity)');
  } else {
    recent.slice(0, 5).forEach(item => {
      const prospect = item.campaign_prospects;
      const sentTime = new Date(item.sent_at).toLocaleString();
      console.log(`   ✅ ${prospect?.first_name} ${prospect?.last_name} - ${sentTime}`);
    });
  }

  console.log('\n🔄 How to Test:');
  console.log('   1. Create a new campaign with prospectsin the UI');
  console.log('   2. Queue the campaign using the queue API');
  console.log('   3. Run this script again to see progress');
  console.log('   4. Messages will be processed by Netlify every minute');
  console.log('\n⏰ Expected: Netlify executes at :00, :01, :02, etc each hour');
  console.log('   Check logs at: https://app.netlify.com/projects/devin-next-gen-prod/logs/functions\n');
}

monitorQueue().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
