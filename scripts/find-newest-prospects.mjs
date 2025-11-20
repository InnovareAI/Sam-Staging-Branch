#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 Finding NEWEST prospects (added in last 7 days)...\n');

// Get prospects from all campaigns, sorted by creation date
const { data: prospects, error } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, status, contacted_at, created_at, campaign_id, campaigns(name)')
  .eq('status', 'pending')
  .is('contacted_at', null)
  .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  .order('created_at', { ascending: false })
  .limit(20);

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

if (!prospects || prospects.length === 0) {
  console.log('❌ No prospects found added in last 7 days\n');
  console.log('Expanding search to last 30 days...\n');
  
  const { data: older, error: olderError } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url, status, contacted_at, created_at, campaign_id')
    .eq('status', 'pending')
    .is('contacted_at', null)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (olderError || !older || older.length === 0) {
    console.log('❌ No pending prospects found in last 30 days either\n');
    console.log('This suggests all recent prospects have already been contacted.\n');
    process.exit(1);
  }
  
  console.log(`Found ${older.length} prospects from last 30 days:\n`);
  older.forEach((p, i) => {
    const username = p.linkedin_url.split('/in/')[1]?.replace('/', '') || 'unknown';
    console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
    console.log(`   Created: ${new Date(p.created_at).toLocaleDateString()}`);
    console.log(`   Username: ${username}\n`);
  });
  process.exit(0);
}

console.log(`Found ${prospects.length} prospects added in last 7 days:\n`);

for (let i = 0; i < Math.min(prospects.length, 10); i++) {
  const p = prospects[i];
  const username = p.linkedin_url.split('/in/')[1]?.replace('/', '') || 'unknown';
  const campaignName = p.campaigns?.name || 'Unknown Campaign';
  
  console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
  console.log(`   Campaign: ${campaignName}`);
  console.log(`   Created: ${new Date(p.created_at).toLocaleString()}`);
  console.log(`   Username: ${username}`);
  console.log(`   LinkedIn: ${p.linkedin_url}\n`);
}

// Select the newest one with simple username
const selected = prospects.find(p => {
  const username = p.linkedin_url.split('/in/')[1]?.replace('/', '') || '';
  return /^[a-z0-9-]+$/.test(username);
});

if (selected) {
  console.log(`\n✅ Selected NEWEST: ${selected.first_name} ${selected.last_name}`);
  console.log(`   Created: ${new Date(selected.created_at).toLocaleString()}\n`);
  
  // Queue this prospect
  const scheduledSendAt = new Date(Date.now() - 2 * 60 * 1000);
  
  const { error: updateError } = await supabase
    .from('campaign_prospects')
    .update({
      status: 'queued',
      scheduled_send_at: scheduledSendAt.toISOString()
    })
    .eq('id', selected.id);
  
  if (updateError) {
    console.log(`❌ Failed to queue: ${updateError.message}\n`);
  } else {
    console.log(`✅ Queued for send!\n`);
  }
} else {
  console.log('❌ No prospects with simple usernames found\n');
}
