import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRecentActivity() {
    console.log('🔍 Checking recent campaign activity...');

    const start = new Date('2025-11-22T00:00:00Z');
    const end = new Date('2025-11-22T23:59:59Z');
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    console.log(`📅 Querying range: ${startIso} to ${endIso}`);

    // 1. Campaigns launched yesterday
    const { data: campaigns, error: campError } = await supabase
        .from('campaigns')
        .select('id, campaign_name, status, launched_at, created_at')
        .or(`launched_at.gte.${startIso},created_at.gte.${startIso}`)
        .lt('created_at', endIso)
        .order('created_at', { ascending: false });

    if (campError) console.error('Error fetching campaigns:', campError);

    console.log(`\n📅 Campaigns active today (${campaigns?.length || 0}):`);
    campaigns?.forEach(c => {
        console.log(`- [${c.status}] ${c.campaign_name} (Launched: ${c.launched_at || 'N/A'}, Created: ${c.created_at})`);
    });

    // 2. Send Queue Activity
    const { data: queueItems, error: queueError } = await supabase
        .from('send_queue')
        .select('id, status, scheduled_for, sent_at, error_message, campaigns(campaign_name)')
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: false })
        .limit(50);

    if (queueError) console.error('Error fetching queue:', queueError);

    console.log(`\n📨 Queue Items from Yesterday (${queueItems?.length || 0}):`);
    queueItems?.forEach(q => {
        const campaignName = q.campaigns?.campaign_name || 'Unknown';
        console.log(`- [${q.status}] ${campaignName}: Scheduled ${q.scheduled_for} | Sent: ${q.sent_at || 'Pending'} ${q.error_message ? `| ❌ ${q.error_message}` : ''}`);
    });

    // 3. Prospect Activity
    const { data: prospects, error: prosError } = await supabase
        .from('campaign_prospects')
        .select('id, first_name, last_name, status, updated_at, campaigns(campaign_name)')
        .gte('updated_at', startIso)
        .lt('updated_at', endIso)
        .order('updated_at', { ascending: false })
        .limit(50);

    if (prosError) console.error('Error fetching prospects:', prosError);

    console.log(`\n👤 Recent Prospect Updates (${prospects?.length || 0}):`);
    prospects?.forEach(p => {
        const campaignName = p.campaigns?.campaign_name || 'Unknown';
        console.log(`- [${p.status}] ${p.first_name} ${p.last_name} (${campaignName}) @ ${p.updated_at}`);
    });
}

checkRecentActivity().catch(console.error);
