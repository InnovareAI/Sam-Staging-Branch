require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getCampaignProspectsColumns() {
  try {
    const { data, error } = await supabase
      .from('campaign_prospects')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error fetching a sample row:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('--- Sample campaign_prospects row columns ---');
      console.log(Object.keys(data[0]));
    } else {
      console.log('No rows found in campaign_prospects to infer schema.');
    }
  } catch (err) {
    console.error('An unexpected error occurred:', err.message);
  }
}

getCampaignProspectsColumns();
