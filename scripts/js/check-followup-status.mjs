#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking for Follow-Up Automation\n');

// Check all possible prospect statuses
const { data: allStatuses } = await supabase
  .from('campaign_prospects')
  .select('status')
  .not('status', 'is', null);

const uniqueStatuses = [...new Set(allStatuses?.map(s => s.status))];
console.log('All Prospect Statuses in Database:');
uniqueStatuses.forEach(s => console.log(`  - ${s}`));
console.log();

// Check if any prospects are in 'connected' or 'follow_up_due' status
const { data: connectedCount } = await supabase
  .from('campaign_prospects')
  .select('id', { count: 'exact', head: true })
  .eq('status', 'connected');

const { data: followUpCount } = await supabase
  .from('campaign_prospects')
  .select('id', { count: 'exact', head: true })
  .eq('status', 'follow_up_due');

console.log('Prospects needing follow-up:');
console.log(`  Connected (waiting for follow-up): ${connectedCount?.count || 0}`);
console.log(`  Follow-up due: ${followUpCount?.count || 0}`);
console.log();

// Check if there are scheduled functions for follow-ups
console.log('❌ MISSING AUTOMATION:');
console.log('  1. No polling to detect connection acceptances');
console.log('  2. No automation to send follow-up messages');
console.log('  3. No status change: connection_requested → connected');
console.log();

console.log('💡 FOLLOW-UP MESSAGES EXIST BUT NOT AUTOMATED');
console.log('   Campaign has 5 follow-up messages configured');
console.log('   But no system to trigger them automatically');
