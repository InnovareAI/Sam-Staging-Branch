#!/usr/bin/env node

/**
 * Check N8N Execution and Unipile Response
 * Investigates why message shows as sent but not in LinkedIn
 */

import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const N8N_API_URL = process.env.N8N_API_URL || 'https://innovareai.app.n8n.cloud';
const N8N_API_KEY = process.env.N8N_API_KEY;

const executionId = process.argv[2] || '234802';

console.log(`🔍 Investigating N8N Execution: ${executionId}\n`);

try {
  // Step 1: Get the most recent campaign prospect
  console.log('📋 Step 1: Getting most recent campaign execution...\n');

  const prospectsResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/campaign_prospects?select=*&order=contacted_at.desc.nullslast&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  const prospects = await prospectsResponse.json();

  if (!prospects || prospects.length === 0) {
    console.log('❌ No recent campaign prospects found');
    process.exit(1);
  }

  const prospect = prospects[0];

  console.log('✅ Most Recent Prospect:');
  console.log(`   Name: ${prospect.first_name} ${prospect.last_name}`);
  console.log(`   Status: ${prospect.status}`);
  console.log(`   Contacted: ${prospect.contacted_at}`);
  console.log(`   LinkedIn: ${prospect.linkedin_url || 'N/A'}`);

  // Step 2: Check personalization data for Unipile response
  console.log('\n━'.repeat(40));
  console.log('📊 Step 2: Analyzing Personalization Data...\n');

  if (prospect.personalization_data) {
    const data = prospect.personalization_data;

    console.log('Full Personalization Data:');
    console.log(JSON.stringify(data, null, 2));

    if (data.unipile_message_id) {
      console.log(`\n📨 Unipile Message ID: ${data.unipile_message_id}`);

      if (data.unipile_message_id.startsWith('untracked_')) {
        console.log('\n⚠️  This is a FALLBACK ID - Unipile did NOT return a message ID!');
        console.log('   This means:');
        console.log('   1. Unipile API returned 200 (success)');
        console.log('   2. But no message ID was found in the response');
        console.log('   3. Message may NOT have been sent to LinkedIn');
      }
    }

    if (data.unipile_response) {
      console.log('\n📋 Raw Unipile API Response:');
      console.log(JSON.stringify(data.unipile_response, null, 2));
    }

    if (data.message_content) {
      console.log('\n💬 Message That Was Attempted:');
      console.log('─'.repeat(60));
      console.log(data.message_content);
      console.log('─'.repeat(60));
    }
  } else {
    console.log('⚠️  No personalization data found');
  }

  // Step 3: Check workspace account (Michelle's account)
  console.log('\n━'.repeat(40));
  console.log('📊 Step 3: Checking LinkedIn Account Status...\n');

  if (prospect.campaign_id) {
    // Get campaign to find workspace
    const campaignResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/campaigns?select=workspace_id&id=eq.${prospect.campaign_id}&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const campaigns = await campaignResponse.json();

    if (campaigns && campaigns.length > 0) {
      const workspaceId = campaigns[0].workspace_id;

      // Get workspace accounts
      const accountsResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/workspace_accounts?select=*&workspace_id=eq.${workspaceId}&provider=eq.linkedin&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );

      const accounts = await accountsResponse.json();

      if (accounts && accounts.length > 0) {
        const account = accounts[0];
        console.log('✅ LinkedIn Account Found:');
        console.log(`   Account ID: ${account.id}`);
        console.log(`   Provider: ${account.provider}`);
        console.log(`   Status: ${account.status || 'active'}`);
        console.log(`   Unipile Account ID: ${account.unipile_account_id || 'N/A'}`);
        console.log(`   Created: ${account.created_at}`);

        if (!account.unipile_account_id) {
          console.log('\n❌ ISSUE: No Unipile Account ID!');
          console.log('   This means the LinkedIn account is not properly connected to Unipile');
          console.log('   Messages cannot be sent without Unipile integration');
        }
      } else {
        console.log('❌ No LinkedIn account found for this workspace');
      }
    }
  }

  // Step 4: Diagnosis
  console.log('\n━'.repeat(40));
  console.log('🔍 DIAGNOSIS');
  console.log('━'.repeat(40));

  console.log('\nPossible Reasons Message Not in LinkedIn:');
  console.log('\n1. ⚠️  Unipile API Success but No Message ID');
  console.log('   - Unipile returned 200 (success)');
  console.log('   - But did not actually send the message');
  console.log('   - This is the "header auth is missing" issue we saw before');
  console.log('   - Fix: Check Unipile account credentials');

  console.log('\n2. ⚠️  LinkedIn Account Session Expired');
  console.log('   - Unipile account needs re-authentication');
  console.log('   - LinkedIn session token expired');
  console.log('   - Fix: Reconnect LinkedIn in workspace settings');

  console.log('\n3. ⚠️  Wrong Account Used');
  console.log('   - Message sent from different account than expected');
  console.log('   - Check: Log into correct LinkedIn account');

  console.log('\n4. ⚠️  Message in Different Folder');
  console.log('   - LinkedIn has multiple message locations:');
  console.log('     • Sent connection requests: /mynetwork/invitation-manager/sent/');
  console.log('     • Sent messages: /messaging/');
  console.log('   - Check both locations');

  console.log('\n━'.repeat(40));
  console.log('🔧 RECOMMENDED ACTIONS');
  console.log('━'.repeat(40));

  console.log('\n1. Check Unipile Dashboard:');
  console.log('   - Log into Unipile');
  console.log('   - View sent messages');
  console.log('   - Confirm message appears there');

  console.log('\n2. Check N8N Execution Logs:');
  console.log(`   - Go to: ${N8N_API_URL}/executions`);
  console.log(`   - Find execution ID: ${executionId}`);
  console.log('   - Review "Send LinkedIn Invitation" node');
  console.log('   - Check actual API response from Unipile');

  console.log('\n3. Verify LinkedIn Session:');
  console.log('   - Go to workspace settings');
  console.log('   - Check LinkedIn integration status');
  console.log('   - Reconnect if needed');

  console.log('\n4. Test with Manual Message:');
  console.log('   - Try sending a test message via Unipile dashboard');
  console.log('   - If that works, issue is in workflow');
  console.log('   - If that fails, issue is Unipile/LinkedIn connection');

  console.log('\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
