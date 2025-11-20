#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking for prospects that hit rate limits...\n');

async function checkRateLimitProspects() {
  // Check for prospects that failed with rate limit errors
  const { data: failedProspects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, error_message, campaign_id, updated_at')
    .eq('status', 'failed')
    .ilike('error_message', '%rate%limit%')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!failedProspects || failedProspects.length === 0) {
    console.log('✅ No prospects found with rate limit errors');
    return;
  }

  console.log(`⚠️  Found ${failedProspects.length} prospects that hit rate limits:\n`);

  // Group by campaign
  const byCampaign = {};
  failedProspects.forEach(p => {
    if (!byCampaign[p.campaign_id]) {
      byCampaign[p.campaign_id] = [];
    }
    byCampaign[p.campaign_id].push(p);
  });

  for (const [campaignId, prospects] of Object.entries(byCampaign)) {
    console.log(`📋 Campaign ID: ${campaignId}`);
    console.log(`   ${prospects.length} prospects affected\n`);

    prospects.slice(0, 5).forEach(p => {
      console.log(`   - ${p.first_name} ${p.last_name}`);
      console.log(`     Error: ${p.error_message}`);
      console.log(`     Updated: ${new Date(p.updated_at).toLocaleString()}\n`);
    });

    if (prospects.length > 5) {
      console.log(`   ... and ${prospects.length - 5} more\n`);
    }
  }

  // Check workspace accounts for weekly limits
  console.log('📊 Checking account message counts...\n');

  const uniqueAccountIds = [...new Set(failedProspects.map(p => p.campaign_id))];

  for (const campaignId of uniqueAccountIds) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('linkedin_account_id, workspace_accounts!linkedin_account_id(account_name, messages_sent_today, weekly_messages_sent, daily_message_limit, weekly_message_limit)')
      .eq('id', campaignId)
      .single();

    if (campaign?.workspace_accounts) {
      const acc = campaign.workspace_accounts;
      console.log(`   Account: ${acc.account_name}`);
      console.log(`   Daily: ${acc.messages_sent_today}/${acc.daily_message_limit || 20}`);
      console.log(`   Weekly: ${acc.weekly_messages_sent || 0}/${acc.weekly_message_limit || 100}\n`);
    }
  }
}

checkRateLimitProspects().catch(console.error);
