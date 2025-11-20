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

async function findUntouchedProspect() {
    console.log('\n🔍 Finding truly untouched prospect from newest campaign...\n');

    // 20251117-IA4-Outreach Campaign - the newest one
    const campaignId = '683f9214-8a3f-4015-98fe-aa3ae76a9ebe';

    const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('id, first_name, last_name, linkedin_url, contacted_at, status')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .is('contacted_at', null)
        .limit(50);

    console.log(`   Campaign: 20251117-IA4-Outreach Campaign`);
    console.log(`   Found ${prospects?.length || 0} never-contacted prospects\n`);

    for (const p of prospects) {
        const username = p.linkedin_url.split('/in/')[1] || '';

        // Skip special chars
        if (username.includes('%') || username.length > 30) {
            continue;
        }

        console.log(`✅ ${p.first_name} ${p.last_name}`);
        console.log(`   Username: ${username}`);
        console.log(`   LinkedIn: ${p.linkedin_url}`);
        console.log(`   Never contacted: ${!p.contacted_at}\n`);

        // Queue
        const scheduledTime = new Date();
        scheduledTime.setMinutes(scheduledTime.getMinutes() - 2);

        await supabase
            .from('campaign_prospects')
            .update({
                status: 'queued',
                scheduled_send_at: scheduledTime.toISOString()
            })
            .eq('id', p.id);

        console.log(`✅ Queued for send!\n`);
        console.log(`📋 This prospect has NEVER been contacted through any system.`);
        console.log(`   If this fails with "already invited", it means LinkedIn has a real record.\n`);
        return;
    }

    console.log('❌ No suitable prospects found\n');
}

findUntouchedProspect();
