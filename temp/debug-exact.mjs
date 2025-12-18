import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function simulateProduction() {
  console.log('=== SIMULATING PRODUCTION queue-pending-prospects ===\n');

  // Step 1: Get active campaigns (exactly like production)
  const { data: activeCampaigns, error: campError } = await supabase
    .from('campaigns')
    .select(`
      id, campaign_name, linkedin_account_id, message_templates, connection_message, linkedin_config, campaign_type, workspace_id,
      workspaces!inner(id, settings)
    `)
    .eq('status', 'active')
    .in('campaign_type', ['connector', 'messenger']);

  console.log('Active campaigns found:', activeCampaigns?.length);

  for (const campaign of activeCampaigns) {
    console.log(`\n--- Campaign: ${campaign.id.substring(0,8)} (${campaign.campaign_name || 'unnamed'}) ---`);

    const isMessengerCampaign = campaign.campaign_type === 'messenger';
    const targetStatuses = isMessengerCampaign
      ? ['approved', 'pending']
      : ['pending', 'approved'];

    // Step 2: Get pending prospects
    const { data: pendingProspects, error: prospError } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, linkedin_url, linkedin_user_id, company_name, title')
      .eq('campaign_id', campaign.id)
      .in('status', targetStatuses)
      .not('linkedin_url', 'is', null);

    if (!pendingProspects || pendingProspects.length === 0) {
      console.log('  No pending prospects');
      continue;
    }
    console.log('  Pending prospects:', pendingProspects.length);

    // Step 3: Check queue for THIS campaign
    const prospectIds = pendingProspects.map(p => p.id);
    const { data: existingQueue } = await supabase
      .from('send_queue')
      .select('prospect_id')
      .eq('campaign_id', campaign.id)
      .in('prospect_id', prospectIds);

    console.log('  Existing queue (this campaign):', existingQueue?.length || 0);

    const existingIds = new Set((existingQueue || []).map(q => q.prospect_id));
    let unqueuedProspects = pendingProspects.filter(p => !existingIds.has(p.id));
    console.log('  Unqueued after same-campaign filter:', unqueuedProspects.length);

    if (unqueuedProspects.length === 0) continue;

    // Step 4: Cross-campaign dedup
    const linkedinUrls = unqueuedProspects.map(p => p.linkedin_url).filter(Boolean);
    console.log('  LinkedIn URLs to check:', linkedinUrls.length);

    // 3a: Check send_queue
    const { data: previouslySent } = await supabase
      .from('send_queue')
      .select('linkedin_user_id')
      .in('status', ['sent', 'pending', 'failed', 'skipped'])
      .in('linkedin_user_id', linkedinUrls);

    console.log('  Previously sent (send_queue):', previouslySent?.length || 0);

    // 3b: Check campaign_prospects
    const { data: previouslyContacted } = await supabase
      .from('campaign_prospects')
      .select('linkedin_url')
      .in('status', ['connection_request_sent', 'already_invited', 'connected', 'messaged', 'replied', 'failed'])
      .in('linkedin_url', linkedinUrls);

    console.log('  Previously contacted (campaign_prospects):', previouslyContacted?.length || 0);

    // Apply filters
    const normalizeUrl = (url) => url?.toLowerCase().replace(/\/+$/, '').trim();
    const sentUrls = new Set((previouslySent || []).map(s => normalizeUrl(s.linkedin_user_id)));
    const contactedUrls = new Set((previouslyContacted || []).map(c => normalizeUrl(c.linkedin_url)));

    const beforeCount = unqueuedProspects.length;
    unqueuedProspects = unqueuedProspects.filter(p => {
      const normalizedUrl = normalizeUrl(p.linkedin_url);
      return !sentUrls.has(normalizedUrl) && !contactedUrls.has(normalizedUrl);
    });

    console.log('  After cross-campaign dedup:', unqueuedProspects.length, '(filtered out:', beforeCount - unqueuedProspects.length, ')');

    // Check message template
    const linkedinConfig = campaign.linkedin_config;
    const isMessenger = campaign.campaign_type === 'messenger';
    let messageTemplate = null;

    if (isMessenger) {
      messageTemplate = campaign.message_templates?.direct_message_1 || null;
    } else {
      messageTemplate = campaign.message_templates?.connection_request ||
                       campaign.connection_message ||
                       linkedinConfig?.connection_message ||
                       null;
    }

    console.log('  Has message template:', !!messageTemplate);

    if (unqueuedProspects.length > 0 && messageTemplate) {
      console.log('  ✅ SHOULD QUEUE:', unqueuedProspects.length, 'prospects');
    }
  }
}

simulateProduction().catch(console.error);
