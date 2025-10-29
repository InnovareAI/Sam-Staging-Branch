#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking ALL Pending Campaigns & Prospects\n');

// Get all active campaigns with pending prospects
const { data: campaigns } = await supabase
  .from('campaigns')
  .select(`
    id,
    name,
    status,
    workspace_id,
    created_by,
    auto_execute,
    campaign_prospects!inner(id, status, linkedin_url)
  `)
  .in('status', ['active', 'scheduled'])
  .not('campaign_prospects.linkedin_url', 'is', null)
  .in('campaign_prospects.status', ['pending', 'approved', 'ready_to_message']);

console.log(`📊 TOTAL ACTIVE CAMPAIGNS: ${campaigns?.length || 0}\n`);

// Count prospects by campaign
const campaignSummary = campaigns?.map(c => {
  const pendingCount = c.campaign_prospects.length;
  return {
    name: c.name,
    prospects: pendingCount,
    status: c.status,
    auto_execute: c.auto_execute
  };
}).filter(c => c.prospects > 0);

campaignSummary?.sort((a, b) => b.prospects - a.prospects);

console.log('Campaigns with Pending Prospects:\n');
campaignSummary?.slice(0, 20).forEach((c, i) => {
  console.log(`${i + 1}. ${c.name}`);
  console.log(`   Pending: ${c.prospects} | Status: ${c.status} | Auto: ${c.auto_execute ? '✅' : '❌'}`);
});

const totalPending = campaignSummary?.reduce((sum, c) => sum + c.prospects, 0) || 0;

console.log(`\n\n📈 SUMMARY:`);
console.log(`   Active Campaigns: ${campaignSummary?.length || 0}`);
console.log(`   Total Pending Prospects: ${totalPending}`);
console.log(`   At 3 prospects/2min: ${Math.ceil(totalPending / 3) * 2} minutes = ${Math.ceil(totalPending / 3 * 2 / 60)} hours`);

console.log(`\n\n⚠️ URGENT: External cron service needed to process these automatically!`);
