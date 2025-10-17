/**
 * Delete dummy/test campaigns
 * Run with: node scripts/delete-dummy-campaigns.cjs
 */
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function deleteDummyCampaigns() {
  try {
    console.log('🗑️  Deleting dummy campaigns...\n');

    const dummyCampaignIds = [
      'a61d5341-3809-4dad-9b06-0fdb7ab85eae', // 20251017-IAI-test 53
      '5643f3b9-db49-4318-8dd4-007da251edf5', // 20251017-IAI-test 51
      'b864d8cc-d224-46c9-8218-3f3a46e91eac', // 20251017-IAI-test 51
      '914f9a93-4945-4008-b2f5-05929360787d', // 20251017-IAI-test 51
      '5e05960b-fa25-4324-a0d8-0560d21af19a', // 20251017-IAI-test 51
      '13d51f0a-ded3-42ef-bd45-56a04336a9f9', // 20251017-IAI-test 51
      'c44603ca-9a3a-4553-96e2-8866e4031eb3', // 20251016-IAI-test 50
      '5d3d528a-cd75-4d56-982a-6d09ca9f17e9', // 20251016-IAI-test 50
      '23a917db-326e-48e9-85a3-4cffb6966935'  // 20251016-IAI-test 50
    ];

    console.log(`Deleting ${dummyCampaignIds.length} dummy campaigns...\n`);

    // Delete campaigns (will cascade to prospects, messages, etc.)
    const { data, error } = await supabase
      .from('campaigns')
      .delete()
      .in('id', dummyCampaignIds);

    if (error) {
      console.error('❌ Error deleting campaigns:', error);
      return;
    }

    console.log('✅ Successfully deleted dummy campaigns!');
    console.log(`   ${dummyCampaignIds.length} campaigns removed`);
    console.log('   Associated prospects, messages, and analytics also deleted (cascaded)');

    // Verify deletion
    const { data: remaining, error: checkError } = await supabase
      .from('campaigns')
      .select('id, name')
      .in('id', dummyCampaignIds);

    if (checkError) {
      console.error('⚠️  Could not verify deletion:', checkError);
      return;
    }

    if (remaining && remaining.length > 0) {
      console.log(`\n⚠️  ${remaining.length} campaigns were not deleted:`);
      remaining.forEach(c => console.log(`   - ${c.name} (${c.id})`));
    } else {
      console.log('\n✅ Verified: All dummy campaigns successfully removed!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

deleteDummyCampaigns();
