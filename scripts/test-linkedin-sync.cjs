/**
 * Test script to trigger LinkedIn ID sync for campaign
 * Run with: node scripts/test-linkedin-sync.cjs
 */

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

async function testLinkedInSync() {
  console.log('🔍 Testing LinkedIn ID sync...\n');

  try {
    // Step 1: Find the campaign
    console.log('📋 Step 1: Finding campaign "20251017-BA-Outreach Campaign"...');

    const campaignResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/campaigns?name=eq.20251017-BA-Outreach Campaign`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!campaignResponse.ok) {
      throw new Error(`Failed to fetch campaign: ${campaignResponse.status}`);
    }

    const campaigns = await campaignResponse.json();

    if (campaigns.length === 0) {
      console.log('❌ Campaign not found. Let me search for recent campaigns...');

      const recentResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/campaigns?select=*&order=created_at.desc&limit=5`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const recentCampaigns = await recentResponse.json();
      console.log('\n📊 Recent campaigns:');
      recentCampaigns.forEach((c, idx) => {
        console.log(`${idx + 1}. ${c.name} (ID: ${c.id})`);
        console.log(`   Created: ${c.created_at}`);
        console.log(`   Workspace: ${c.workspace_id}`);
        console.log(`   Status: ${c.status || 'N/A'}\n`);
      });

      if (recentCampaigns.length > 0) {
        console.log('Using most recent campaign for test...');
        campaigns[0] = recentCampaigns[0];
      } else {
        console.log('❌ No campaigns found at all');
        return;
      }
    }

    const campaign = campaigns[0];
    console.log(`✅ Found campaign: ${campaign.name}`);
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Workspace: ${campaign.workspace_id}`);

    // Step 2: Check campaign prospects
    console.log('\n📋 Step 2: Checking campaign prospects...');

    const prospectsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/campaign_prospects?campaign_id=eq.${campaign.id}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const prospects = await prospectsResponse.json();
    console.log(`✅ Found ${prospects.length} prospects in campaign`);

    if (prospects.length > 0) {
      const withIds = prospects.filter(p => p.linkedin_user_id).length;
      const withoutIds = prospects.length - withIds;
      console.log(`   ${withIds} with LinkedIn IDs`);
      console.log(`   ${withoutIds} without LinkedIn IDs (need sync)`);
    }

    // Step 3: Get workspace user for auth
    console.log('\n📋 Step 3: Getting workspace member for auth...');

    const memberResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/workspace_members?workspace_id=eq.${campaign.workspace_id}&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const members = await memberResponse.json();
    if (members.length === 0) {
      throw new Error('No workspace members found');
    }

    const userId = members[0].user_id;
    console.log(`✅ Using user ID: ${userId}`);

    // Step 4: Trigger LinkedIn sync
    console.log('\n📋 Step 4: Triggering LinkedIn ID sync...');
    console.log('This will scan your LinkedIn message history for connections...\n');

    const syncResponse = await fetch('http://localhost:3000/api/linkedin/sync-connections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workspaceId: campaign.workspace_id,
        campaignId: campaign.id,
        userId: userId // For testing
      })
    });

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text();
      throw new Error(`Sync failed: ${syncResponse.status} - ${errorText}`);
    }

    const syncResult = await syncResponse.json();

    console.log('✅ LinkedIn ID Sync Results:');
    console.log(JSON.stringify(syncResult, null, 2));

    // Step 5: Check updated prospects
    console.log('\n📋 Step 5: Checking updated prospects...');

    const updatedProspectsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/campaign_prospects?campaign_id=eq.${campaign.id}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const updatedProspects = await updatedProspectsResponse.json();
    const nowWithIds = updatedProspects.filter(p => p.linkedin_user_id).length;
    const stillWithoutIds = updatedProspects.length - nowWithIds;

    console.log(`\n📊 Final Status:`);
    console.log(`   Total prospects: ${updatedProspects.length}`);
    console.log(`   ✅ With LinkedIn IDs: ${nowWithIds}`);
    console.log(`   ⚠️  Still missing IDs: ${stillWithoutIds}`);

    if (nowWithIds > withIds) {
      console.log(`\n🎉 SUCCESS! Resolved ${nowWithIds - withIds} new LinkedIn IDs!`);
    } else if (stillWithoutIds > 0) {
      console.log(`\n⚠️  ${stillWithoutIds} prospects still need IDs - they may not be in message history`);
    }

  } catch (error) {
    console.error('\n❌ Error testing LinkedIn sync:', error.message);
    console.error(error.stack);
  }
}

testLinkedInSync();
