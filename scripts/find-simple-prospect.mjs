#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findSimpleProspect() {
    console.log('\n🔍 Finding a prospect with simple username (no special chars)...\n');

    // Try Cha Canada Campaign instead
    const campaignId = '35415fff-a230-48c6-ae91-e8f170cd3232'; // Cha Canada Campaign

    const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('id, first_name, last_name, linkedin_url, contacted_at')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .is('contacted_at', null)
        .limit(20);

    if (!prospects || prospects.length === 0) {
        console.log('❌ No prospects found in Cha Canada Campaign\n');
        return;
    }

    console.log(`   Found ${prospects.length} never-contacted prospects`);
    console.log('   Looking for simple usernames...\n');

    for (const p of prospects) {
        const username = p.linkedin_url.split('/in/')[1] || '';

        // Check if username has special chars or encoding
        if (!username.includes('%') && !username.includes('é') && !username.includes('ü') && username.length < 30) {
            console.log(`✅ Found: ${p.first_name} ${p.last_name}`);
            console.log(`   Username: ${username}`);
            console.log(`   LinkedIn: ${p.linkedin_url}`);
            console.log(`   Campaign: Cha Canada Campaign\n`);

            // Queue this prospect
            const scheduledTime = new Date();
            scheduledTime.setMinutes(scheduledTime.getMinutes() - 2);

            const { error } = await supabase
                .from('campaign_prospects')
                .update({
                    status: 'queued',
                    scheduled_send_at: scheduledTime.toISOString()
                })
                .eq('id', p.id);

            if (error) {
                console.log(`❌ Error queuing: ${error.message}\n`);
                return;
            }

            console.log(`✅ Queued for immediate send!`);
            console.log(`   Run: node scripts/send-scheduled-prospects-cron.mjs\n`);
            console.log(`   Then check Charissa's LinkedIn for: ${p.first_name} ${p.last_name}\n`);
            return;
        }
    }

    console.log('❌ No prospects with simple usernames found\n');
}

findSimpleProspect();
