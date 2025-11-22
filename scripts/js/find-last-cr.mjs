import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findLastCR() {
  const { data: recentProspects } = await supabase
    .from('campaign_prospects')
    .select(`
      id,
      first_name,
      last_name,
      status,
      contacted_at,
      updated_at,
      notes,
      linkedin_url,
      campaign_id,
      campaigns (
        campaign_name,
        linkedin_account_id,
        workspace_accounts!linkedin_account_id (
          account_name
        )
      )
    `)
    .order('updated_at', { ascending: false })
    .limit(20);

  console.log('📊 Most Recent Prospect Activity:\n');

  if (recentProspects) {
    recentProspects.forEach((p, i) => {
      const accountName = p.campaigns?.workspace_accounts?.account_name || 'Unknown';
      const campaignName = p.campaigns?.campaign_name || 'UNNAMED';

      console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`   Account: ${accountName}`);
      console.log(`   Campaign: ${campaignName}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Updated: ${p.updated_at}`);
      console.log(`   Contacted: ${p.contacted_at || 'Never'}`);
      console.log(`   Notes: ${p.notes || 'None'}`);
      console.log('');
    });

    const successful = recentProspects.find(p =>
      p.status === 'connection_request_sent' || p.contacted_at
    );

    if (successful) {
      console.log('\n✅ Last SUCCESSFUL connection request:');
      console.log(`   Name: ${successful.first_name} ${successful.last_name}`);
      console.log(`   Account: ${successful.campaigns?.workspace_accounts?.account_name}`);
      console.log(`   Status: ${successful.status}`);
      console.log(`   Sent: ${successful.contacted_at}`);
    } else {
      console.log('\n❌ No successful connection requests found in recent activity');
    }
  }
}

findLastCR().catch(console.error);
