#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = '683f9214-8a3f-4015-98fe-aa3ae76a9ebe'; // Charissa's campaign

console.log('🔄 Resetting failed prospects to pending...\n');

async function resetProspects() {
  // Get failed prospects
  const { data: failedProspects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name')
    .eq('campaign_id', campaignId)
    .eq('status', 'failed');

  if (!failedProspects || failedProspects.length === 0) {
    console.log('✅ No failed prospects to reset');
    return;
  }

  console.log(`Found ${failedProspects.length} failed prospects\n`);

  // Reset to pending
  const { error } = await supabase
    .from('campaign_prospects')
    .update({ status: 'pending' })
    .eq('campaign_id', campaignId)
    .eq('status', 'failed');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`✅ Reset ${failedProspects.length} prospects to 'pending' status`);
  console.log('\n📋 These prospects will now be processed with rate limiting:');
  console.log('   - Max 15 messages per 24 hours');
  console.log('   - Respects LinkedIn weekly limit (100/week)');
  console.log('   - Auto-retry on Monday if weekly limit hit\n');
}

resetProspects().catch(console.error);
