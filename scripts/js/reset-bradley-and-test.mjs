import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetAndTest() {
  const prospectId = '40081f1d-de43-46cd-8e79-ede120b60423';
  const campaignId = 'd74d38c2-bd2c-4522-b503-72eda6350983';

  console.log('🔄 Resetting Bradley to approved status...\n');

  // Reset Bradley's status to 'approved' so he gets picked up
  const { error: updateError } = await supabase
    .from('campaign_prospects')
    .update({
      status: 'approved',
      notes: null,
      contacted_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', prospectId);

  if (updateError) {
    console.error('❌ Failed to update:', updateError);
    return;
  }

  console.log('✅ Bradley reset to approved status');
  console.log('');

  // Verify the campaign exists and has the right details
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select(`
      id,
      campaign_name,
      message_templates,
      linkedin_account_id,
      workspace_accounts!linkedin_account_id (
        id,
        unipile_account_id,
        account_name
      )
    `)
    .eq('id', campaignId)
    .single();

  if (campaignError) {
    console.error('❌ Campaign error:', campaignError);
    return;
  }

  console.log('📋 Campaign Details:');
  console.log(`  Name: ${campaign.campaign_name}`);
  console.log(`  LinkedIn Account: ${campaign.workspace_accounts?.account_name}`);
  console.log(`  Unipile Account ID: ${campaign.workspace_accounts?.unipile_account_id}`);
  console.log(`  Connection Request Message: ${campaign.message_templates?.connection_request || 'DEFAULT'}`);
  console.log('');

  // Check prospect details
  const { data: prospect } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('id', prospectId)
    .single();

  console.log('👤 Prospect Details:');
  console.log(`  Name: ${prospect.first_name} ${prospect.last_name}`);
  console.log(`  LinkedIn URL: ${prospect.linkedin_url}`);
  console.log(`  Status: ${prospect.status}`);
  console.log(`  Company: ${prospect.company_name || 'N/A'}`);
  console.log(`  Title: ${prospect.title || 'N/A'}`);
  console.log('');

  console.log('✅ Ready to execute campaign!');
  console.log('');
  console.log('Next step: Call the API endpoint:');
  console.log('POST /api/campaigns/direct/send-connection-requests');
  console.log(`Body: { "campaignId": "${campaignId}" }`);
}

resetAndTest().catch(console.error);
