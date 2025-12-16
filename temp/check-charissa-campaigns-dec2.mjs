#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHARISSA_WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';

console.log('🔍 CHECKING CHARISSA\'S CAMPAIGNS AROUND DEC 2');
console.log('='.repeat(70));

// Get all campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, created_at, campaign_type')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .order('created_at', { ascending: false });

console.log('\nAll Charissa campaigns:');
for (const c of campaigns || []) {
  console.log(`- ${c.name} | ${c.campaign_type} | ${c.status} | Created: ${c.created_at}`);
  
  // Get prospect count
  const { count } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', c.id);
  
  console.log(`  Prospects: ${count}`);
}

// Check if any prospects have linkedin_url containing sara or ritchie
console.log('\n' + '─'.repeat(70));
console.log('Searching for Sara in ALL workspace prospects...');

const { data: saraProspects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, linkedin_user_id, status, created_at, campaign_id')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .or('first_name.ilike.%sara%,last_name.ilike.%ritchie%');

if (saraProspects && saraProspects.length > 0) {
  console.log(`Found ${saraProspects.length} prospects with Sara/Ritchie:`);
  for (const p of saraProspects) {
    console.log(`- ${p.first_name} ${p.last_name} | ${p.status} | ${p.linkedin_url}`);
  }
} else {
  console.log('No prospects found with Sara or Ritchie in name');
}

// Check if any send_queue items were created around Dec 2
console.log('\n' + '─'.repeat(70));
console.log('Checking send_queue items from Dec 1-3...');

const campaignIds = campaigns?.map(c => c.id) || [];
const { data: queueItems } = await supabase
  .from('send_queue')
  .select('id, prospect_id, linkedin_user_id, message, status, scheduled_for, sent_at, campaign_id')
  .in('campaign_id', campaignIds)
  .gte('scheduled_for', '2025-12-01T00:00:00Z')
  .lte('scheduled_for', '2025-12-03T23:59:59Z');

console.log(`Queue items Dec 1-3: ${queueItems?.length || 0}`);
for (const q of queueItems || []) {
  console.log(`- ${q.linkedin_user_id} | ${q.status} | Scheduled: ${q.scheduled_for} | Sent: ${q.sent_at}`);
}

// Check CSV uploads
console.log('\n' + '─'.repeat(70));
console.log('Checking CSV uploads for Charissa...');

const { data: csvUploads } = await supabase
  .from('csv_uploads')
  .select('*')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .order('created_at', { ascending: false });

for (const csv of csvUploads || []) {
  console.log(`- ${csv.filename} | ${csv.status} | ${csv.created_at} | ${csv.total_rows} rows`);
}

console.log('\n' + '='.repeat(70));
