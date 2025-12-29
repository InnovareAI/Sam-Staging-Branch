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
            .select('location')
            .eq('campaign_id', campaign.id);

        if (pError) {
            console.error(`  Error fetching prospects for ${campaign.id}:`, pError);
            continue;
        }

        const locationCounts = {};
        prospects.forEach(p => {
            const location = p.location || 'Unknown';
            locationCounts[location] = (locationCounts[location] || 0) + 1;
        });

        console.log('  Location distribution (top 5):');
        Object.entries(locationCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([location, count]) => {
                console.log(`    - ${location}: ${count}`);
            });
        console.log('');
    }
}

analyzeActiveCampaigns();
