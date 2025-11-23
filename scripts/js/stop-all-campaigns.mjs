#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🛑 STOPPING ALL CAMPAIGNS...\n');

// 1. Pause all campaigns
const { data: campaigns, error: campaignError } = await supabase
  .from('campaigns')
  .update({ status: 'paused' })
  .eq('status', 'active')
  .select();

console.log(`✅ Paused ${campaigns?.length || 0} campaigns`);

// 2. Cancel all pending prospects
const { count: prospectCount, error: prospectError } = await supabase
  .from('campaign_prospects')
  .update({ status: 'cancelled' }, { count: 'exact' })
  .eq('status', 'pending');

console.log(`✅ Cancelled ${prospectCount || 0} pending prospects`);

console.log('\n✅ ALL CAMPAIGNS STOPPED');
console.log('- All pending prospects cancelled');
console.log('- No CRs will be sent');
