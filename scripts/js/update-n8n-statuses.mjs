#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking for N8N statuses in database...\n');

async function checkAndUpdateStatuses() {
  // Check for prospects with N8N statuses
  const { data: n8nProspects, error: checkError } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, campaign_id')
    .in('status', ['queued_in_n8n', 'ready_to_message']);

  if (checkError) {
    console.error('❌ Error checking statuses:', checkError);
    return;
  }

  if (!n8nProspects || n8nProspects.length === 0) {
    console.log('✅ No N8N statuses found in database - all clean!');
    return;
  }

  console.log(`⚠️  Found ${n8nProspects.length} prospects with N8N statuses:\n`);

  n8nProspects.forEach(p => {
    console.log(`  - ${p.first_name} ${p.last_name}: ${p.status}`);
  });

  console.log('\n🔄 Updating to current statuses...\n');

  // Update queued_in_n8n → processing
  const queuedIds = n8nProspects
    .filter(p => p.status === 'queued_in_n8n')
    .map(p => p.id);

  if (queuedIds.length > 0) {
    const { error: updateQueuedError } = await supabase
      .from('campaign_prospects')
      .update({ status: 'processing' })
      .in('id', queuedIds);

    if (updateQueuedError) {
      console.error('❌ Error updating queued_in_n8n:', updateQueuedError);
    } else {
      console.log(`✅ Updated ${queuedIds.length} prospects from queued_in_n8n → processing`);
    }
  }

  // Update ready_to_message → pending
  const readyIds = n8nProspects
    .filter(p => p.status === 'ready_to_message')
    .map(p => p.id);

  if (readyIds.length > 0) {
    const { error: updateReadyError } = await supabase
      .from('campaign_prospects')
      .update({ status: 'pending' })
      .in('id', readyIds);

    if (updateReadyError) {
      console.error('❌ Error updating ready_to_message:', updateReadyError);
    } else {
      console.log(`✅ Updated ${readyIds.length} prospects from ready_to_message → pending`);
    }
  }

  console.log('\n✅ Database cleanup complete!');
}

checkAndUpdateStatuses().catch(console.error);
