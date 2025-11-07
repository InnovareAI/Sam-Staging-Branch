const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateCampaigns() {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // InnovareAI
  const thorstenAccountId = 'ed8bebf6-5b59-47d6-803e-eb015cfb138b'; // Thorsten Linz

  console.log('🔄 Updating campaigns to use Thorsten Linz LinkedIn account...\n');

  // Get all active campaigns in this workspace
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, status, linkedin_account_id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');

  if (error) {
    console.error('❌ Error fetching campaigns:', error.message);
    return;
  }

  console.log(`Found ${campaigns.length} active campaigns:\n`);

  for (const campaign of campaigns) {
    console.log(`Campaign: ${campaign.name}`);
    console.log(`  Current LinkedIn Account ID: ${campaign.linkedin_account_id || 'NONE'}`);

    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ linkedin_account_id: thorstenAccountId })
      .eq('id', campaign.id);

    if (updateError) {
      console.log(`  ❌ Failed to update: ${updateError.message}`);
    } else {
      console.log(`  ✅ Updated to use Thorsten Linz account`);
    }
    console.log('');
  }

  console.log('✅ All campaigns updated!');
}

updateCampaigns().catch(console.error);
