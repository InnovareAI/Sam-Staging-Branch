#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfillFollowUps() {
  const campaignId = 'cc452d62-c3a4-4d90-bfb9-19063f7a5d79';

  console.log('🔄 Backfilling follow-up messages for Mexico Marketing campaign...\n');

  // 1. Get campaign details
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('campaign_name, message_templates, workspace_id')
    .eq('id', campaignId)
    .single();

  if (campaignError || !campaign) {
    console.error('❌ Campaign not found:', campaignError);
    return;
  }

  console.log(`Campaign: ${campaign.campaign_name || 'Untitled'}`);

  // 2. Get existing connection request messages (these have linkedin_user_id)
  const { data: existingQueue, error: queueError } = await supabase
    .from('send_queue')
    .select('prospect_id, scheduled_for, linkedin_user_id')
    .eq('campaign_id', campaignId)
    .eq('message_type', 'connection_request');

  if (queueError || !existingQueue || existingQueue.length === 0) {
    console.error('❌ No connection requests found in queue');
    return;
  }

  console.log(`Found ${existingQueue.length} connection requests in queue\n`);

  // 3. Get prospect details for each queued CR
  const prospectIds = existingQueue.map(q => q.prospect_id);
  const { data: prospects, error: prospectsError } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name')
    .in('id', prospectIds);

  if (prospectsError || !prospects || prospects.length === 0) {
    console.error('❌ No prospects found');
    return;
  }

  // Map prospect details
  const prospectMap = {};
  prospects.forEach(p => {
    prospectMap[p.id] = p;
  });

  // Map schedules and linkedin_user_ids from queue
  const prospectSchedules = {};
  const prospectLinkedInIds = {};
  existingQueue.forEach(item => {
    prospectSchedules[item.prospect_id] = new Date(item.scheduled_for);
    prospectLinkedInIds[item.prospect_id] = item.linkedin_user_id;
  });

  // 4. Get follow-up messages from campaign templates
  const followUpMessages = campaign.message_templates?.follow_up_messages || [];

  if (followUpMessages.length === 0) {
    console.error('❌ No follow-up messages found in campaign templates');
    return;
  }

  console.log(`Found ${followUpMessages.length} follow-up message templates\n`);

  // 5. Create follow-up queue records
  const followUpDelays = [3, 8, 13, 18, 23]; // Days after CR
  const queueRecords = [];

  for (const prospectId of prospectIds) {
    const prospect = prospectMap[prospectId];
    const baseTime = prospectSchedules[prospectId];
    const linkedInId = prospectLinkedInIds[prospectId];

    if (!baseTime || !prospect) {
      console.warn(`⚠️  Missing data for prospect ID ${prospectId}, skipping`);
      continue;
    }

    console.log(`Adding follow-ups for: ${prospect.first_name} ${prospect.last_name}`);

    followUpMessages.forEach((followUpMessage, index) => {
      if (followUpMessage && followUpDelays[index]) {
        const followUpDate = new Date(baseTime);
        followUpDate.setDate(followUpDate.getDate() + followUpDelays[index]);

        // Personalize message
        const personalizedMessage = followUpMessage
          .replace(/{first_name}/g, prospect.first_name)
          .replace(/{last_name}/g, prospect.last_name)
          .replace(/{company}/g, '');

        queueRecords.push({
          campaign_id: campaignId,
          prospect_id: prospectId,
          linkedin_user_id: linkedInId,
          scheduled_for: followUpDate.toISOString(),
          status: 'pending',
          message_type: `follow_up_${index + 1}`,
          requires_connection: true,
          message: personalizedMessage
        });

        console.log(`  ✓ follow_up_${index + 1} - ${followUpDate.toLocaleDateString()}`);
      }
    });
  }

  console.log(`\n📊 Total follow-up messages to insert: ${queueRecords.length}\n`);

  if (queueRecords.length === 0) {
    console.log('❌ No follow-up messages to insert');
    return;
  }

  // 6. Insert into database
  const { data: inserted, error: insertError } = await supabase
    .from('send_queue')
    .insert(queueRecords)
    .select();

  if (insertError) {
    console.error('❌ Failed to insert follow-ups:', insertError);
    return;
  }

  console.log(`✅ Successfully inserted ${inserted.length} follow-up messages!\n`);

  // 7. Verify
  const { data: allQueue } = await supabase
    .from('send_queue')
    .select('message_type')
    .eq('campaign_id', campaignId);

  const byType = allQueue.reduce((acc, msg) => {
    acc[msg.message_type] = (acc[msg.message_type] || 0) + 1;
    return acc;
  }, {});

  console.log('📋 Final queue breakdown:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  console.log('\n✅ Backfill complete!');
}

backfillFollowUps();
