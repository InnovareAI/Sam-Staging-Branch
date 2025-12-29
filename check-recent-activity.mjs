import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRecentActivity() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    console.log(`Checking campaign activity since ${yesterday}...\n`);

    // Count prospects contacted or status changed recently
    const { data: recentProspects, error } = await supabase
        .from('campaign_prospects')
        .select('campaign_id, status, updated_at, contacted_at')
        .gt('updated_at', yesterday);

    if (error) {
        console.error('Error fetching recent activity:', error);
        return;
    }

    if (recentProspects.length === 0) {
        console.log('No recent activity found in campaign_prospects.');
    } else {
        const campaignStats = {};
        recentProspects.forEach(p => {
            if (!campaignStats[p.campaign_id]) {
                campaignStats[p.campaign_id] = { total: 0, statuses: {} };
            }
            campaignStats[p.campaign_id].total++;
            campaignStats[p.campaign_id].statuses[p.status] = (campaignStats[p.campaign_id].statuses[p.status] || 0) + 1;
        });

        for (const [campaignId, stats] of Object.entries(campaignStats)) {
            const { data: campaign } = await supabase
                .from('campaigns')
                .select('name')
                .eq('id', campaignId)
                .single();

            console.log(`Campaign: ${campaign?.name || 'Unknown'} (${campaignId})`);
            console.log(`  Recent updates: ${stats.total}`);
            console.log(`  Statuses: ${JSON.stringify(stats.statuses)}`);
            console.log('');
        }
    }
}

checkRecentActivity();
