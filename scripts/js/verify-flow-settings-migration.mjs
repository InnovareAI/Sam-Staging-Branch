#!/usr/bin/env node
/**
 * Verify flow_settings migration was successful
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Verifying flow_settings migration...\n');

async function verify() {
  try {
    // Test 1: Check if we can query flow_settings
    console.log('1️⃣  Testing flow_settings column...');
    const { data: campaigns, error: queryError } = await supabase
      .from('campaigns')
      .select('id, name, flow_settings, metadata')
      .limit(1);

    if (queryError) {
      console.error('   ❌ Cannot query flow_settings:', queryError.message);
      return false;
    }

    console.log('   ✅ flow_settings column exists and is queryable');

    // Test 2: Insert a test campaign
    console.log('\n2️⃣  Creating test campaign with flow_settings...');

    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id')
      .limit(1);

    if (!workspaces || workspaces.length === 0) {
      console.log('   ⚠️  No workspaces found, skipping insert test');
      return true;
    }

    const testCampaign = {
      workspace_id: workspaces[0].id,
      name: `Test Flow Campaign ${Date.now()}`,
      status: 'draft',
      flow_settings: {
        campaign_type: 'linkedin_dm',
        message_wait_days: 5,
        messages: {
          message_1: 'Hi {first_name}, great connecting!',
          message_2: 'Following up on my last message...',
          message_3: 'One more thing...'
        }
      },
      metadata: {
        test: true,
        created_by: 'verification_script'
      }
    };

    const { data: inserted, error: insertError } = await supabase
      .from('campaigns')
      .insert(testCampaign)
      .select()
      .single();

    if (insertError) {
      console.error('   ❌ Insert failed:', insertError.message);
      return false;
    }

    console.log('   ✅ Test campaign created:', inserted.id);
    console.log('   ✅ Campaign type:', inserted.flow_settings.campaign_type);
    console.log('   ✅ Message count:', Object.values(inserted.flow_settings.messages).filter(m => m).length);

    // Test 3: Query by campaign_type
    console.log('\n3️⃣  Testing flow_settings queries...');
    const { data: dmCampaigns, error: filterError } = await supabase
      .from('campaigns')
      .select('id, name, flow_settings')
      .eq('flow_settings->>campaign_type', 'linkedin_dm')
      .limit(5);

    if (filterError) {
      console.error('   ❌ Query failed:', filterError.message);
      return false;
    }

    console.log(`   ✅ Found ${dmCampaigns.length} LinkedIn DM campaigns`);

    // Test 4: A/B test metadata query
    console.log('\n4️⃣  Testing metadata A/B test queries...');
    const { data: abTests, error: abError } = await supabase
      .from('campaigns')
      .select('id, name, metadata')
      .not('metadata->ab_test_group', 'is', null)
      .limit(5);

    if (abError) {
      console.error('   ❌ A/B test query failed:', abError.message);
      return false;
    }

    console.log(`   ✅ Metadata queries working (found ${abTests.length} A/B test campaigns)`);

    // Cleanup: Delete test campaign
    console.log('\n5️⃣  Cleaning up test data...');
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', inserted.id);

    if (deleteError) {
      console.log('   ⚠️  Could not delete test campaign:', deleteError.message);
    } else {
      console.log('   ✅ Test campaign deleted');
    }

    return true;

  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    return false;
  }
}

verify().then(success => {
  if (success) {
    console.log('\n🎉 Migration verification PASSED!');
    console.log('\n✅ Next steps:');
    console.log('   1. Build production code: npm run build');
    console.log('   2. Test SAM campaign creation');
    console.log('   3. Deploy to production');
    process.exit(0);
  } else {
    console.log('\n❌ Migration verification FAILED');
    console.log('   Please check the errors above');
    process.exit(1);
  }
});
