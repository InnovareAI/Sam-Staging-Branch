#!/usr/bin/env node

/**
 * DRY RUN TEST - Execute campaign without sending
 * This will show the EXACT message that would be sent to prospects
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const CAMPAIGN_ID = process.argv[2];

if (!CAMPAIGN_ID) {
  console.error('❌ Usage: node test-dry-run.mjs <campaign-id>');
  console.error('   Get campaign ID from: http://localhost:3000/workspace/[workspace-id]/campaigns');
  process.exit(1);
}

async function testDryRun() {
  try {
    console.log('🧪 DRY RUN TEST');
    console.log('================\n');
    console.log(`Campaign ID: ${CAMPAIGN_ID}`);
    console.log(`Dry Run: true (NO MESSAGES WILL BE SENT)\n`);

    const response = await fetch('http://localhost:3000/api/campaigns/linkedin/execute-live', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        campaignId: CAMPAIGN_ID,
        maxProspects: 1,  // Test with just 1 prospect
        dryRun: true      // CRITICAL: Don't actually send
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Request failed:', response.status);
      console.error('Error:', JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log('✅ DRY RUN SUCCESSFUL\n');
    console.log('📊 Results:');
    console.log('==========\n');
    console.log(`Campaign: ${data.campaign_name}`);
    console.log(`Prospects processed: ${data.results.prospects_processed}`);
    console.log(`Execution mode: ${data.execution_mode}\n`);

    if (data.results.messages && data.results.messages.length > 0) {
      data.results.messages.forEach((msg, idx) => {
        console.log(`\n📧 Message ${idx + 1} - ${msg.prospect}`);
        console.log('─'.repeat(80));
        console.log(`Status: ${msg.status}`);
        console.log(`LinkedIn: ${msg.linkedin_target}`);
        console.log(`\n💬 EXACT MESSAGE THAT WOULD BE SENT:`);
        console.log('─'.repeat(80));
        console.log(msg.message);
        console.log('─'.repeat(80));
        console.log(`\nCost: $${msg.cost.toFixed(4)}`);
        console.log(`Model: ${msg.model}\n`);
      });

      console.log('\n✅ VERIFICATION CHECKLIST:');
      console.log('========================');
      console.log('□ Does the message match what you created in SAM template editor?');
      console.log('□ Are variables replaced correctly ({first_name} → actual name)?');
      console.log('□ Is this the EXACT wording you approved?');
      console.log('□ No AI rewrites or generic templates?');
      console.log('\nIf ALL checks pass, the fix is working! ✅');
    } else {
      console.log('⚠️  No messages generated');
      if (data.results.errors && data.results.errors.length > 0) {
        console.log('\n❌ Errors:');
        data.results.errors.forEach(err => {
          console.log(`   - ${err.prospect}: ${err.error}`);
        });
      }
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  }
}

testDryRun();
