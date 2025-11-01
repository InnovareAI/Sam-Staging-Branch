#!/usr/bin/env node

/**
 * Track a specific prospect through the campaign pipeline
 */

import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Get prospect name from command line or use most recent
const prospectName = process.argv[2] || 'Brian Lee';

console.log(`🔍 Tracking prospect: ${prospectName}\n`);

try {
  // Search for prospect in campaign_prospects
  const encodedName = encodeURIComponent(`%${prospectName}%`);
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/campaign_prospects?select=*&or=(first_name.ilike.${encodedName},last_name.ilike.${encodedName})&order=contacted_at.desc.nullslast&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  const prospects = await response.json();

  if (!prospects || prospects.length === 0) {
    console.log(`❌ No prospect found matching: ${prospectName}`);
    console.log('\n💡 Try: node scripts/js/track-prospect.mjs "First Last"');
    process.exit(1);
  }

  const prospect = prospects[0];

  console.log('━'.repeat(80));
  console.log('📋 PROSPECT DETAILS');
  console.log('━'.repeat(80));
  console.log(`Name: ${prospect.first_name} ${prospect.last_name}`);
  console.log(`ID: ${prospect.id}`);
  console.log(`Status: ${prospect.status}`);
  console.log(`LinkedIn: ${prospect.linkedin_url || 'N/A'}`);
  console.log(`Email: ${prospect.email || 'N/A'}`);
  console.log(`Company: ${prospect.company_name || 'N/A'}`);
  console.log(`Title: ${prospect.job_title || 'N/A'}`);
  console.log(`\nTimestamps:`);
  console.log(`  Created: ${prospect.created_at}`);
  console.log(`  Updated: ${prospect.updated_at}`);
  console.log(`  Contacted: ${prospect.contacted_at || 'Not contacted yet'}`);

  console.log('\n━'.repeat(80));
  console.log('📊 CAMPAIGN STATUS');
  console.log('━'.repeat(80));

  // Get campaign details
  if (prospect.campaign_id) {
    const campaignResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/campaigns?select=*&id=eq.${prospect.campaign_id}&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const campaigns = await campaignResponse.json();

    if (campaigns && campaigns.length > 0) {
      const campaign = campaigns[0];
      console.log(`Campaign: ${campaign.name}`);
      console.log(`Campaign ID: ${campaign.id}`);
      console.log(`Status: ${campaign.status}`);
      console.log(`Type: ${campaign.channel || 'linkedin'}`);
    }
  } else {
    console.log('⚠️  No campaign associated');
  }

  console.log('\n━'.repeat(80));
  console.log('💬 MESSAGE & PERSONALIZATION DATA');
  console.log('━'.repeat(80));

  if (prospect.personalization_data) {
    const data = prospect.personalization_data;

    console.log('\n📝 Personalization Data:');
    console.log(JSON.stringify(data, null, 2));

    if (data.unipile_message_id) {
      console.log(`\n✅ Unipile Message ID: ${data.unipile_message_id}`);

      // Check if this is a real ID or fallback
      if (data.unipile_message_id.startsWith('untracked_')) {
        console.log('⚠️  This is a FALLBACK tracking ID (Unipile did not return message ID)');
        console.log('   Message was likely sent, but cannot track status in Unipile');
      } else {
        console.log('✅ Real Unipile message ID - can track in Unipile dashboard');
      }
    } else {
      console.log('\n⚠️  No Unipile message ID found');
    }

    if (data.message_content) {
      console.log('\n💬 Message Sent:');
      console.log('─'.repeat(60));
      console.log(data.message_content);
      console.log('─'.repeat(60));
    }
  } else {
    console.log('⚠️  No personalization data found');
  }

  console.log('\n━'.repeat(80));
  console.log('🔍 LINKEDIN CONNECTION STATUS');
  console.log('━'.repeat(80));

  // Check if we can verify on LinkedIn
  if (prospect.linkedin_url) {
    console.log(`\n✅ LinkedIn Profile: ${prospect.linkedin_url}`);
    console.log('\n📝 To verify connection request was sent:');
    console.log('   1. Go to: https://linkedin.com/mynetwork/invitation-manager/sent/');
    console.log(`   2. Search for: ${prospect.first_name} ${prospect.last_name}`);
    console.log('   3. Confirm invitation appears in sent invitations');
  } else {
    console.log('⚠️  No LinkedIn URL available');
  }

  console.log('\n━'.repeat(80));
  console.log('📊 NEXT STEPS');
  console.log('━'.repeat(80));

  if (prospect.status === 'contacted' || prospect.status === 'connection_requested') {
    console.log('\n✅ Connection request sent successfully!');
    console.log('\n📝 Monitoring:');
    console.log('   - Check LinkedIn for connection acceptance');
    console.log('   - System will track replies automatically');
    console.log('   - HITL system will queue replies for approval');
  } else if (prospect.status === 'queued_in_n8n') {
    console.log('\n⏳ Message queued in N8N workflow');
    console.log('\n📝 Check:');
    console.log('   - N8N execution logs: https://innovareai.app.n8n.cloud/executions');
    console.log('   - Wait for status to update to "contacted"');
  } else if (prospect.status === 'failed' || prospect.status === 'error') {
    console.log('\n❌ Campaign execution failed');
    console.log('\n📝 Check:');
    console.log('   - Netlify function logs for errors');
    console.log('   - N8N execution logs for failures');
    console.log('   - Verify Unipile account is active');
  } else {
    console.log(`\n⚠️  Status: ${prospect.status}`);
    console.log('   Check campaign execution logs');
  }

  console.log('\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
