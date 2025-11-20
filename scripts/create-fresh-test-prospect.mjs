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

async function createFreshTestProspect() {
    console.log('\n🧪 Finding a FRESH prospect (never contacted)...\n');

    // Use SAM Startup Canada campaign
    const campaignId = '3326aa89-9220-4bef-a1db-9c54f14fc536';

    // Find a pending prospect that has NEVER been contacted
    const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('id, first_name, last_name, status, contacted_at, linkedin_url')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .is('contacted_at', null)  // NEVER contacted
        .limit(5);

    if (!prospects || prospects.length === 0) {
        console.log('❌ No fresh pending prospects found in SAM Startup Canada campaign');
        return;
    }

    console.log(`   Found ${prospects.length} fresh prospects. Using first one:\n`);

    const prospect = prospects[0];
    console.log(`   Name: ${prospect.first_name} ${prospect.last_name}`);
    console.log(`   LinkedIn: ${prospect.linkedin_url}`);
    console.log(`   Current status: ${prospect.status}`);
    console.log(`   Contacted at: ${prospect.contacted_at || 'NEVER (fresh prospect!)'}`);

    // Set scheduled time to 2 minutes ago (so cron will pick it up immediately)
    const scheduledTime = new Date();
    scheduledTime.setMinutes(scheduledTime.getMinutes() - 2);

    // Update to queued status with scheduled time
    const { error } = await supabase
        .from('campaign_prospects')
        .update({
            status: 'queued',
            scheduled_send_at: scheduledTime.toISOString()
        })
        .eq('id', prospect.id);

    if (error) {
        console.log(`\n❌ Error: ${error.message}`);
        return;
    }

    console.log(`\n   ✅ Updated to status='queued'`);
    console.log(`   ✅ Scheduled for: ${scheduledTime.toLocaleString()} (2 minutes ago)`);
    console.log(`\n📋 Test prospect details:`);
    console.log(`   ID: ${prospect.id}`);
    console.log(`   Name: ${prospect.first_name} ${prospect.last_name}`);
    console.log(`   Campaign: SAM Startup Canada (Charissa's account)`);
    console.log(`   LinkedIn: ${prospect.linkedin_url}`);
    console.log(`\n⏰ Now run the cron script manually:`);
    console.log(`   node scripts/send-scheduled-prospects-cron.mjs`);
    console.log(`\n   Then check Charissa's LinkedIn for a pending connection request to ${prospect.first_name} ${prospect.last_name}\n`);
}

createFreshTestProspect();
