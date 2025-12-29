import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findActiveWithoutQueue() {
    const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('id, name, status, country_code')
        .eq('status', 'active');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Checking ${campaigns.length} active campaigns...\n`);

    for (const campaign of campaigns) {
        const { count, error: qError } = await supabase
            .from('send_queue')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .eq('status', 'pending');

        if (qError) {
            console.error(`Error for ${campaign.id}:`, qError);
            continue;
        }

        if (count === 0) {
            console.log(`⚠️  Campaign "${campaign.name}" (${campaign.country_code}) has NO pending messages in queue.`);

            // Check if it has prospects that NEED queueing
            const { count: pCount } = await supabase
                .from('campaign_prospects')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', campaign.id)
                .in('status', ['pending', 'approved']);

            if (pCount > 0) {
                console.log(`    - BUT it has ${pCount} prospects waiting for queueing!`);
            } else {
                console.log(`    - And no prospects waiting (probably finished or empty).`);
            }
            console.log('');
        }
    }
}

findActiveWithoutQueue();
