#!/usr/bin/env node
/**
 * ROLLBACK: Restore N8N workflow execution
 * Reverses Inngest migration
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔄 ROLLING BACK TO N8N...\n');

// 1. Reset all paused campaigns to active
const { data: campaigns, error } = await supabase
  .from('campaigns')
  .update({ status: 'active' })
  .eq('status', 'paused')
  .select();

console.log(`✅ Reactivated ${campaigns?.length || 0} campaigns for N8N`);

// 2. Reset cancelled prospects to pending
const { count: prospectCount } = await supabase
  .from('campaign_prospects')
  .update({ status: 'pending' }, { count: 'exact' })
  .eq('status', 'cancelled');

console.log(`✅ Reset ${prospectCount || 0} prospects to pending`);

console.log('\n📋 NEXT STEPS:');
console.log('1. Disable Inngest cron: Comment out checkActiveCampaigns in app/api/inngest/route.ts');
console.log('2. Re-enable N8N cron: Uncomment /api/cron/check-pending-campaigns');
console.log('3. Deploy changes');
console.log('4. N8N will pick up pending prospects on next cron run');
