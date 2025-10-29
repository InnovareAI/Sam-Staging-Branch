#!/usr/bin/env node
/**
 * Test if cron endpoint query can see campaign "test 1"
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function main() {
  console.log('Testing cron endpoint query...\n');

  // EXACT query from cron endpoint (line 41-61)
  const { data: pendingProspects, error: queryError } = await supabase
    .from('campaign_prospects')
    .select(`
      id,
      campaign_id,
      first_name,
      last_name,
      company_name,
      linkedin_url,
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
    .in('campaigns.status', ['active', 'scheduled'])
    .limit(100); // Increased limit to see all

  if (queryError) {
    console.error('❌ Error:', queryError.message);
    return;
  }

  console.log('Total prospects found:', pendingProspects.length);
  console.log('');

  // Group by campaign
  const byCampaign = {};
  pendingProspects.forEach(p => {
    const name = p.campaigns?.name || 'Unknown';
    const id = p.campaign_id;
    if (!byCampaign[id]) {
      byCampaign[id] = {
        name: name,
        status: p.campaigns?.status,
        count: 0,
        prospects: []
      };
    }
    byCampaign[id].count++;
    byCampaign[id].prospects.push({
      id: p.id,
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'NO NAME'
    });
  });

  console.log('Campaigns with pending prospects:');
  Object.entries(byCampaign).forEach(([id, data]) => {
    console.log(`\n  Campaign: ${data.name}`);
    console.log(`  ID: ${id}`);
    console.log(`  Status: ${data.status}`);
    console.log(`  Pending: ${data.count}`);
    console.log(`  Prospects:`);
    data.prospects.slice(0, 3).forEach(p => {
      console.log(`    - ${p.name}`);
    });
    if (data.prospects.length > 3) {
      console.log(`    ... and ${data.prospects.length - 3} more`);
    }
  });

  // Check if test 1 is in the results
  console.log('\n');
  const test1Id = '6e557b76-7a46-4762-b6d9-cf2fa8e19739';
  if (byCampaign[test1Id]) {
    console.log('✅ Campaign "test 1" IS detected by cron query');
  } else {
    console.log('❌ Campaign "test 1" NOT detected by cron query');
    console.log('This is why there\'s NO MOVEMENT!');
  }
}

main().catch(console.error);
