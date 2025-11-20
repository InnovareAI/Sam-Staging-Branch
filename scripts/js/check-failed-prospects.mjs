#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking for failed/stuck prospects...\n');

async function checkProspects() {
  // Check for prospects with various statuses
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, campaign_id, created_at, updated_at')
    .in('status', ['failed', 'processing', 'cr_sent'])
    .order('updated_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!prospects || prospects.length === 0) {
    console.log('✅ No failed/processing prospects found');
    return;
  }

  console.log(`Found ${prospects.length} prospects:\n`);

  // Group by status
  const byStatus = {};
  prospects.forEach(p => {
    if (!byStatus[p.status]) {
      byStatus[p.status] = [];
    }
    byStatus[p.status].push(p);
  });

  for (const [status, prospects] of Object.entries(byStatus)) {
    console.log(`\n📋 Status: ${status} (${prospects.length} prospects)`);

    prospects.slice(0, 5).forEach(p => {
      console.log(`   - ${p.first_name} ${p.last_name}`);
      console.log(`     Campaign: ${p.campaign_id}`);
      console.log(`     Updated: ${new Date(p.updated_at).toLocaleString()}\n`);
    });

    if (prospects.length > 5) {
      console.log(`   ... and ${prospects.length - 5} more\n`);
    }
  }

  // Check workspace accounts
  console.log('\n📊 Checking LinkedIn account limits...\n');

  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('id, account_name, unipile_account_id, messages_sent_today, last_message_date, daily_message_limit')
    .not('unipile_account_id', 'is', null);

  if (accounts) {
    accounts.forEach(acc => {
      const today = new Date().toISOString().split('T')[0];
      const lastDate = acc.last_message_date?.split('T')[0];
      const isToday = lastDate === today;
      const sentToday = isToday ? (acc.messages_sent_today || 0) : 0;
      const limit = acc.daily_message_limit || 20;

      console.log(`   ${acc.account_name}`);
      console.log(`   Daily: ${sentToday}/${limit}`);
      console.log(`   Last message: ${acc.last_message_date ? new Date(acc.last_message_date).toLocaleString() : 'Never'}\n`);
    });
  }
}

checkProspects().catch(console.error);
