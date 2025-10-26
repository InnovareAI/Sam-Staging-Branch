import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCampaignProspects() {
  try {
    // Find the most recent campaign
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, status, campaign_type, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (campaignError) throw campaignError;

    console.log('\n📊 Recent Campaigns:');
    console.log('='.repeat(80));
    campaigns.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name}`);
      console.log(`   ID: ${c.id}`);
      console.log(`   Type: ${c.campaign_type || 'N/A'}`);
      console.log(`   Status: ${c.status}`);
      console.log(`   Created: ${new Date(c.created_at).toLocaleString()}\n`);
    });

    if (campaigns.length === 0) {
      console.log('❌ No campaigns found');
      return;
    }

    // Check the most recent campaign
    const targetCampaign = campaigns[0];
    console.log(`\n🔍 Checking campaign: ${targetCampaign.name}`);
    console.log('='.repeat(80));

    // Get all prospects for this campaign
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', targetCampaign.id);

    if (prospectsError) throw prospectsError;

    console.log(`\n📋 Total prospects: ${prospects.length}`);

    if (prospects.length === 0) {
      console.log('❌ No prospects found for this campaign');
      return;
    }

    // Analyze prospects
    const withLinkedInUrl = prospects.filter(p => p.linkedin_url);
    const withLinkedInUserId = prospects.filter(p => p.linkedin_user_id);
    const withEither = prospects.filter(p => p.linkedin_url || p.linkedin_user_id);

    console.log(`\n📊 Prospect Analysis:`);
    console.log(`   With linkedin_url: ${withLinkedInUrl.length}`);
    console.log(`   With linkedin_user_id: ${withLinkedInUserId.length}`);
    console.log(`   With either (executable): ${withEither.length}`);

    // Show first prospect details
    if (prospects.length > 0) {
      const p = prospects[0];
      console.log(`\n👤 First Prospect Details:`);
      console.log(`   Name: ${p.first_name} ${p.last_name}`);
      console.log(`   Company: ${p.company_name || 'N/A'}`);
      console.log(`   Email: ${p.email || 'N/A'}`);
      console.log(`   LinkedIn URL: ${p.linkedin_url || 'MISSING ❌'}`);
      console.log(`   LinkedIn User ID: ${p.linkedin_user_id || 'MISSING ❌'}`);
      console.log(`   Status: ${p.status}`);
    }

    // Check workspace LinkedIn accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', targetCampaign.workspace_id)
      .eq('account_type', 'linkedin');

    if (accountsError) throw accountsError;

    console.log(`\n🔗 LinkedIn Accounts:`);
    console.log(`   Total: ${accounts.length}`);
    const connectedAccounts = accounts.filter(a => a.connection_status === 'connected');
    console.log(`   Connected: ${connectedAccounts.length}`);

    if (connectedAccounts.length > 0) {
      console.log(`\n   ✅ Connected Accounts:`);
      connectedAccounts.forEach(a => {
        console.log(`      - ${a.account_name} (${a.unipile_account_id})`);
      });
    } else {
      console.log(`\n   ❌ No connected LinkedIn accounts found!`);
    }

    // Final diagnosis
    console.log(`\n🔍 DIAGNOSIS:`);
    console.log('='.repeat(80));

    if (withEither.length === 0) {
      console.log('❌ PROBLEM: No prospects have linkedin_url or linkedin_user_id');
      console.log('   SOLUTION: Prospects need either:');
      console.log('   - linkedin_url (e.g., "https://www.linkedin.com/in/username")');
      console.log('   - linkedin_user_id (internal Unipile ID)');
    } else if (connectedAccounts.length === 0) {
      console.log('❌ PROBLEM: No connected LinkedIn accounts');
      console.log('   SOLUTION: Connect a LinkedIn account in workspace settings');
    } else {
      console.log('✅ Campaign setup looks correct');
      console.log(`   - ${withEither.length} executable prospects`);
      console.log(`   - ${connectedAccounts.length} connected LinkedIn account(s)`);
      console.log('   Check server logs for execution errors');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkCampaignProspects();
