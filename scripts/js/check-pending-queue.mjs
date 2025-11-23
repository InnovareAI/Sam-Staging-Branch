import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import moment from 'moment-timezone';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPendingQueue() {
    console.log('🔍 Checking Pending Queue...');

    const { count } = await supabase
        .from('send_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

    console.log(`\n📊 Total Pending Messages: ${count}`);

    const { data: pending, error } = await supabase
        .from('send_queue')
        .select('id, scheduled_for, campaigns(campaign_name), prospect_id')
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true })
        .limit(10);

    if (error) {
        console.error('Error fetching queue:', error);
        return;
    }

    if (pending.length === 0) {
        console.log('✅ No pending messages found.');
        return;
    }

    console.log('\n📅 Next 10 Scheduled Messages:');
    pending.forEach(item => {
        const scheduled = moment(item.scheduled_for);
        const campaignName = item.campaigns?.campaign_name || 'Unknown';

        console.log(`- ${scheduled.format('YYYY-MM-DD HH:mm:ss')} (UTC)`);
        console.log(`  ↳ ${scheduled.tz('America/New_York').format('llll')} (ET)`);
        console.log(`  ↳ Campaign: ${campaignName}`);
        console.log('---');
    });
}

checkPendingQueue().catch(console.error);
