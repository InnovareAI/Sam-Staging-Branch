import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function moveIAICampaigns() {
  const bllWorkspace = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const iaiWorkspace = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  console.log('🔍 Finding IAI campaigns in Blue Label Labs workspace...\n');

  // Get all campaigns with IAI in name from BLL workspace
  const { data: iaiCampaigns, error: fetchError } = await supabase
    .from('campaigns')
    .select('id, name, status')
    .eq('workspace_id', bllWorkspace)
    .like('name', '%IAI%');

  if (fetchError) {
    console.error('❌ Error fetching campaigns:', fetchError);
    return;
  }

  console.log('Found', iaiCampaigns.length, 'IAI campaigns to move:\n');
  iaiCampaigns.forEach((c, i) => {
    console.log('  ' + (i + 1) + '.', c.name, '(' + c.status + ')');
    console.log('     ID:', c.id);
  });

  if (iaiCampaigns.length === 0) {
    console.log('\n✅ No IAI campaigns to move');
    return;
  }

  console.log('\n🔄 Moving', iaiCampaigns.length, 'campaigns to InnovareAI workspace...\n');

  const campaignIds = iaiCampaigns.map(c => c.id);

  // Move campaigns
  const { error: campaignError } = await supabase
    .from('campaigns')
    .update({ workspace_id: iaiWorkspace })
    .in('id', campaignIds);

  if (campaignError) {
    console.error('❌ Error moving campaigns:', campaignError);
    return;
  }

  console.log('✅ Moved campaigns');

  // Move campaign prospects
  const { error: prospectsError } = await supabase
    .from('campaign_prospects')
    .update({ workspace_id: iaiWorkspace })
    .in('campaign_id', campaignIds);

  if (prospectsError) {
    console.error('❌ Error moving prospects:', prospectsError);
    return;
  }

  console.log('✅ Moved campaign prospects');

  console.log('\n🎉 Successfully moved', iaiCampaigns.length, 'IAI campaigns to InnovareAI workspace');
}

moveIAICampaigns().catch(console.error);
