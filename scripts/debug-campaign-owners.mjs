import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugCampaignOwners() {
  console.log('🔍 Debugging campaign owner lookup...\n');

  const failingCampaigns = [
    'b09964f2-b222-4f47-97da-a7816efa4106', // New Campaign- Mich
    '4486cc53-3c8a-47d2-a88c-3dd69db5a17e'  // New Campaign-Canada
  ];

  for (const campaignId of failingCampaigns) {
    console.log(`\n📊 Campaign: ${campaignId}`);

    // Get campaign details
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, workspace_id, created_by')
      .eq('id', campaignId)
      .single();

    if (!campaign) {
      console.log('  ❌ Campaign not found');
      continue;
    }

    console.log(`  Name: ${campaign.name}`);
    console.log(`  Workspace ID: ${campaign.workspace_id}`);
    console.log(`  Created By: ${campaign.created_by}`);

    // Try to find owner with the same query as the cron
    const { data: owner, error } = await supabase
      .from('workspace_members')
      .select('user_id, role, users(email)')
      .eq('workspace_id', campaign.workspace_id)
      .eq('role', 'owner')
      .single();

    console.log(`\n  Owner lookup result:`);
    if (error) {
      console.log(`    ❌ Error: ${error.message}`);
      console.log(`    Code: ${error.code}`);
    } else if (owner) {
      console.log(`    ✅ Found owner: ${owner.users?.email || owner.user_id}`);
      console.log(`    User ID: ${owner.user_id}`);
    } else {
      console.log(`    ❌ No owner found (but no error?)`);
    }

    // Check all members in this workspace
    const { data: allMembers } = await supabase
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', campaign.workspace_id);

    console.log(`\n  All members in workspace (${allMembers?.length || 0}):`);
    allMembers?.forEach(m => {
      console.log(`    - User: ${m.user_id}`);
      console.log(`      Role: ${m.role}`);
    });
  }
}

debugCampaignOwners().catch(console.error);
