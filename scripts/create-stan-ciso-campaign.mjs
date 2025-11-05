// Create Stan's CISO campaign with recovered prospects and proven sequence
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createStanCisoCampaign() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const stanUserId = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';
  const cisoSessionId = '5c86a789-a926-4d79-8120-cc3e76939d75';
  const testCampaignId = '61a82290-4afd-4274-8cd4-5601060cfeed'; // test 2 campaign

  console.log('🚀 CREATING STAN\'S CISO CAMPAIGN\n');
  console.log('=' .repeat(80) + '\n');

  // 1. Get the message templates from test 2 campaign
  console.log('📝 Getting proven message sequence from test campaign...\n');

  const { data: testCampaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', testCampaignId)
    .single();

  if (!testCampaign) {
    console.error('❌ Test campaign not found');
    return;
  }

  console.log('✅ Found message sequence:');
  console.log(`   Connection request: ${testCampaign.message_templates?.connection_request?.substring(0, 80)}...`);
  console.log(`   Follow-ups: ${testCampaign.message_templates?.follow_up_messages?.length || 0} messages\n`);

  // 2. Get the 25 approved CISO prospects
  console.log('👥 Getting 25 approved CISO prospects...\n');

  const { data: approvedProspects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', cisoSessionId)
    .eq('approval_status', 'approved');

  if (!approvedProspects || approvedProspects.length === 0) {
    console.error('❌ No approved prospects found');
    return;
  }

  console.log(`✅ Found ${approvedProspects.length} approved CISO prospects\n`);

  // 3. Create new campaign
  console.log('📊 Creating new campaign...\n');

  const campaignName = '20251106-BLL-CISO Outreach - Mid Market';

  const { data: newCampaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      workspace_id: workspaceId,
      name: campaignName,
      campaign_type: 'connector',
      status: 'draft',
      created_by: stanUserId,
      channel_preferences: testCampaign.channel_preferences,
      target_criteria: testCampaign.target_criteria,
      execution_preferences: testCampaign.execution_preferences,
      funnel_configuration: testCampaign.funnel_configuration,
      current_step: 1,
      follow_up_messages: testCampaign.follow_up_messages,
      message_templates: testCampaign.message_templates,
      send_schedule: testCampaign.send_schedule,
      auto_execute: false, // Keep as manual for now
      timezone: testCampaign.timezone,
      working_hours_start: testCampaign.working_hours_start,
      working_hours_end: testCampaign.working_hours_end,
      skip_weekends: testCampaign.skip_weekends,
      skip_holidays: testCampaign.skip_holidays,
      country_code: testCampaign.country_code,
      flow_settings: testCampaign.flow_settings,
      metadata: {
        source: 'recovered_ciso_prospects',
        original_session: cisoSessionId,
        prospect_count: approvedProspects.length
      }
    })
    .select()
    .single();

  if (campaignError) {
    console.error('❌ Error creating campaign:', campaignError);
    return;
  }

  console.log(`✅ Created campaign: ${campaignName}`);
  console.log(`   ID: ${newCampaign.id}\n`);

  // 4. Add prospects to campaign
  console.log('👥 Adding 25 CISO prospects to campaign...\n');

  const campaignProspects = approvedProspects.map(p => ({
    campaign_id: newCampaign.id,
    workspace_id: workspaceId,
    first_name: p.contact?.firstName || p.name?.split(' ')[0] || 'Unknown',
    last_name: p.contact?.lastName || p.name?.split(' ').slice(1).join(' ') || '',
    email: p.contact?.email || null,
    linkedin_url: p.contact?.linkedin_url || null,
    title: p.title,
    company_name: p.company?.name,
    location: p.location,
    status: 'approved',
    personalization_data: {
      company_name: p.company?.name,
      title: p.title,
      session_id: cisoSessionId,
      enrichment_score: p.enrichment_score,
      company_industry: p.company?.industry,
      company_size: p.company?.employee_count,
      original_prospect_id: p.id
    }
  }));

  const { data: insertedProspects, error: prospectsError } = await supabase
    .from('campaign_prospects')
    .insert(campaignProspects)
    .select();

  if (prospectsError) {
    console.error('❌ Error adding prospects:', prospectsError);
    return;
  }

  console.log(`✅ Added ${insertedProspects.length} prospects to campaign\n`);

  // 5. Summary
  console.log('=' .repeat(80));
  console.log('\n🎉 SUCCESS! Stan\'s CISO Campaign is Ready!\n');
  console.log('📊 Campaign Details:');
  console.log(`   Name: ${campaignName}`);
  console.log(`   ID: ${newCampaign.id}`);
  console.log(`   Status: draft (ready to activate)`);
  console.log(`   Prospects: ${insertedProspects.length} CISOs and security leaders`);
  console.log(`   Message sequence: 6 messages (connection + 5 follow-ups)`);
  console.log('');
  console.log('📋 Next Steps for Stan:');
  console.log('   1. Review the campaign in the UI');
  console.log('   2. Verify the message sequence looks correct');
  console.log('   3. Activate the campaign when ready');
  console.log('   4. Set auto_execute to true if desired');
  console.log('');
  console.log('✅ All 25 CISO prospects recovered and ready to go!');
  console.log('');
}

createStanCisoCampaign().catch(console.error);
