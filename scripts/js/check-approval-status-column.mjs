import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProspectDetails() {
  try {
    // Get the most recent campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, workspace_id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (campaignError) throw campaignError;

    console.log(`\n🔍 Campaign: ${campaign.name}`);
    console.log(`   ID: ${campaign.id}\n`);

    // Get prospect details
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaign.id);

    if (prospectsError) throw prospectsError;

    if (prospects.length === 0) {
      console.log('❌ No prospects found');
      return;
    }

    const prospect = prospects[0];
    console.log('👤 Prospect Details:');
    console.log(`   Name: ${prospect.first_name || 'Unknown'} ${prospect.last_name || 'Unknown'}`);
    console.log(`   LinkedIn: ${prospect.linkedin_url || 'N/A'}`);
    console.log(`   Status: ${prospect.status}`);
    console.log(`   Contacted At: ${prospect.contacted_at || 'Never'}`);

    if (prospect.personalization_data) {
      console.log(`\n📝 Personalization Data:`);
      console.log(JSON.stringify(prospect.personalization_data, null, 2));
    }

    // Check workspace accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', campaign.workspace_id)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected');

    if (accountsError) throw accountsError;

    console.log(`\n🔗 Connected LinkedIn Accounts: ${accounts.length}`);
    if (accounts.length > 0) {
      accounts.forEach(a => {
        console.log(`   - ${a.account_name || 'Unnamed'}`);
        console.log(`     Unipile ID: ${a.unipile_account_id}`);
        console.log(`     Status: ${a.connection_status}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkProspectDetails();
