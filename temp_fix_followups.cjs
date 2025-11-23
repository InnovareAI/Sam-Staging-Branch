require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Define a default follow-up message to be added
const defaultFollowUp = {
  type: 'linkedin_message',
  delay: { days: 1, hours: 0, minutes: 0 },
  message: "Hi {{firstName}}, thanks for connecting! Looking forward to being in touch."
};

async function fixCampaignsAndScheduleFollowUps() {
    console.log('--- Starting Fix Process ---');
    
    // 1. Find all prospects who are 'connected' but have not had a follow-up scheduled yet
    const { data: prospects, error: prospectError } = await supabase
        .from('campaign_prospects')
        .select('campaign_id')
        .in('status', ['connected', 'replied'])
        .or('follow_up_sequence_index.is.null,follow_up_sequence_index.eq.0');

    if (prospectError) {
        console.error('Error fetching prospects:', prospectError.message);
        return;
    }

    if (!prospects || prospects.length === 0) {
        console.log('No connected prospects found needing a follow-up. Nothing to fix.');
        return;
    }

    const campaignIdsToFix = [...new Set(prospects.map(p => p.campaign_id))];
    console.log(`Found ${campaignIdsToFix.length} campaign(s) that need a follow-up message added.`);

    // 2. For each of those campaigns, add the default follow-up message
    for (const campaignId of campaignIdsToFix) {
        // Fetch the campaign
        const { data: campaign, error: campaignError } = await supabase
            .from('campaigns')
            .select('messages, message_sequence') // Check for both possible column names
            .eq('id', campaignId)
            .single();

        if (campaignError) {
            console.error(`Error fetching campaign ${campaignId}:`, campaignError.message);
            continue;
        }

        const messageColumnKey = campaign.message_sequence ? 'message_sequence' : 'messages';
        const currentMessages = campaign[messageColumnKey] || [];
        
        // Only add the follow-up if one doesn't already exist
        if (currentMessages.length <= 1) {
            console.log(`Updating campaign ${campaignId}: Adding default follow-up message...`);
            const newMessages = [...currentMessages, defaultFollowUp];
            
            const { error: updateError } = await supabase
                .from('campaigns')
                .update({ [messageColumnKey]: newMessages })
                .eq('id', campaignId);

            if (updateError) {
                console.error(`Failed to update campaign ${campaignId}:`, updateError.message);
            } else {
                console.log(`Campaign ${campaignId} updated successfully.`);
            }
        } else {
            console.log(`Campaign ${campaignId} already has follow-up messages. No update needed.`);
        }
    }

    console.log('\n--- Now, scheduling follow-ups for already connected prospects ---');
    await scheduleFollowUpsForConnectedProspects();
}

async function scheduleFollowUpsForConnectedProspects() {
    // Re-fetch prospects to ensure we're working with the latest data
    const { data: prospectsToSchedule, error: prospectError } = await supabase
        .from('campaign_prospects')
        .select('id, follow_up_due_at, unipile_account_id, campaign_id')
        .in('status', ['connected', 'replied'])
        .or('follow_up_sequence_index.is.null,follow_up_sequence_index.eq.0');

    if (prospectError) {
        console.error('Error fetching prospects to schedule:', prospectError.message);
        return;
    }

    if (!prospectsToSchedule || prospectsToSchedule.length === 0) {
        console.log('No prospects require manual follow-up scheduling.');
        return;
    }

    console.log(`Found ${prospectsToSchedule.length} prospect(s) to schedule a follow-up for.`);

    const newQueueEntries = prospectsToSchedule.map(p => ({
        campaign_prospect_id: p.id,
        unipile_account_id: p.unipile_account_id,
        campaign_id: p.campaign_id,
        status: 'pending',
        scheduled_for: p.follow_up_due_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Fallback to 24h from now
    }));

    // 3. Insert new follow-up messages into the send_queue
    const { error: insertError } = await supabase
        .from('send_queue')
        .insert(newQueueEntries);

    if (insertError) {
        console.error('Error inserting into send_queue:', insertError.message);
        return;
    }
    
    console.log(`Successfully created ${newQueueEntries.length} follow-up message(s) in the send_queue.`);

    // 4. Update the prospects' follow-up sequence index
    const prospectIdsToUpdate = prospectsToSchedule.map(p => p.id);
    const { error: updateError } = await supabase
        .from('campaign_prospects')
        .update({ follow_up_sequence_index: 1, updated_at: new Date().toISOString() })
        .in('id', prospectIdsToUpdate);

    if (updateError) {
        console.error('Error updating prospect follow-up index:', updateError.message);
    } else {
        console.log(`Successfully updated the follow-up index for ${prospectIdsToUpdate.length} prospect(s).`);
    }

    console.log('\n--- Fix Complete ---');
}


fixCampaignsAndScheduleFollowUps();
