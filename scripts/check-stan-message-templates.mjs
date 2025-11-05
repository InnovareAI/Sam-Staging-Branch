// Check message templates and sequences in Stan's campaigns
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMessageTemplates() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const stanUserId = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';

  console.log('🔍 CHECKING STAN\'S MESSAGE TEMPLATES AND SEQUENCES\n');
  console.log('=' .repeat(80) + '\n');

  // Get all campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  for (const campaign of campaigns || []) {
    const isStansCampaign = campaign.created_by === stanUserId;

    console.log(`\n📊 ${campaign.name}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Type: ${campaign.campaign_type}`);
    console.log(`   Created: ${new Date(campaign.created_at).toLocaleString()}`);
    console.log(`   Created by: ${isStansCampaign ? '👤 STAN BOUNEV' : 'Other user'}`);

    // Check message_templates
    if (campaign.message_templates) {
      console.log('\n   📝 MESSAGE TEMPLATES:');
      console.log(JSON.stringify(campaign.message_templates, null, 6));
    }

    // Check draft_data
    if (campaign.draft_data && Object.keys(campaign.draft_data).length > 0) {
      console.log('\n   📋 DRAFT DATA:');
      console.log(JSON.stringify(campaign.draft_data, null, 6));
    }

    // Check flow_settings
    if (campaign.flow_settings && Object.keys(campaign.flow_settings).length > 0) {
      console.log('\n   ⚙️  FLOW SETTINGS:');
      console.log(JSON.stringify(campaign.flow_settings, null, 6));
    }

    // Check follow_up_messages
    if (campaign.follow_up_messages && campaign.follow_up_messages.length > 0) {
      console.log('\n   📨 FOLLOW-UP MESSAGES:');
      console.log(JSON.stringify(campaign.follow_up_messages, null, 6));
    }

    // Check funnel_configuration
    if (campaign.funnel_configuration) {
      console.log('\n   🎯 FUNNEL CONFIGURATION:');
      console.log(JSON.stringify(campaign.funnel_configuration, null, 6));
    }

    // Check metadata
    if (campaign.metadata && Object.keys(campaign.metadata).length > 0) {
      console.log('\n   📊 METADATA:');
      console.log(JSON.stringify(campaign.metadata, null, 6));
    }

    console.log('\n' + '-'.repeat(80));
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('\n📋 SUMMARY:\n');

  const stanCampaigns = campaigns?.filter(c => c.created_by === stanUserId) || [];
  const otherCampaigns = campaigns?.filter(c => c.created_by !== stanUserId) || [];

  console.log(`Stan's campaigns: ${stanCampaigns.length}`);
  console.log(`Other campaigns in workspace: ${otherCampaigns.length}`);

  if (stanCampaigns.length > 0) {
    console.log('\n📊 Stan\'s campaigns:');
    stanCampaigns.forEach(c => {
      const hasTemplates = c.message_templates && Object.keys(c.message_templates).length > 0;
      const hasDraft = c.draft_data && Object.keys(c.draft_data).length > 0;
      const hasFlow = c.flow_settings && Object.keys(c.flow_settings).length > 0;

      console.log(`   - ${c.name}`);
      console.log(`     Templates: ${hasTemplates ? '✅' : '❌'}`);
      console.log(`     Draft data: ${hasDraft ? '✅' : '❌'}`);
      console.log(`     Flow settings: ${hasFlow ? '✅' : '❌'}`);
    });
  }

  console.log('\n✅ Message template check complete!\n');
}

checkMessageTemplates().catch(console.error);
