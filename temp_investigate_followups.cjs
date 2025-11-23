require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TIMEZONE = 'America/New_York';

function formatTime(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', { timeZone: TIMEZONE });
}

async function investigateConnectedProspects() {
    console.log('Investigating prospects with status "connected" to diagnose missing follow-ups...');
    console.log('---');

    const { data: prospects, error } = await supabase
        .from('campaign_prospects')
        .select(`
            first_name,
            last_name,
            status,
            connection_accepted_at,
            follow_up_due_at,
            follow_up_sequence_index,
            campaign_id,
            campaigns ( * )
        `)
        .in('status', ['connected', 'replied']);

    if (error) {
        console.error('\n--- Error fetching connected prospects ---', error.message);
        return;
    }

    if (prospects && prospects.length > 0) {
        console.log(`Found ${prospects.length} connected prospects. Analyzing each...`);
        prospects.forEach(p => {
            console.log(`\n--- Analysis for: ${p.first_name} ${p.last_name} ---`);
            console.log(`  Status:             ${p.status.toUpperCase()}`);
            console.log(`  Connection Accepted:  ${formatTime(p.connection_accepted_at)} (ET)`);
            console.log(`  Follow-Up Due At:   ${formatTime(p.follow_up_due_at)} (This is when the system SHOULD have scheduled it)`);
            console.log(`  Follow-Up Index:    ${p.follow_up_sequence_index}`);
            
            if (p.campaigns) {
                const campaign = p.campaigns;
                // Let's find the message column, whatever it's called
                const messageColumnKey = Object.keys(campaign).find(k => k.includes('message') || k.includes('sequence'));
                const campaignMessages = campaign[messageColumnKey];

                console.log(`  Campaign:           "${campaign.campaign_name}"`);

                if (campaignMessages && Array.isArray(campaignMessages) && campaignMessages.length > 1) {
                    console.log(`  Campaign HAS Follow-Ups: YES (${campaignMessages.length - 1} follow-up message(s) defined in column '${messageColumnKey}')`);
                    console.log(`  Next Message Expected:  Index ${p.follow_up_sequence_index || 1}`);
                } else {
                    console.log(`  Campaign HAS Follow-Ups: NO (Only a connection request message is defined, or message column is missing/empty)`);
                }
            } else {
                console.log(`  Campaign:           [Error] No associated campaign found!`);
            }
        });

        console.log('\n--- Diagnosis ---');
        const campaignLacksFollowups = prospects.some(p => {
            if (!p.campaigns) return true;
            const campaign = p.campaigns;
            const messageColumnKey = Object.keys(campaign).find(k => k.includes('message') || k.includes('sequence'));
            if (!messageColumnKey) return true;
            const campaignMessages = campaign[messageColumnKey];
            return !campaignMessages || !Array.isArray(campaignMessages) || campaignMessages.length <= 1;
        });

        if (campaignLacksFollowups) {
            console.log("Problem identified: At least one prospect belongs to a campaign that has NO follow-up messages defined. The system cannot schedule what doesn't exist.");
        } else {
            console.log("Problem identified: The campaigns HAVE follow-up messages, but the system FAILED to create entries for them in the 'send_queue'. This is a BUG in the scheduling logic.");
        }

    } else {
        console.log('No prospects with status "connected" or "replied" found to analyze.');
    }
}

investigateConnectedProspects();