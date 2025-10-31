#!/usr/bin/env node
/**
 * Fix Stuck Queued Prospects
 *
 * Updates prospects that are stuck in queued_in_n8n status but have already been sent
 * (identified by having a unipile_message_id in personalization_data)
 *
 * Usage:
 *   node scripts/js/fix-stuck-queued-prospects.mjs [campaign-id]
 *
 * If no campaign ID provided, processes ALL stuck prospects across all campaigns
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CAMPAIGN_ID = process.argv[2]; // Optional: specific campaign ID

async function fixStuckProspects() {
  console.log('🔍 Finding stuck prospects...\n');

  // Build query
  let query = supabase
    .from('campaign_prospects')
    .select('*, campaigns(name)')
    .eq('status', 'queued_in_n8n');

  if (CAMPAIGN_ID) {
    query = query.eq('campaign_id', CAMPAIGN_ID);
    console.log(`Filtering by campaign: ${CAMPAIGN_ID}\n`);
  }

  const { data: prospects, error } = await query;

  if (error) {
    console.error('❌ Error fetching prospects:', error);
    return;
  }

  if (!prospects || prospects.length === 0) {
    console.log('✅ No stuck prospects found!\n');
    return;
  }

  // Filter to only those that have been sent (have unipile_message_id)
  const stuckWithMessageId = prospects.filter(p =>
    p.personalization_data?.unipile_message_id
  );

  const stuckWithoutMessageId = prospects.filter(p =>
    !p.personalization_data?.unipile_message_id
  );

  console.log(`📊 Found ${prospects.length} total queued prospects:`);
  console.log(`   ✅ ${stuckWithMessageId.length} have message IDs (will fix)`);
  console.log(`   ⏳ ${stuckWithoutMessageId.length} waiting to send (will skip)\n`);

  if (stuckWithMessageId.length === 0) {
    console.log('✅ No prospects need fixing!\n');
    return;
  }

  // Group by campaign
  const byCampaign = {};
  stuckWithMessageId.forEach(p => {
    const campaignName = p.campaigns?.name || 'Unknown';
    if (!byCampaign[campaignName]) {
      byCampaign[campaignName] = [];
    }
    byCampaign[campaignName].push(p);
  });

  console.log('📋 Prospects to fix by campaign:\n');
  for (const [campaignName, campaignProspects] of Object.entries(byCampaign)) {
    console.log(`   ${campaignName}: ${campaignProspects.length} prospects`);
  }

  console.log('\n🔧 Starting fix...\n');

  let fixed = 0;
  let errors = 0;

  for (const prospect of stuckWithMessageId) {
    const queuedAt = prospect.personalization_data?.queued_at;
    const messageId = prospect.personalization_data?.unipile_message_id;

    console.log(`Fixing: ${prospect.first_name} ${prospect.last_name}`);
    console.log(`   Campaign: ${prospect.campaigns?.name}`);
    console.log(`   Queued: ${queuedAt}`);
    console.log(`   Message ID: ${messageId}`);

    const { error: updateError } = await supabase
      .from('campaign_prospects')
      .update({
        contacted_at: queuedAt || new Date().toISOString(),
        status: 'connection_requested'  // Using standard status
      })
      .eq('id', prospect.id);

    if (updateError) {
      console.log(`   ❌ Error: ${updateError.message}\n`);
      errors++;
    } else {
      console.log(`   ✅ Status: queued_in_n8n → connection_requested\n`);
      fixed++;
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Summary:');
  console.log(`   ✅ Fixed: ${fixed}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   ⏳ Still waiting: ${stuckWithoutMessageId.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (stuckWithoutMessageId.length > 0) {
    console.log('ℹ️  Note: Prospects without message IDs are still waiting');
    console.log('   for n8n to process them. This is normal.\n');
  }
}

fixStuckProspects().catch(console.error);
