import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixTestCampaignProspects() {
  try {
    const campaignId = '4c13c7d6-a8a2-400a-8ad7-4d58e1584224';

    console.log('\n🔧 Fixing test campaign prospects with LinkedIn URLs...\n');

    // Get prospects
    const { data: prospects, error } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId);

    if (error) throw error;

    if (prospects.length === 0) {
      console.log('❌ No prospects found');
      return;
    }

    // Update first prospect with test LinkedIn URL
    const { error: error1 } = await supabase
      .from('campaign_prospects')
      .update({
        first_name: 'Saurabh',
        last_name: 'Iyer',
        linkedin_url: 'https://www.linkedin.com/in/saurabh-iyer-b2b-growth',
        email: 'test1@example.com'
      })
      .eq('id', prospects[0].id);

    if (error1) throw error1;

    console.log(`✅ Updated prospect 1: Saurabh Iyer`);
    console.log(`   LinkedIn: https://www.linkedin.com/in/saurabh-iyer-b2b-growth`);

    if (prospects.length > 1) {
      // Update second prospect with test LinkedIn URL
      const { error: error2 } = await supabase
        .from('campaign_prospects')
        .update({
          first_name: 'Rahul',
          last_name: 'Sharma',
          linkedin_url: 'https://www.linkedin.com/in/rahul-sharma-startup',
          email: 'test2@example.com'
        })
        .eq('id', prospects[1].id);

      if (error2) throw error2;

      console.log(`✅ Updated prospect 2: Rahul Sharma`);
      console.log(`   LinkedIn: https://www.linkedin.com/in/rahul-sharma-startup`);
    }

    console.log('\n✅ Test campaign prospects updated!');
    console.log('   You can now activate the campaign to test execution\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixTestCampaignProspects();
