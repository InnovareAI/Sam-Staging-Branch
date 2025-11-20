import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProspects() {
  // Get the campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, linkedin_account_id')
    .ilike('name', '%New Campaign-Canada%')
    .single();

  if (!campaign) {
    console.log('Campaign not found');
    return;
  }

  console.log(`Campaign: ${campaign.name}`);
  console.log(`Campaign ID: ${campaign.id}`);
  console.log(`LinkedIn Account ID: ${campaign.linkedin_account_id || 'NONE'}\n`);

  // Check if linkedin_account_id is set
  if (!campaign.linkedin_account_id) {
    console.log('⚠️  NO LINKEDIN ACCOUNT CONNECTED TO CAMPAIGN!');
    console.log('This is likely why the campaign is not sending.\n');
  }

  // Get prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url, status')
    .eq('campaign_id', campaign.id)
    .order('created_at', { ascending: false });

  if (!prospects || prospects.length === 0) {
    console.log('No prospects found');
    return;
  }

  console.log(`Total Prospects: ${prospects.length}\n`);

  // Count by linkedin_url presence
  const withUrl = prospects.filter(p => p.linkedin_url);
  const withoutUrl = prospects.filter(p => !p.linkedin_url);

  console.log(`With LinkedIn URL: ${withUrl.length}`);
  console.log(`Without LinkedIn URL: ${withoutUrl.length}\n`);

  if (withoutUrl.length > 0) {
    console.log('⚠️  Prospects WITHOUT LinkedIn URL (will not be contacted):');
    withoutUrl.slice(0, 5).forEach(p => {
      console.log(`  - ${p.first_name} ${p.last_name} (status: ${p.status})`);
    });
    console.log('');
  }

  if (withUrl.length > 0) {
    console.log(`✅ Prospects WITH LinkedIn URL (ready to contact): ${withUrl.length}`);
    console.log('Sample:');
    withUrl.slice(0, 3).forEach(p => {
      console.log(`  - ${p.first_name} ${p.last_name}`);
      console.log(`    URL: ${p.linkedin_url}`);
      console.log(`    Status: ${p.status}\n`);
    });
  }

  // Check LinkedIn account details
  if (campaign.linkedin_account_id) {
    const { data: account } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('id', campaign.linkedin_account_id)
      .single();

    if (account) {
      console.log('LinkedIn Account Details:');
      console.log(`  Name: ${account.account_name}`);
      console.log(`  Unipile ID: ${account.unipile_account_id}`);
      console.log(`  Connection: ${account.connection_status}`);
      console.log(`  Active: ${account.is_active}`);
    } else {
      console.log('⚠️  LinkedIn account not found!');
    }
  }
}

checkProspects().catch(console.error);
