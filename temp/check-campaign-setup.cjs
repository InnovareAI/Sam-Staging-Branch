require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaignSetup() {
  const campaignId = '0a56408b-be39-4144-870f-2b0dce45b620';

  console.log('🔍 CHECKING CAMPAIGN SETUP\n');
  console.log('=' .repeat(70));

  // Get campaign details
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    console.log('\n❌ Campaign not found\n');
    return;
  }

  console.log(`\n✅ Campaign: ${campaign.name}`);
  console.log(`   Status: ${campaign.status || 'N/A'}`);
  console.log(`   Type: ${campaign.type || 'N/A'}`);
  console.log(`   Created: ${new Date(campaign.created_at).toLocaleString()}\n`);

  // Get prospect count
  const { count } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'approved');

  console.log(`📊 Approved prospects: ${count || 0}`);

  // Check if campaign has messaging configuration
  console.log('\n📝 Campaign Configuration:');
  console.log(`   Connection Request: ${campaign.connection_request_message ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Message 1: ${campaign.message_1 ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Message 2: ${campaign.message_2 ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Message 3: ${campaign.message_3 ? '✅ Set' : '❌ Missing'}`);

  // Check N8N workflow configuration
  console.log(`\n🔧 N8N Configuration:`);
  console.log(`   Workflow ID: ${campaign.n8n_workflow_id || '❌ Not set'}`);

  // Check LinkedIn account
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', campaign.workspace_id)
    .single();

  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('provider, account_identifier, is_active')
    .eq('workspace_id', campaign.workspace_id)
    .eq('provider', 'linkedin');

  console.log(`\n👤 LinkedIn Account:`);
  if (accounts && accounts.length > 0) {
    accounts.forEach(acc => {
      console.log(`   ${acc.is_active ? '✅' : '❌'} ${acc.account_identifier}`);
    });
  } else {
    console.log(`   ❌ No LinkedIn account connected`);
  }

  console.log('\n' + '=' .repeat(70));

  // Determine readiness
  const isReady =
    count > 0 &&
    campaign.connection_request_message &&
    accounts && accounts.length > 0 && accounts.some(a => a.is_active);

  if (isReady) {
    console.log('\n✅ CAMPAIGN IS READY TO LAUNCH!');
    console.log(`\n   Campaign ID: ${campaignId}`);
    console.log(`   Workspace: ${workspace?.name || 'Unknown'}`);
    console.log(`   Prospects: ${count} approved\n`);
  } else {
    console.log('\n⚠️  CAMPAIGN NOT READY - Missing:');
    if (count === 0) console.log('   - Approved prospects');
    if (!campaign.connection_request_message) console.log('   - Connection request message');
    if (!accounts || accounts.length === 0 || !accounts.some(a => a.is_active)) {
      console.log('   - Active LinkedIn account');
    }
    console.log('');
  }
}

checkCampaignSetup().catch(console.error);
