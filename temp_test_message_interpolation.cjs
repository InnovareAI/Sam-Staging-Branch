#!/usr/bin/env node

/**
 * Test what happens when message templates are interpolated with prospect data
 * This will show us why some messages pass validation but fail when sent
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMessageInterpolation() {
  console.log('🧪 Testing Message Template Interpolation\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  const IRISH_UNIPILE_ID = 'ymtTx4xVQ6OVUFk83ctwtA';

  // Get Irish's account
  const { data: account } = await supabase
    .from('workspace_accounts')
    .select('id')
    .eq('unipile_account_id', IRISH_UNIPILE_ID)
    .single();

  if (!account) {
    console.log('❌ Account not found');
    return;
  }

  // Get a campaign with message templates
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, campaign_name, message_templates')
    .eq('linkedin_account_id', account.id)
    .limit(5);

  if (!campaigns || campaigns.length === 0) {
    console.log('❌ No campaigns found');
    return;
  }

  console.log(`Found ${campaigns.length} campaigns. Analyzing message templates...\n`);

  for (const campaign of campaigns) {
    console.log(`📊 Campaign: ${campaign.campaign_name || '(unnamed)'}`);
    console.log(`   ID: ${campaign.id}\n`);

    if (!campaign.message_templates) {
      console.log('   ⚠️  No message templates found\n');
      continue;
    }

    const templates = campaign.message_templates;

    // Show the connection request template
    if (templates.connection_request) {
      console.log('   📝 Connection Request Template:');
      console.log(`   "${templates.connection_request}"`);
      console.log(`   Template Length: ${templates.connection_request.length} chars\n`);

      // Get prospects for this campaign
      const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('first_name, last_name, title, company_name')
        .eq('campaign_id', campaign.id)
        .limit(3);

      if (prospects && prospects.length > 0) {
        console.log('   🧪 Testing with actual prospect data:\n');

        for (const prospect of prospects) {
          // Simulate message interpolation (same as queue creation code)
          let interpolatedMessage = templates.connection_request
            .replace(/{first_name}/g, prospect.first_name)
            .replace(/{last_name}/g, prospect.last_name)
            .replace(/{company_name}/g, prospect.company_name || '')
            .replace(/{title}/g, prospect.title || '');

          console.log(`   👤 ${prospect.first_name} ${prospect.last_name}`);
          console.log(`      Title: ${prospect.title || 'N/A'} (${(prospect.title || '').length} chars)`);
          console.log(`      Interpolated Message: "${interpolatedMessage}"`);
          console.log(`      Final Length: ${interpolatedMessage.length} chars`);

          if (interpolatedMessage.length > 300) {
            console.log(`      ❌ EXCEEDS LINKEDIN LIMIT (${interpolatedMessage.length - 300} chars over)`);
          } else if (interpolatedMessage.length > 275) {
            console.log(`      ⚠️  CLOSE TO LIMIT (${300 - interpolatedMessage.length} chars remaining)`);
          } else {
            console.log(`      ✅ OK (${300 - interpolatedMessage.length} chars remaining)`);
          }
          console.log('');
        }
      }
    }

    console.log('   ─────────────────────────────────────────────────────\n');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('💡 INSIGHT:');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('The UI shows character count of the TEMPLATE (with placeholders).');
  console.log('But LinkedIn enforces the limit on the INTERPOLATED message.');
  console.log('');
  console.log('A template with {title} might be 200 chars, but if the title is');
  console.log('170 chars long, the final message becomes 300+ chars!');
  console.log('');
  console.log('FIX: Character counter should show:');
  console.log('  - Template length (current)');
  console.log('  - + Average placeholder expansion');
  console.log('  - = Estimated final length');
  console.log('');
}

testMessageInterpolation().catch(console.error);
