
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getRecentSentMessagesByAddedBy(accountName) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    console.log(`Searching for prospects added by an account like '${accountName}'...`);
    console.log(`Checking for connection requests sent after ${new Date(twentyFourHoursAgo).toLocaleString('en-US', { timeZone: 'America/New_York' })} (ET)`);
    console.log('---');

    const { data: messages, error: messagesError } = await supabase
        .from('send_queue')
        .select(`
            sent_at,
            status,
            campaign_prospects!inner(
                first_name,
                last_name,
                linkedin_url,
                added_by_unipile_account
            )
        `)
        .eq('status', 'sent')
        .gt('sent_at', twentyFourHoursAgo)
        .ilike('campaign_prospects.added_by_unipile_account', `%${accountName}%`)
        .order('sent_at', { ascending: false });

    if (messagesError) {
        console.error('Error fetching sent messages:', messagesError);
        return;
    }

    if (messages && messages.length > 0) {
        console.log(`--- ${messages.length} Connection Requests Sent by ~'${accountName}' in Last 24 Hours ---`);
        messages.forEach(msg => {
            const prospect = msg.campaign_prospects;
            if (prospect) {
                const sentTime = new Date(msg.sent_at).toLocaleString('en-US', { timeZone: 'America/New_York' });
                console.log(`Prospect: ${prospect.first_name} ${prospect.last_name}`);
                console.log(`LinkedIn: ${prospect.linkedin_url || 'N/A'}`);
                console.log(`Sent At:  ${sentTime} (ET)`);
                console.log(`Account:  ${prospect.added_by_unipile_account}`);
                console.log('----------------------------------------');
            }
        });
    } else {
        console.log(`No connection requests found for an account like '${accountName}' in the last 24 hours.`);
    }
}

getRecentSentMessagesByAddedBy('Irish');
