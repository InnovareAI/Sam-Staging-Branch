import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://latxadqrvrrrcvkktrog.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ');

const MIN_GAP_MINUTES = 20;

async function fixStuckCampaigns() {
  console.log('FIXING STUCK CAMPAIGNS');
  console.log('='.repeat(60));

  // 1. Get approved prospects not in send_queue
  const { data: approved } = await supabase
    .from('campaign_prospects')
    .select(`
      id,
      campaign_id,
      linkedin_url,
      first_name,
      last_name,
      status,
      campaigns!inner (
        id,
        name,
        status,
        linkedin_account_id,
        workspace_id,
        message_templates
      )
    `)
    .eq('status', 'approved');

  console.log('\nApproved prospects:', approved?.length || 0);

  // Check which are already in queue
  const { data: queued } = await supabase
    .from('send_queue')
    .select('prospect_id');

  const queuedIds = new Set(queued?.map(q => q.prospect_id) || []);

  // Filter to prospects not yet queued
  const notQueued = approved?.filter(p => !queuedIds.has(p.id)) || [];
  console.log('Not yet in queue:', notQueued.length);

  if (notQueued.length === 0) {
    console.log('All approved prospects are already queued!');
    return;
  }

  // Group by campaign
  const byCampaign = {};
  for (const p of notQueued) {
    const campId = p.campaign_id;
    if (!byCampaign[campId]) {
      byCampaign[campId] = {
        campaign: p.campaigns,
        prospects: []
      };
    }
    byCampaign[campId].prospects.push(p);
  }

  // 2. Queue them
  console.log('\n' + '='.repeat(60));
  console.log('QUEUEING PROSPECTS...\n');

  // Get the last scheduled time in the queue
  const { data: lastQueued } = await supabase
    .from('send_queue')
    .select('scheduled_for')
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: false })
    .limit(1);

  let nextTime = lastQueued?.[0]?.scheduled_for
    ? new Date(new Date(lastQueued[0].scheduled_for).getTime() + MIN_GAP_MINUTES * 60 * 1000)
    : new Date();

  let totalQueued = 0;

  for (const [campId, data] of Object.entries(byCampaign)) {
    const campaign = data.campaign;
    const prospects = data.prospects;

    console.log('\nCampaign: ' + campaign.name);
    console.log('Prospects to queue: ' + prospects.length);
    console.log('LinkedIn Account: ' + (campaign.linkedin_account_id || 'NOT SET'));

    if (!campaign.linkedin_account_id) {
      console.log('⚠️ SKIPPING - No LinkedIn account configured');
      continue;
    }

    if (campaign.status !== 'active') {
      console.log('⚠️ SKIPPING - Campaign not active (status: ' + campaign.status + ')');
      continue;
    }

    // Get connection request message
    const templates = campaign.message_templates || {};
    const crMessage = templates.connection_request || 'Hi {first_name}, I would like to connect with you on LinkedIn.';

    for (const prospect of prospects) {
      // Personalize message
      const message = crMessage
        .replace(/{first_name}/g, prospect.first_name || '')
        .replace(/{last_name}/g, prospect.last_name || '');

      // Extract LinkedIn user ID from URL
      const vanityMatch = prospect.linkedin_url?.match(/linkedin\.com\/in\/([^\/\?#]+)/);
      const linkedinUserId = vanityMatch ? vanityMatch[1] : prospect.linkedin_url;

      // Insert into send_queue
      const { error } = await supabase
        .from('send_queue')
        .insert({
          campaign_id: campaign.id,
          prospect_id: prospect.id,
          linkedin_user_id: linkedinUserId,
          message: message,
          scheduled_for: nextTime.toISOString(),
          status: 'pending'
        });

      if (error) {
        console.log('  ❌ Failed to queue ' + prospect.first_name + ': ' + error.message);
      } else {
        console.log('  ✅ Queued ' + prospect.first_name + ' for ' + nextTime.toISOString());
        totalQueued++;
      }

      // Increment time for next prospect
      nextTime = new Date(nextTime.getTime() + MIN_GAP_MINUTES * 60 * 1000);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DONE - Queued ' + totalQueued + ' prospects');
}

fixStuckCampaigns().catch(console.error);
