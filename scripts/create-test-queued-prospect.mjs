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

async function createTestProspect() {
    console.log('\n🧪 Creating test queued prospect...\n');

    // Use SAM Startup Canada campaign
    const campaignId = '3326aa89-9220-4bef-a1db-9c54f14fc536';

    // Find a pending prospect to convert to queued
    const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('id, first_name, last_name, status')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .limit(1);

    if (!prospects || prospects.length === 0) {
        console.log('❌ No pending prospects found in SAM Startup Canada campaign');
        return;
    }

    const prospect = prospects[0];
    console.log(`   Found prospect: ${prospect.first_name} ${prospect.last_name}`);
    console.log(`   Current status: ${prospect.status}`);

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
        console.log(`❌ Error: ${error.message}`);
        return;
    }

    console.log(`   ✅ Updated to status='queued'`);
    console.log(`   ✅ Scheduled for: ${scheduledTime.toLocaleString()} (2 minutes ago)`);
    console.log(`\n📋 Test prospect details:`);
    console.log(`   ID: ${prospect.id}`);
    console.log(`   Name: ${prospect.first_name} ${prospect.last_name}`);
    console.log(`   Campaign: SAM Startup Canada`);
    console.log(`\n⏰ The cron job should pick this up on its next run (every minute)`);
    console.log(`   Watch the cron log: tail -f /tmp/send-cron.log\n`);
}

createTestProspect();
