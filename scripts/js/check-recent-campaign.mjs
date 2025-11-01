#!/usr/bin/env node

/**
 * Check Recent Campaign Execution
 * Shows the most recent campaign prospects and their status
 */

import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Checking recent campaign executions...\n');

try {
  // Get most recent campaign prospects
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/campaign_prospects?select=id,first_name,last_name,status,contacted_at,campaign_id,personalization_data&order=contacted_at.desc.nullslast&limit=10`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  const prospects = await response.json();

  if (!prospects || prospects.length === 0) {
    console.log('❌ No campaign prospects found');
    process.exit(0);
  }

  console.log(`✅ Found ${prospects.length} recent campaign prospects:\n`);
  console.log('━'.repeat(80));

  for (const prospect of prospects) {
    console.log(`\n👤 ${prospect.first_name} ${prospect.last_name}`);
    console.log(`   Status: ${prospect.status}`);
    console.log(`   Contacted: ${prospect.contacted_at || 'Not contacted yet'}`);
    console.log(`   Campaign ID: ${prospect.campaign_id}`);

    if (prospect.personalization_data) {
      const data = prospect.personalization_data;

      if (data.unipile_message_id) {
        console.log(`   ✅ Unipile Message ID: ${data.unipile_message_id}`);
      }

      if (data.unipile_response) {
        console.log(`   📋 Unipile Response: ${JSON.stringify(data.unipile_response).substring(0, 100)}...`);
      }

      if (data.message_content) {
        console.log(`   💬 Message Preview: "${data.message_content.substring(0, 80)}..."`);
      }
    }
  }

  console.log('\n' + '━'.repeat(80));

  // Get campaign info for the most recent
  if (prospects[0].campaign_id) {
    console.log('\n📊 Getting campaign details...\n');

    const campaignResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/campaigns?select=id,name,status,created_at&id=eq.${prospects[0].campaign_id}&limit=1`,
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
      console.log(`📋 Campaign: ${campaign.name}`);
      console.log(`   Status: ${campaign.status}`);
      console.log(`   Created: ${campaign.created_at}`);

      // Count prospects by status for this campaign
      const statusResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/campaign_prospects?select=status&campaign_id=eq.${campaign.id}`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );

      const allProspects = await statusResponse.json();
      const statusCounts = {};

      allProspects.forEach(p => {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      });

      console.log('\n📊 Prospect Status Breakdown:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
    }
  }

  console.log('\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
