import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function fix() {
  const now = new Date();
  console.log('Current time:', now.toISOString());

  // Get ALL pending items that are overdue
  const { data: overdueItems, error: overdueError } = await supabase
    .from('send_queue')
    .select('id, campaign_id, scheduled_for, linkedin_user_id')
    .eq('status', 'pending')
    .lt('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true });

  if (overdueError) {
    console.error('Error fetching overdue:', overdueError);
    return;
  }

  console.log('Overdue pending items:', overdueItems?.length || 0);

  if (!overdueItems || overdueItems.length === 0) {
    console.log('No overdue items to fix');
    return;
  }

  // Reschedule them with 2-minute spacing starting now
  console.log('\nRescheduling overdue items with 2-minute spacing...');

  let currentTime = new Date();
  let rescheduledCount = 0;

  for (let i = 0; i < overdueItems.length; i++) {
    const item = overdueItems[i];
    const newScheduledFor = new Date(currentTime.getTime() + i * 2 * 60 * 1000);

    const { error: updateError } = await supabase
      .from('send_queue')
      .update({ scheduled_for: newScheduledFor.toISOString() })
      .eq('id', item.id);

    if (updateError) {
      console.error('Failed to reschedule', item.id, ':', updateError.message);
    } else {
      rescheduledCount++;
      if (i < 5) {
        console.log('  Rescheduled', item.id.substring(0,8), 'to', newScheduledFor.toISOString());
      }
    }
  }

  console.log(`\n✅ Rescheduled ${rescheduledCount} items`);
  console.log('First item now due at:', currentTime.toISOString());
  console.log('Last item will be at:', new Date(currentTime.getTime() + (rescheduledCount - 1) * 2 * 60 * 1000).toISOString());

  // Also check approved prospects not in queue
  console.log('\n--- Checking approved prospects not in queue ---');

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, campaign_name, status, message_templates, connection_message, linkedin_config, campaign_type')
    .in('status', ['active', 'running']);

  for (const campaign of campaigns || []) {
    const { data: approved } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, linkedin_url, company_name, title')
      .eq('campaign_id', campaign.id)
      .eq('status', 'approved')
      .not('linkedin_url', 'is', null);

    if (!approved || approved.length === 0) continue;

    // Check which are already queued
    const prospectIds = approved.map(p => p.id);
    const { data: existingQueue } = await supabase
      .from('send_queue')
      .select('prospect_id')
      .eq('campaign_id', campaign.id)
      .in('prospect_id', prospectIds);

    const queuedIds = new Set((existingQueue || []).map(q => q.prospect_id));
    const notQueued = approved.filter(p => !queuedIds.has(p.id));

    if (notQueued.length === 0) continue;

    console.log('\nCampaign:', campaign.name || campaign.campaign_name, '- Found', notQueued.length, 'approved prospects not in queue');

    // Get message template
    const linkedinConfig = campaign.linkedin_config;
    const isMessenger = campaign.campaign_type === 'messenger';
    let messageTemplate = null;

    if (isMessenger) {
      messageTemplate = campaign.message_templates?.direct_message_1;
    } else {
      messageTemplate = campaign.message_templates?.connection_request ||
        campaign.connection_message ||
        linkedinConfig?.connection_message;
    }

    if (!messageTemplate) {
      console.log('  ⚠️ No message template found - skipping');
      continue;
    }

    // Queue them
    const queueRecords = [];
    let queueTime = new Date(currentTime.getTime() + rescheduledCount * 2 * 60 * 1000);

    for (const prospect of notQueued) {
      let message = messageTemplate;
      message = message.replace(/\{first_name\}/gi, prospect.first_name || '');
      message = message.replace(/\{last_name\}/gi, prospect.last_name || '');
      message = message.replace(/\{company\}/gi, prospect.company_name || '');
      message = message.replace(/\{title\}/gi, prospect.title || '');

      queueRecords.push({
        campaign_id: campaign.id,
        prospect_id: prospect.id,
        linkedin_user_id: prospect.linkedin_url,
        message: message.trim(),
        scheduled_for: queueTime.toISOString(),
        status: 'pending',
        message_type: isMessenger ? 'direct_message_1' : 'connection_request'
      });

      queueTime = new Date(queueTime.getTime() + 30 * 60 * 1000); // 30 min spacing
    }

    const { data: inserted, error: insertError } = await supabase
      .from('send_queue')
      .insert(queueRecords)
      .select('id');

    if (insertError) {
      console.log('  ❌ Failed to queue:', insertError.message);
    } else {
      console.log('  ✅ Queued', inserted?.length || 0, 'prospects');

      // Update prospect status
      await supabase
        .from('campaign_prospects')
        .update({ status: 'queued', updated_at: new Date().toISOString() })
        .in('id', notQueued.map(p => p.id));
    }
  }

  console.log('\n✅ Done!');
}

fix().catch(console.error);
