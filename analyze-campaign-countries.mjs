import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeActiveCampaigns() {
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, status')
    .eq('status', 'active');

  if (error) {
    console.error('Error fetching campaigns:', error);
    return;
  }

  console.log(`Analyzing ${campaigns.length} active campaigns:\n`);

  for (const campaign of campaigns) {
    console.log(`Campaign: ${campaign.name} (${campaign.id})`);
    
    const { data: prospects, error: pError } = await supabase
      .from('campaign_prospects')
      .select('country')
      .eq('campaign_id', campaign.id);

    if (pError) {
      console.error(`  Error fetching prospects for ${campaign.id}:`, pError);
      continue;
    }

    const countryCounts = {};
    prospects.forEach(p => {
      const country = p.country || 'Unknown';
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    });

    console.log('  Country distribution:');
    Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([country, count]) => {
        console.log(`    - ${country}: ${count}`);
      });
    console.log('');
  }
}

analyzeActiveCampaigns();
