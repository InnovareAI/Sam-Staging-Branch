#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHARISSA_WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';

console.log('🔍 CHECKING FOR ALTERNATIVE MESSAGE SEND MECHANISMS');
console.log('='.repeat(70));

// 1. Check n8n_executions table
console.log('\n1️⃣ N8N executions Dec 1-3...');
const { data: n8nExecs, error: n8nError } = await supabase
  .from('n8n_executions')
  .select('*')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .gte('created_at', '2025-12-01T00:00:00Z')
  .lte('created_at', '2025-12-03T23:59:59Z');

if (n8nError) {
  console.log(`   Table may not exist: ${n8nError.message}`);
} else {
  console.log(`   Found: ${n8nExecs?.length || 0}`);
}

// 2. Check workflow_executions
console.log('\n2️⃣ Workflow executions Dec 1-3...');
const { data: wfExecs, error: wfError } = await supabase
  .from('workflow_executions')
  .select('*')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .gte('created_at', '2025-12-01T00:00:00Z')
  .lte('created_at', '2025-12-03T23:59:59Z');

if (wfError) {
  console.log(`   Table may not exist: ${wfError.message}`);
} else {
  console.log(`   Found: ${wfExecs?.length || 0}`);
}

// 3. Check unipile_api_logs
console.log('\n3️⃣ Unipile API logs Dec 1-3...');
const { data: apiLogs, error: apiError } = await supabase
  .from('unipile_api_logs')
  .select('*')
  .gte('created_at', '2025-12-01T00:00:00Z')
  .lte('created_at', '2025-12-03T23:59:59Z');

if (apiError) {
  console.log(`   Table may not exist: ${apiError.message}`);
} else {
  console.log(`   Found: ${apiLogs?.length || 0}`);
}

// 4. Check linkedin_api_calls
console.log('\n4️⃣ LinkedIn API calls Dec 1-3...');
const { data: liApiCalls, error: liError } = await supabase
  .from('linkedin_api_calls')
  .select('*')
  .gte('created_at', '2025-12-01T00:00:00Z')
  .lte('created_at', '2025-12-03T23:59:59Z');

if (liError) {
  console.log(`   Table may not exist: ${liError.message}`);
} else {
  console.log(`   Found: ${liApiCalls?.length || 0}`);
}

// 5. Search ALL tables for Sara's provider_id
console.log('\n5️⃣ Deep search for Sara\'s provider_id across all tables...');
const SARA_PROVIDER_ID = 'ACoAAAcxZNoBOO3uKSFEtKndR6hFtahdCk0Gj_Y';

const tablesToSearch = [
  'campaign_prospects',
  'send_queue',
  'email_send_queue',
  'campaign_messages',
  'linkedin_messages',
  'message_logs',
  'outbound_logs',
  'prospect_messages'
];

for (const table of tablesToSearch) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .or(`linkedin_user_id.eq.${SARA_PROVIDER_ID},recipient_provider_id.eq.${SARA_PROVIDER_ID},provider_id.eq.${SARA_PROVIDER_ID}`)
    .limit(5);
  
  if (error) {
    // Column might not exist
    const { data: data2 } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    if (data2) {
      console.log(`   ${table}: EXISTS but no matching column`);
    }
  } else if (data && data.length > 0) {
    console.log(`   ✓ ${table}: FOUND ${data.length} records!`);
  }
}

// 6. Check if the message was sent through the execute-via-n8n endpoint
console.log('\n6️⃣ Checking campaigns created around Dec 2...');
const { data: campaignsAround } = await supabase
  .from('campaigns')
  .select('id, name, created_at, status, campaign_type')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .gte('created_at', '2025-11-30T00:00:00Z')
  .lte('created_at', '2025-12-05T00:00:00Z');

for (const c of campaignsAround || []) {
  console.log(`   - ${c.name} | ${c.campaign_type} | Created: ${c.created_at}`);
  
  // Check prospects count
  const { count } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', c.id);
  
  console.log(`     Prospects: ${count}`);
}

console.log('\n' + '='.repeat(70));
