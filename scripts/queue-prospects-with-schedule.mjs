#!/usr/bin/env node

/**
 * Queue prospects with randomized send times (database-driven scheduling)
 *
 * This script:
 * 1. Gets all pending prospects for active campaigns
 * 2. Calculates human-like randomized send times using the same logic as the API
 * 3. Updates database with status='queued' and scheduled_send_at timestamp
 * 4. Cron job will later send prospects when their scheduled time arrives
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861'; // IA4
const UNIPILE_ACCOUNT_ID = '4nt1J-blSnGUPBjH2Nfjpg'; // Charissa

const CAMPAIGNS = [
  { name: '20251117-IA4-Outreach Campaign', id: '683f9214-8a3f-4015-98fe-aa3ae76a9ebe' },
  { name: 'Cha Canada Campaign', id: '35415fff-a230-48c6-ae91-e8f170cd3232' },
  { name: 'SAM Startup Canada', id: '3326aa89-9220-4bef-a1db-9c54f14fc536' }
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * HUMAN-LIKE RANDOMIZER (same logic as API route)
 * Generates realistic daily sending patterns
 */
function calculateHumanSendDelay(prospectIndex, dailyLimit = 20) {
  // Generate day-specific pattern
  const today = new Date().toISOString().split('T')[0];
  const dateSeed = parseInt(today.replace(/-/g, '')) + UNIPILE_ACCOUNT_ID.charCodeAt(0);
  const dayPattern = (dateSeed % 5);

  let hourlyRate;
  switch (dayPattern) {
    case 0: hourlyRate = Math.random() * 2; break;        // Slow: 0-2 msg/hr
    case 1: hourlyRate = 2 + Math.random(); break;        // Medium: 2-3 msg/hr
    case 2: hourlyRate = 3 + Math.random() * 2; break;    // Busy: 3-5 msg/hr
    case 3: hourlyRate = prospectIndex % 2 === 0 ? 4 + Math.random() : 1 + Math.random(); break; // Mixed
    case 4: hourlyRate = 1 + Math.random() * 3; break;    // Variable: 1-4 msg/hr
  }

  const avgMinutesBetween = 60 / hourlyRate;
  const variation = (Math.random() - 0.5) * 0.6; // ±30%
  const delayMinutes = Math.round(avgMinutesBetween * (1 + variation));
  const sendDelayMinutes = prospectIndex === 0 ? 0 : Math.max(2, Math.min(20, delayMinutes));

  return sendDelayMinutes;
}

async function queueCampaign(campaign) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🗓️  ${campaign.name}`);
  console.log(`${'='.repeat(60)}\n`);

  // Get pending prospects
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name')
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending')
    .order('created_at');

  if (error) {
    console.error(`❌ Error:`, error.message);
    return;
  }

  if (!prospects || prospects.length === 0) {
    console.log(`⚠️  No pending prospects\n`);
    return;
  }

  console.log(`📊 Total: ${prospects.length} prospects\n`);

  let scheduledCount = 0;
  let now = new Date();

  for (let i = 0; i < prospects.length; i++) {
    const prospect = prospects[i];
    const delayMinutes = calculateHumanSendDelay(i);

    // Calculate scheduled send time
    const scheduledSendAt = new Date(now.getTime() + (delayMinutes * 60 * 1000));

    console.log(`[${i + 1}/${prospects.length}] ${prospect.first_name} ${prospect.last_name}`);
    console.log(`   📅 Scheduled: ${scheduledSendAt.toLocaleString()} (in ${delayMinutes} min)`);

    // Update database
    const { error: updateError } = await supabase
      .from('campaign_prospects')
      .update({
        status: 'queued',
        scheduled_send_at: scheduledSendAt.toISOString()
      })
      .eq('id', prospect.id);

    if (updateError) {
      console.log(`   ❌ Failed to queue: ${updateError.message}`);
    } else {
      console.log(`   ✅ Queued`);
      scheduledCount++;
    }

    // Update 'now' for next calculation
    now = scheduledSendAt;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Complete: ${scheduledCount}/${prospects.length} queued`);
  console.log(`${'='.repeat(60)}\n`);
}

console.log('🎯 Queueing Charissa\'s Campaigns with Randomized Schedule\n');
console.log(`   Workspace: IA4`);
console.log(`   Account: Charissa Saniel (${UNIPILE_ACCOUNT_ID})`);
console.log(`   Campaigns: ${CAMPAIGNS.length}\n`);

for (const campaign of CAMPAIGNS) {
  await queueCampaign(campaign);
}

console.log('\n🎉 All prospects queued!');
console.log('Next: Run the cron job to send prospects when their time arrives.\n');
