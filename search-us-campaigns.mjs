import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function searchUSCampaigns() {
    console.log('Searching for campaigns with "US" or "USA" in name...\n');

    const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('id, name, status, created_at')
        .or('name.ilike.%US%,name.ilike.%USA%,name.ilike.%United States%')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching campaigns:', error);
        return;
    }

    console.log(`Found ${campaigns.length} US-related campaigns:`);

    for (const campaign of campaigns) {
        console.log(`${campaign.created_at} | ${campaign.name} | Status: ${campaign.status} | ID: ${campaign.id}`);

        // Check if there are any prospects for this campaign
        const { count, error: countError } = await supabase
            .from('campaign_prospects')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id);

        if (countError) {
            console.error(`  Error counting prospects: ${countError.message}`);
        } else {
            console.log(`  Total prospects: ${count}`);
        }

        // Check status distribution of prospects
        const { data: statusCounts, error: statusError } = await supabase
            .from('campaign_prospects')
            .select('status')
            .eq('campaign_id', campaign.id);

        if (!statusError) {
            const counts = {};
            statusCounts.forEach(s => counts[s.status] = (counts[s.status] || 0) + 1);
            console.log(`  Status distribution: ${JSON.stringify(counts)}`);
        }
        console.log('');
    }
}

searchUSCampaigns();
