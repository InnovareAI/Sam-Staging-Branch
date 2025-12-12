#!/usr/bin/env node

/**
 * Debug script to check campaign message template mapping
 *
 * This script queries recent campaigns to see what data is being saved
 * to the connection_request, alternative_message, and follow_up_messages fields
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugCampaignMessages() {
  console.log('🔍 Fetching recent campaigns...\n');

  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, campaign_type, connection_request, alternative_message, message_templates')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error fetching campaigns:', error);
    return;
  }

  if (!campaigns || campaigns.length === 0) {
    console.log('No campaigns found.');
    return;
  }

  console.log(`Found ${campaigns.length} recent campaigns:\n`);

  campaigns.forEach((campaign, index) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Campaign ${index + 1}: ${campaign.name}`);
    console.log(`Type: ${campaign.campaign_type}`);
    console.log(`ID: ${campaign.id}`);
    console.log(`${'='.repeat(80)}\n`);

    // Check direct fields
    console.log('📝 Direct Fields:');
    console.log('  connection_request:', campaign.connection_request ? `"${campaign.connection_request.substring(0, 100)}..."` : 'NULL');
    console.log('  alternative_message:', campaign.alternative_message ? `"${campaign.alternative_message.substring(0, 100)}..."` : 'NULL');

    // Check message_templates JSONB
    console.log('\n📦 message_templates (JSONB):');
    if (campaign.message_templates) {
      const templates = campaign.message_templates;

      // For connector campaigns
      if (templates.connection_request) {
        console.log('  connection_request:', `"${templates.connection_request.substring(0, 100)}..."`);
      }
      if (templates.alternative_message) {
        console.log('  alternative_message:', `"${templates.alternative_message.substring(0, 100)}..."`);
      }
      if (templates.follow_up_messages && Array.isArray(templates.follow_up_messages)) {
        console.log('  follow_up_messages:');
        templates.follow_up_messages.forEach((msg, i) => {
          console.log(`    [${i}]:`, msg ? `"${msg.substring(0, 80)}..."` : 'NULL');
        });
      }

      // For messenger campaigns
      if (templates.direct_message_1) {
        console.log('  direct_message_1:', `"${templates.direct_message_1.substring(0, 100)}..."`);
      }
      if (templates.direct_message_2) {
        console.log('  direct_message_2:', `"${templates.direct_message_2.substring(0, 100)}..."`);
      }
      if (templates.direct_message_3) {
        console.log('  direct_message_3:', `"${templates.direct_message_3.substring(0, 100)}..."`);
      }
      if (templates.direct_message_4) {
        console.log('  direct_message_4:', `"${templates.direct_message_4.substring(0, 100)}..."`);
      }
      if (templates.direct_message_5) {
        console.log('  direct_message_5:', `"${templates.direct_message_5.substring(0, 100)}..."`);
      }
    } else {
      console.log('  NULL');
    }

    console.log('\n' + '─'.repeat(80));
  });

  console.log('\n\n✅ Debug complete\n');
}

debugCampaignMessages().catch(console.error);
