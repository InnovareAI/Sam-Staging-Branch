#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHARISSA_WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';

console.log('🔍 CHECKING CONNECTION REQUESTS DEC 1-3');
console.log('='.repeat(70));

// Check ALL send_queue items (including connection_request type)
console.log('\n1️⃣ All send_queue items Dec 1-3 (any status)...');
const { data: allQueue } = await supabase
  .from('send_queue')
  .select(`
    *,
    campaign_prospects!prospect_id (
      first_name, 
      last_name,
      linkedin_url,
      linkedin_user_id
    )
  `)
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .gte('scheduled_for', '2025-12-01T00:00:00Z')
  .lte('scheduled_for', '2025-12-04T00:00:00Z');

console.log(`   Total items: ${allQueue?.length || 0}`);
for (const q of allQueue || []) {
  const p = q.campaign_prospects;
  console.log(`   - ${p?.first_name || 'UNKNOWN'} ${p?.last_name || ''}`);
  console.log(`     Type: ${q.message_type || 'N/A'} | Status: ${q.status}`);
  console.log(`     Scheduled: ${q.scheduled_for} | Sent: ${q.sent_at}`);
  console.log(`     URL: ${p?.linkedin_url}`);
  console.log('');
}

// Check connection_requests table if it exists
console.log('\n2️⃣ Checking connection_requests table...');
const { data: crTable, error } = await supabase
  .from('connection_requests')
  .select('*')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .gte('created_at', '2025-12-01T00:00:00Z')
  .lte('created_at', '2025-12-04T00:00:00Z');

if (error) {
  console.log(`   Table may not exist: ${error.message}`);
} else {
  console.log(`   Found: ${crTable?.length || 0}`);
}

// Check system_activity_log for any CR sends on Dec 2
console.log('\n3️⃣ System activity log Dec 2...');
const { data: activityDec2 } = await supabase
  .from('system_activity_log')
  .select('*')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .gte('created_at', '2025-12-02T00:00:00Z')
  .lte('created_at', '2025-12-03T00:00:00Z');

console.log(`   Activities: ${activityDec2?.length || 0}`);
for (const a of activityDec2 || []) {
  console.log(`   - ${a.action_type}: ${JSON.stringify(a.details).slice(0, 100)}`);
}

// Check if there are ANY prospects with sara-ritchie URL pattern
console.log('\n4️⃣ Searching for any URL containing "sara-ritchie"...');
const { data: saraUrlSearch } = await supabase
  .from('campaign_prospects')
  .select('*')
  .ilike('linkedin_url', '%sara-ritchie%');

console.log(`   Found: ${saraUrlSearch?.length || 0}`);

// Also search with just "ritchie"
const { data: ritchieSearch } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, workspace_id')
  .ilike('linkedin_url', '%ritchie%');

console.log(`   URLs containing "ritchie": ${ritchieSearch?.length || 0}`);
for (const r of ritchieSearch || []) {
  console.log(`   - ${r.first_name} ${r.last_name} | ${r.linkedin_url} | WS: ${r.workspace_id}`);
}

console.log('\n' + '='.repeat(70));
