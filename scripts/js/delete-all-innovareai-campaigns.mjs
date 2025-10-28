import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // InnovareAI Workspace

console.log('🗑️  DELETING ALL DATA FROM INNOVAREAI WORKSPACE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Step 1: Get all campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name')
  .eq('workspace_id', workspaceId);

console.log(`Found ${campaigns?.length || 0} campaigns\n`);

if (campaigns && campaigns.length > 0) {
  // Step 2: Delete all campaign_prospects
  console.log('🗑️  Deleting campaign_prospects...');
  for (const campaign of campaigns) {
    const { error: deleteProspectsError } = await supabase
      .from('campaign_prospects')
      .delete()
      .eq('campaign_id', campaign.id);

    if (deleteProspectsError) {
      console.error(`❌ Error deleting prospects for ${campaign.name}:`, deleteProspectsError.message);
    } else {
      console.log(`   ✅ Deleted prospects from: ${campaign.name}`);
    }
  }

  // Step 3: Delete all campaigns
  console.log('\n🗑️  Deleting campaigns...');
  const { error: deleteCampaignsError } = await supabase
    .from('campaigns')
    .delete()
    .eq('workspace_id', workspaceId);

  if (deleteCampaignsError) {
    console.error('❌ Error deleting campaigns:', deleteCampaignsError.message);
  } else {
    console.log(`   ✅ Deleted ${campaigns.length} campaigns`);
  }
}

// Step 4: Delete prospect_approval_data
console.log('\n🗑️  Deleting prospect_approval_data...');
const { error: deleteApprovalError } = await supabase
  .from('prospect_approval_data')
  .delete()
  .eq('workspace_id', workspaceId);

if (deleteApprovalError) {
  console.error('❌ Error deleting approval data:', deleteApprovalError.message);
} else {
  console.log('   ✅ Deleted prospect approval data');
}

// Step 5: Delete prospect_approval_sessions
console.log('\n🗑️  Deleting prospect_approval_sessions...');
const { error: deleteSessionsError } = await supabase
  .from('prospect_approval_sessions')
  .delete()
  .eq('workspace_id', workspaceId);

if (deleteSessionsError) {
  console.error('❌ Error deleting approval sessions:', deleteSessionsError.message);
} else {
  console.log('   ✅ Deleted prospect approval sessions');
}

// Step 6: Delete workspace_prospects
console.log('\n🗑️  Deleting workspace_prospects...');
const { error: deleteWorkspaceProspectsError } = await supabase
  .from('workspace_prospects')
  .delete()
  .eq('workspace_id', workspaceId);

if (deleteWorkspaceProspectsError) {
  console.error('❌ Error deleting workspace prospects:', deleteWorkspaceProspectsError.message);
} else {
  console.log('   ✅ Deleted workspace prospects');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ InnovareAI Workspace cleaned - all campaign data deleted');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Verify cleanup
const { count: campaignsLeft } = await supabase
  .from('campaigns')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', workspaceId);

const { count: prospectsLeft } = await supabase
  .from('campaign_prospects')
  .select('*, campaigns!inner(workspace_id)', { count: 'exact', head: true })
  .eq('campaigns.workspace_id', workspaceId);

console.log('Verification:');
console.log(`  Campaigns remaining: ${campaignsLeft || 0}`);
console.log(`  Prospects remaining: ${prospectsLeft || 0}`);

if (campaignsLeft === 0 && prospectsLeft === 0) {
  console.log('\n🎉 Workspace is completely clean!');
} else {
  console.log('\n⚠️  Some data may still remain - check manually');
}
