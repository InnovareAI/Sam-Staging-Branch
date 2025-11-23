#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaign() {
  const campaignId = 'cc452d62-c3a4-4d90-bfb9-19063f7a5d79';

  console.log('🔍 Checking Mexico Marketing campaign...\n');

  // Get campaign creation time
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('campaign_name, created_at, status')
    .eq('id', campaignId)
    .single();

  console.log('Campaign details:');
  console.log(`  Name: ${campaign.campaign_name}`);
  console.log(`  Created: ${new Date(campaign.created_at).toLocaleString()}`);
  console.log(`  Status: ${campaign.status}\n`);

  // Get all queue messages
  const { data: queue } = await supabase
    .from('send_queue')
    .select('message_type, requires_connection, scheduled_for, status')
    .eq('campaign_id', campaignId)
    .order('scheduled_for');

  console.log(`Total messages in queue: ${queue?.length || 0}\n`);

  if (queue && queue.length > 0) {
    // Group by message type
    const byType = queue.reduce((acc, msg) => {
      acc[msg.message_type] = (acc[msg.message_type] || 0) + 1;
      return acc;
    }, {});

    console.log('Messages by type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    console.log('\nMessage details:');
    queue.forEach((msg, i) => {
      console.log(`  ${i + 1}. ${msg.message_type} - ${msg.status} - ${new Date(msg.scheduled_for).toLocaleString()}`);
    });
  } else {
    console.log('❌ NO MESSAGES IN QUEUE');
    console.log('\n💡 This campaign was created BEFORE the new code was deployed.');
    console.log('   The old code only queued connection requests, not follow-ups.');
    console.log('\n📋 TO SEE FOLLOW-UPS: Create a NEW campaign after the deployment completes.');
  }
}

checkCampaign();
