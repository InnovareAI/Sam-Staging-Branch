const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function showDetails() {
  const campaignId = '0a56408b-be39-4144-870f-2b0dce45b620';

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  console.log('Campaign full details:\n');
  console.log(JSON.stringify(campaign, null, 2));

  console.log('\n\n═══════════════════════════════════════════════════════════════════════');
  console.log('Key fields:');
  console.log(`  name: ${campaign.name}`);
  console.log(`  status: ${campaign.status}`);
  console.log(`  campaign_type: ${campaign.campaign_type}`);
  console.log(`  created_by: ${campaign.created_by}`);
  console.log(`  workspace_id: ${campaign.workspace_id}`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

showDetails().catch(console.error);
