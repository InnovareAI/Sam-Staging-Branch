import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import moment from 'moment-timezone';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFollowUps() {
    console.log('🔍 Checking Follow-up Schedules...');

    const start = new Date('2025-11-22T00:00:00Z');
    const startIso = start.toISOString();

    // Fetch prospects who are connected/replied/messaging and updated recently
    const { data: prospects, error } = await supabase
        .from('campaign_prospects')
        .select(`
      id, 
      first_name, 
      last_name, 
      status, 
      contacted_at, 
      follow_up_due_at, 
      follow_up_sequence_index,
      updated_at,
      campaigns(campaign_name)
    `)
        .in('status', ['connected', 'replied', 'messaging', 'connection_request_sent']) // Include sent to see if they are stuck
        .gte('updated_at', startIso)
        .order('updated_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('Error fetching prospects:', error);
        return;
    }

    console.log(`\n📊 Found ${prospects.length} active prospects since ${startIso}:`);

    prospects.forEach(p => {
        const campaignName = p.campaigns?.campaign_name || 'Unknown';
        const contacted = p.contacted_at ? moment(p.contacted_at).tz('America/New_York').format('MM/DD HH:mm') : 'N/A';
        const due = p.follow_up_due_at ? moment(p.follow_up_due_at).tz('America/New_York').format('MM/DD HH:mm') : 'N/A';
        const updated = moment(p.updated_at).tz('America/New_York').format('MM/DD HH:mm');

        console.log(`- ${p.first_name} ${p.last_name} (${campaignName})`);
        console.log(`  Status: ${p.status}`);
        console.log(`  Contacted: ${contacted} | Updated: ${updated}`);
        console.log(`  Next Follow-up Due: ${due} (Index: ${p.follow_up_sequence_index})`);
        console.log('---');
    });
}

checkFollowUps().catch(console.error);
