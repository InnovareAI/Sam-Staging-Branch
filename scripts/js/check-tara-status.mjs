import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import moment from 'moment-timezone';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTara() {
    console.log('🔍 Checking Prospect: Tara Ariyath...');

    const { data: prospects, error } = await supabase
        .from('campaign_prospects')
        .select(`
      id, 
      first_name, 
      last_name, 
      status, 
      linkedin_url,
      contacted_at, 
      connection_accepted_at,
      follow_up_due_at, 
      updated_at,
      campaigns(campaign_name, workspace_id),
      personalization_data
    `)
        .or('first_name.ilike.%Tara%,last_name.ilike.%Ariyath%');

    if (error) {
        console.error('Error fetching prospect:', error);
        return;
    }

    if (!prospects || prospects.length === 0) {
        console.log('❌ Prospect not found.');
        return;
    }

    prospects.forEach(p => {
        const campaignName = p.campaigns?.campaign_name || 'Unknown';
        const updated = moment(p.updated_at).tz('America/New_York').format('MM/DD HH:mm');

        console.log(`\n👤 ${p.first_name} ${p.last_name}`);
        console.log(`   Campaign: ${campaignName}`);
        console.log(`   Status: ${p.status}`);
        console.log(`   LinkedIn URL: ${p.linkedin_url}`);
        console.log(`   Provider ID: ${p.personalization_data?.provider_id || 'N/A'}`);
        console.log(`   Updated: ${updated}`);
        console.log(`   Accepted At: ${p.connection_accepted_at || 'N/A'}`);
    });
}

checkTara().catch(console.error);
