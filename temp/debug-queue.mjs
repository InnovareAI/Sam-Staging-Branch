import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const campaignId = '64c672da-fb0c-42f3-861e-a47fa29ac06b';

async function debug() {
  // Step 2: Get pending prospects
  const { data: pendingProspects, error: prospError } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url, status')
    .eq('campaign_id', campaignId)
    .in('status', ['pending', 'approved'])
    .not('linkedin_url', 'is', null);

  console.log('Pending prospects with linkedin_url:', pendingProspects?.length);

  // Step 3: Check which are already in queue FOR THIS CAMPAIGN
  const prospectIds = pendingProspects.map(p => p.id);
  const { data: existingQueue } = await supabase
    .from('send_queue')
    .select('prospect_id, status')
    .eq('campaign_id', campaignId)
    .in('prospect_id', prospectIds);

  console.log('Existing queue entries (this campaign):', existingQueue?.length);

  const existingIds = new Set((existingQueue || []).map(q => q.prospect_id));
  const unqueued = pendingProspects.filter(p => !existingIds.has(p.id));
  console.log('Unqueued after filtering:', unqueued.length);

  // Cross-campaign dedup check
  if (unqueued.length > 0) {
    const linkedinUrls = unqueued.map(p => p.linkedin_url).filter(Boolean);

    // 3a - Already in ANY send_queue?
    const { data: previouslySent } = await supabase
      .from('send_queue')
      .select('linkedin_user_id')
      .in('status', ['sent', 'pending', 'failed', 'skipped'])
      .in('linkedin_user_id', linkedinUrls);

    console.log('In send_queue (any campaign):', previouslySent?.length);

    // 3b - Already contacted?
    const { data: previouslyContacted } = await supabase
      .from('campaign_prospects')
      .select('linkedin_url')
      .in('status', ['connection_request_sent', 'already_invited', 'connected', 'messaged', 'replied', 'failed'])
      .in('linkedin_url', linkedinUrls);

    console.log('Previously contacted:', previouslyContacted?.length);

    const sentUrls = new Set((previouslySent || []).map(s => s.linkedin_user_id?.toLowerCase().replace(/\/+$/, '')));
    const contactedUrls = new Set((previouslyContacted || []).map(c => c.linkedin_url?.toLowerCase().replace(/\/+$/, '')));

    const finalUnqueued = unqueued.filter(p => {
      const url = p.linkedin_url?.toLowerCase().replace(/\/+$/, '');
      return !sentUrls.has(url) && !contactedUrls.has(url);
    });

    console.log('Final unqueued count:', finalUnqueued.length);

    if (finalUnqueued.length > 0) {
      console.log('\n✅ SHOULD QUEUE', finalUnqueued.length, 'prospects!');
      console.log('First 3:', finalUnqueued.slice(0, 3).map(p => `${p.first_name} ${p.last_name}`));
    }
  }
}

debug().catch(console.error);
