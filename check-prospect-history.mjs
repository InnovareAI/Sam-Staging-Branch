import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHistory(campaignId) {
    const { data: prospects, error } = await supabase
        .from('campaign_prospects')
        .select('id, status, updated_at, contacted_at')
        .eq('campaign_id', campaignId)
        .order('updated_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Recent updates for campaign ${campaignId}:`);
    prospects.forEach(p => {
        console.log(`${p.updated_at} | Status: ${p.status} | Contacted: ${p.contacted_at}`);
    });
}

const id = process.argv[2];
if (id) checkHistory(id);
else console.log('Provide campaign ID');
