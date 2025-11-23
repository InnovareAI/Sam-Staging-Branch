require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TIMEZONE = 'America/New_York';

function formatTime(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', { timeZone: TIMEZONE });
}

async function getScheduledFollowUps() {
    const now = new Date().toISOString();

    console.log('Searching for scheduled follow-up messages in Supabase...');
    console.log(`Current Time: ${formatTime(now)} (ET)`);
    console.log('---');

    const { data: followUps, error } = await supabase
        .from('send_queue')
        .select(`
            id,
            scheduled_for,
            status,
            campaign_prospects (
                first_name,
                last_name,
                status,
                connection_accepted_at,
                follow_up_due_at,
                follow_up_sequence_index,
                linkedin_url,
                added_by_unipile_account
            )
        `)
        .eq('status', 'pending') // Only show messages that are still pending
        .gt('scheduled_for', now) // Only show messages scheduled for the future
        .order('scheduled_for', { ascending: true });

    if (error) {
        console.error('\n--- Error fetching scheduled follow-ups ---', error.message);
        return;
    }

    const filteredFollowUps = followUps.filter(fu => 
        fu.campaign_prospects && 
        (fu.campaign_prospects.status === 'connected' || fu.campaign_prospects.status === 'replied')
    );

    if (filteredFollowUps.length > 0) {
        console.log(`--- ${filteredFollowUps.length} Scheduled Follow-Up Messages ---`);
        filteredFollowUps.forEach(fu => {
            const prospect = fu.campaign_prospects;
            console.log(`- To: ${prospect.first_name} ${prospect.last_name}`);
            console.log(`  Account:       ${prospect.added_by_unipile_account || 'N/A'}`);
            console.log(`  Prospect Status: ${prospect.status.toUpperCase()}`);
            console.log(`  LinkedIn:      ${prospect.linkedin_url || 'N/A'}`);
            console.log(`  Accepted At:   ${formatTime(prospect.connection_accepted_at)} (ET)`);
            console.log(`  Follow-Up Due: ${formatTime(prospect.follow_up_due_at)} (ET)`);
            console.log(`  Scheduled Send: ${formatTime(fu.scheduled_for)} (ET)`);
            console.log(`  Sequence Index: ${prospect.follow_up_sequence_index || 'N/A'}`);
            console.log('----------------------------------------');
        });
    } else {
        console.log('No scheduled follow-up messages found.');
    }
}

getScheduledFollowUps();
