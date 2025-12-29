import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaign(id) {
    const { data: campaign, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Campaign details:', campaign);

    const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('location')
        .eq('campaign_id', id)
        .limit(5);

    console.log('Sample locations:', prospects?.map(p => p.location));
}

const id = process.argv[2];
if (id) checkCampaign(id);
else console.log('Please provide a campaign ID');
