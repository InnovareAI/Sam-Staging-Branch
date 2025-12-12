import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  // Get ALL campaigns with approved prospects
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('campaign_id, status, first_name, last_name, linkedin_url, campaigns(id, name, campaign_name, status)')
    .eq('status', 'approved')
    .limit(100);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Approved prospects:', prospects?.length || 0);

  // Group by campaign
  const byCampaign = {};
  for (const p of prospects || []) {
    const cid = p.campaign_id;
    if (!byCampaign[cid]) {
      byCampaign[cid] = {
        name: p.campaigns?.name || p.campaigns?.campaign_name || 'NO NAME',
        status: p.campaigns?.status,
        prospects: []
      };
    }
    byCampaign[cid].prospects.push({
      name: `${p.first_name} ${p.last_name}`,
      linkedin_url: p.linkedin_url
    });
  }

  console.log('\nCampaigns with approved prospects:');
  for (const [cid, info] of Object.entries(byCampaign)) {
    console.log('  ', cid.substring(0,8), '|', info.name, '| campaign_status:', info.status, '| approved:', info.prospects.length);

    // Check if these are in queue
    const { data: queued } = await supabase
      .from('send_queue')
      .select('prospect_id, status')
      .eq('campaign_id', cid);

    console.log('     Queue entries:', queued?.length || 0);
  }
}

check().catch(console.error);
