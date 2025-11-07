const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkYacoub() {
  console.log('🔍 Checking Yousef Yacoub data...\n');

  // Check in prospect_approval_data
  const { data: approvalData, error: approvalError } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .ilike('name', '%yacoub%')
    .limit(5);

  if (approvalError) {
    console.error('❌ Error fetching approval data:', approvalError.message);
  } else {
    console.log('📋 Prospect Approval Data:');
    approvalData.forEach(p => {
      console.log(`  Name: "${p.name}"`);
      console.log(`  LinkedIn: ${p.linkedin_url || p.contact?.linkedin_url}`);
      console.log(`  Contact: ${JSON.stringify(p.contact, null, 2)}`);
      console.log('');
    });
  }

  // Check in campaign_prospects
  const { data: campaignData, error: campaignError } = await supabase
    .from('campaign_prospects')
    .select('*')
    .ilike('linkedin_url', '%yacoub%')
    .limit(5);

  if (campaignError) {
    console.error('❌ Error fetching campaign data:', campaignError.message);
  } else {
    console.log('\n📊 Campaign Prospects Data:');
    campaignData.forEach(p => {
      console.log(`  First Name: "${p.first_name}"`);
      console.log(`  Last Name: "${p.last_name}"`);
      console.log(`  LinkedIn: ${p.linkedin_url}`);
      console.log('');
    });
  }
}

checkYacoub().catch(console.error);
