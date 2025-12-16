#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 CHECKING FOR DELETED/MISSING SARA RITCHIE');
console.log('='.repeat(70));

const SARA_URL = 'sara-ritchie-6a24b834';
const SARA_PROVIDER_ID = 'ACoAAAcxZNoBOO3uKSFEtKndR6hFtahdCk0Gj_Y';

// 1. Check system_activity_log for any Sara activity
console.log('\n1️⃣ CHECKING SYSTEM_ACTIVITY_LOG...');

const { data: activityLogs } = await supabase
  .from('system_activity_log')
  .select('*')
  .or(`details->>'linkedin_url'.ilike.%${SARA_URL}%,details->>'prospect_name'.ilike.%sara%ritchie%`)
  .limit(10);

console.log(`   Found ${activityLogs?.length || 0} activity logs`);

for (const log of activityLogs || []) {
  console.log(`   - ${log.action_type}: ${JSON.stringify(log.details).slice(0, 100)}`);
}

// 2. Check if there are any orphaned send_queue entries
console.log('\n' + '─'.repeat(70));
console.log('2️⃣ CHECKING SEND_QUEUE FOR ORPHANED ENTRIES...');

// Get Charissa's campaign IDs
const { data: charissaCampaigns } = await supabase
  .from('campaigns')
  .select('id, name')
  .eq('workspace_id', '7f0341da-88db-476b-ae0a-fc0da5b70861');

const campaignIds = charissaCampaigns?.map(c => c.id) || [];

const { data: queueWithoutProspect } = await supabase
  .from('send_queue')
  .select('id, linkedin_user_id, message, status, sent_at, campaign_id')
  .in('campaign_id', campaignIds)
  .or(`linkedin_user_id.ilike.%${SARA_URL}%,linkedin_user_id.ilike.%${SARA_PROVIDER_ID.slice(0, 20)}%`);

console.log(`   Found ${queueWithoutProspect?.length || 0} queue entries for Sara`);

for (const q of queueWithoutProspect || []) {
  console.log(`   - ${q.linkedin_user_id} | ${q.status} | sent: ${q.sent_at}`);
}

// 3. Check ALL sent queue items for Charissa in last 30 days
console.log('\n' + '─'.repeat(70));
console.log('3️⃣ CHECKING ALL SENT MESSAGES FROM CHARISSA (last 30 days)...');

const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const { data: sentItems, count } = await supabase
  .from('send_queue')
  .select('id, linkedin_user_id, prospect_id, status, sent_at', { count: 'exact' })
  .in('campaign_id', campaignIds)
  .eq('status', 'sent')
  .gte('sent_at', thirtyDaysAgo.toISOString())
  .order('sent_at', { ascending: false });

console.log(`   Total sent in last 30 days: ${count}`);

// Check for any that don't have a matching prospect
let orphanedCount = 0;
for (const item of sentItems || []) {
  const { data: prospect } = await supabase
    .from('campaign_prospects')
    .select('id')
    .eq('id', item.prospect_id)
    .single();

  if (!prospect) {
    orphanedCount++;
    console.log(`   ⚠️  ORPHANED: ${item.linkedin_user_id} (prospect_id: ${item.prospect_id})`);
  }
}

console.log(`   Orphaned queue entries: ${orphanedCount}`);

// 4. Try partial match on linkedin URL
console.log('\n' + '─'.repeat(70));
console.log('4️⃣ SEARCHING ENTIRE DATABASE FOR ANY TRACE...');

// Search with partial URL
const { data: partialMatch } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, linkedin_user_id, status')
  .ilike('linkedin_url', '%6a24b834%');

console.log(`   By URL ID "6a24b834": ${partialMatch?.length || 0} found`);

// Search campaign_messages more broadly
const { data: msgSearch } = await supabase
  .from('campaign_messages')
  .select('recipient_name, recipient_linkedin_profile, sent_at, workspace_id')
  .ilike('recipient_linkedin_profile', '%6a24b834%');

console.log(`   campaign_messages with "6a24b834": ${msgSearch?.length || 0}`);

for (const m of msgSearch || []) {
  console.log(`   - ${m.recipient_name} | ${m.recipient_linkedin_profile} | ${m.sent_at}`);
}

// 5. Check linkedin_messages table
const { data: liMsgs } = await supabase
  .from('linkedin_messages')
  .select('*')
  .or(`recipient_linkedin_url.ilike.%6a24b834%,recipient_linkedin_id.ilike.%${SARA_PROVIDER_ID.slice(0, 15)}%`);

console.log(`   linkedin_messages with Sara: ${liMsgs?.length || 0}`);

console.log('\n' + '='.repeat(70));
