require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TIMEZONE = 'America/New_York';

function formatTime(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', { timeZone: TIMEZONE });
}

async function getRecentCampaigns() {
    const { data, error } = await supabase
        .from('campaigns')
        .select('created_at, campaign_name, status')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('\n--- Error fetching campaigns ---', error.message);
        return;
    }

    console.log('\n--- 1. Most Recently Created/Updated Campaigns ---');
    if (data.length > 0) {
        data.forEach(c => {
            console.log(`- Campaign: "${c.campaign_name}" (Status: ${c.status.toUpperCase()})`);
            console.log(`  Created:  ${formatTime(c.created_at)} (ET)`);
        });
    } else {
        console.log('No campaigns found.');
    }
}

async function getRecentProspectUpdates() {
    const { data, error } = await supabase
        .from('campaign_prospects')
        .select('updated_at, first_name, last_name, status, campaigns(campaign_name)')
        .order('updated_at', { ascending: false })
        .limit(15);

    if (error) {
        console.error('\n--- Error fetching prospect updates ---', error.message);
        return;
    }

    console.log('\n--- 2. Most Recently Updated Prospects ---');
    if (data.length > 0) {
        data.forEach(p => {
            console.log(`- Prospect: ${p.first_name} ${p.last_name} (Status: ${p.status.toUpperCase()})`);
            console.log(`  Campaign: "${p.campaigns ? p.campaigns.campaign_name : 'N/A'}"`);
            console.log(`  Updated:  ${formatTime(p.updated_at)} (ET)`);
        });
    } else {
        console.log('No prospect updates found.');
    }
}

async function getRecentSendQueueActivity() {
    // We order by the creation time of the queue entry to see what the system tried to do most recently
    const { data, error } = await supabase
        .from('send_queue')
        .select(`
            created_at,
            sent_at,
            status,
            error_message,
            campaign_prospects (
                first_name,
                last_name,
                added_by_unipile_account
            )
        `)
        .order('created_at', { ascending: false })
        .limit(15);

    if (error) {
        console.error('\n--- Error fetching send queue activity ---', error.message);
        return;
    }
    
    console.log('\n--- 3. Most Recent Message Send Activity (Queue Log) ---');
    if (data.length > 0) {
        data.forEach(sq => {
            const p = sq.campaign_prospects;
            const prospectName = p ? `${p.first_name} ${p.last_name}` : 'Unknown Prospect';
            const account = p ? p.added_by_unipile_account : 'Unknown Account';
            
            console.log(`- To: ${prospectName} (From: ${account})`);
            console.log(`  Status:    ${sq.status.toUpperCase()}`);
            console.log(`  Queued At: ${formatTime(sq.created_at)} (ET)`);
            console.log(`  Sent At:   ${formatTime(sq.sent_at)} (ET)`);
            if (sq.status === 'failed') {
                console.log(`  Error:     ${sq.error_message}`);
            }
        });
    } else {
        console.log('No recent send queue activity found.');
    }
}

async function showAllActivity() {
    console.log('Fetching all recent activity from Supabase...');
    await getRecentCampaigns();
    await getRecentProspectUpdates();
    await getRecentSendQueueActivity();
    console.log('\n--- End of Activity Log ---');
}

showAllActivity();
