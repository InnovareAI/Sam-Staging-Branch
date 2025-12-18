import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const campaignId = '64c672da-fb0c-42f3-861e-a47fa29ac06b';

async function debug() {
  // Get all pending prospects
  const { data: pendingProspects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url')
    .eq('campaign_id', campaignId)
    .in('status', ['pending', 'approved'])
    .not('linkedin_url', 'is', null);

  console.log('Total pending prospects:', pendingProspects?.length);

  // Get sample linkedin URLs
  const sampleUrls = pendingProspects.slice(0, 10).map(p => p.linkedin_url);
  console.log('\nSample URLs:', sampleUrls.slice(0, 3));

  // Check send_queue for ANY campaign with these URLs
  const { data: inQueue } = await supabase
    .from('send_queue')
    .select('linkedin_user_id, campaign_id, status')
    .in('linkedin_user_id', sampleUrls);

  console.log('\nIn send_queue (any campaign):', inQueue?.length);
  if (inQueue?.length > 0) {
    inQueue.forEach(q => {
      console.log('  URL:', q.linkedin_user_id?.substring(0,40), '| Campaign:', q.campaign_id?.substring(0,8), '| Status:', q.status);
    });
  }

  // Check if linkedin_user_id stores URL or user ID
  const { data: queueSample } = await supabase
    .from('send_queue')
    .select('linkedin_user_id, prospect_id, campaign_id')
    .limit(5);

  console.log('\nSend queue sample (linkedin_user_id values):');
  queueSample?.forEach(q => {
    console.log('  ', q.linkedin_user_id?.substring(0, 50));
  });

  // Check campaign_prospects with contacted status
  const { data: contacted } = await supabase
    .from('campaign_prospects')
    .select('linkedin_url, status, campaign_id')
    .in('status', ['connection_request_sent', 'already_invited', 'connected', 'messaged', 'replied', 'failed'])
    .in('linkedin_url', sampleUrls);

  console.log('\nContacted prospects with same URL:', contacted?.length);
  if (contacted?.length > 0) {
    contacted.forEach(c => {
      console.log('  Status:', c.status, '| Campaign:', c.campaign_id?.substring(0,8));
    });
  }
}

debug().catch(console.error);
