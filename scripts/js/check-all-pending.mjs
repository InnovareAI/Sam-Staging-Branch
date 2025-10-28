import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking ALL pending prospects across all campaigns...\n');

// Get ALL campaigns with pending prospects
const { data: allPending } = await supabase
  .from('campaign_prospects')
  .select(`
    id,
    first_name,
    last_name,
    company_name,
    status,
    linkedin_url,
    contacted_at,
    created_at,
    campaigns (
      id,
      name,
      status,
      workspace_id
    )
  `)
  .in('status', ['pending', 'approved', 'ready_to_message'])
  .not('linkedin_url', 'is', null)
  .order('created_at', { ascending: false });

console.log(`Found ${allPending?.length || 0} prospects with eligible status\n`);

if (allPending && allPending.length > 0) {
  const byCampaign = {};
  for (const p of allPending) {
    const cid = p.campaigns.id;
    if (!byCampaign[cid]) {
      byCampaign[cid] = {
        campaign: p.campaigns,
        prospects: []
      };
    }
    byCampaign[cid].prospects.push(p);
  }

  for (const [cid, data] of Object.entries(byCampaign)) {
    const { campaign, prospects } = data;
    console.log(`📊 Campaign: ${campaign.name}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Pending prospects: ${prospects.length}`);

    for (const p of prospects.slice(0, 3)) {
      console.log(`   - ${p.first_name} ${p.last_name} at ${p.company_name}`);
      console.log(`     Status: ${p.status}`);
      console.log(`     LinkedIn: ${p.linkedin_url ? 'YES' : 'NO'}`);
      console.log(`     Created: ${new Date(p.created_at).toLocaleString()}`);
    }
    if (prospects.length > 3) {
      console.log(`   ... and ${prospects.length - 3} more`);
    }
    console.log('');
  }
} else {
  console.log('✅ No pending prospects found - all have been processed!');
}

// Check LinkedIn verification
console.log('\n🔍 Checking recent connection requests sent...');
const { data: recentSent } = await supabase
  .from('campaign_prospects')
  .select('first_name, last_name, company_name, contacted_at, status')
  .eq('status', 'already_invited')
  .gte('contacted_at', new Date(Date.now() - 3600000).toISOString())
  .order('contacted_at', { ascending: false })
  .limit(10);

console.log(`\nSent in last hour: ${recentSent?.length || 0}\n`);
for (const p of recentSent || []) {
  console.log(`✅ ${p.first_name} ${p.last_name} at ${p.company_name}`);
  console.log(`   Sent: ${new Date(p.contacted_at).toLocaleString()}`);
}
