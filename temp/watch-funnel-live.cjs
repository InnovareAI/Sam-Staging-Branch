require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function watchCampaign() {
  console.log('🔴 LIVE: Watching campaign "20251107-IAI-Final test 2"\n');
  console.log('Press Ctrl+C to stop\n');
  console.log('=' .repeat(70));

  // Get the campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('name', '20251107-IAI-Final test 2')
    .single();

  if (!campaign) {
    console.log('❌ Campaign not found');
    return;
  }

  let lastStatus = null;
  let lastUpdate = null;

  // Poll every 3 seconds
  setInterval(async () => {
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, status, contacted_at, last_message_sent_at, updated_at, personalization_data')
      .eq('campaign_id', campaign.id)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (prospects && prospects.length > 0) {
      const p = prospects[0];

      // Only log if status changed
      if (p.status !== lastStatus || p.updated_at !== lastUpdate) {
        const timestamp = new Date(p.updated_at).toLocaleTimeString();

        console.log(`\n[${timestamp}] ${p.first_name} ${p.last_name}`);
        console.log(`   Status: ${lastStatus || 'N/A'} → ${p.status}`);

        if (p.contacted_at) {
          console.log(`   Contacted: ${new Date(p.contacted_at).toLocaleString()}`);
        }

        if (p.last_message_sent_at) {
          console.log(`   Last Message: ${new Date(p.last_message_sent_at).toLocaleString()}`);
        }

        // Show funnel tracking if available
        if (p.personalization_data?.funnel_tracking) {
          console.log('   Funnel Stages:');
          const stages = p.personalization_data.funnel_tracking;
          Object.keys(stages).forEach(stage => {
            const data = stages[stage];
            const time = new Date(data.timestamp).toLocaleTimeString();
            console.log(`     ✅ ${stage} at ${time}`);
          });
        }

        lastStatus = p.status;
        lastUpdate = p.updated_at;
      } else {
        // Show a dot to indicate still watching
        process.stdout.write('.');
      }
    }
  }, 3000); // Check every 3 seconds
}

watchCampaign().catch(console.error);
