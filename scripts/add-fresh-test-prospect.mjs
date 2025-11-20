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

// Use a completely random LinkedIn profile for testing
// Example: LinkedIn co-founder Reid Hoffman (public figure, won't mind test invite)
const TEST_PROSPECT = {
  first_name: 'Reid',
  last_name: 'Hoffman',
  linkedin_url: 'https://www.linkedin.com/in/reidhoffman',
  company_name: 'Greylock Partners',
  title: 'Partner',
  campaign_id: '683f9214-8a3f-4015-98fe-aa3ae76a9ebe', // 20251117-IA4-Outreach Campaign
  workspace_id: '7f0341da-88db-476b-ae0a-fc0da5b70861'
};

console.log('\n🆕 Adding completely fresh test prospect...\n');
console.log(`   Name: ${TEST_PROSPECT.first_name} ${TEST_PROSPECT.last_name}`);
console.log(`   LinkedIn: ${TEST_PROSPECT.linkedin_url}\n`);

// Check if already exists
const { data: existing } = await supabase
  .from('campaign_prospects')
  .select('id')
  .eq('linkedin_url', TEST_PROSPECT.linkedin_url)
  .single();

if (existing) {
  console.log('⚠️  This prospect already exists. Queuing for send...\n');
  
  const scheduledSendAt = new Date(Date.now() - 2 * 60 * 1000);
  
  await supabase
    .from('campaign_prospects')
    .update({
      status: 'queued',
      scheduled_send_at: scheduledSendAt.toISOString()
    })
    .eq('id', existing.id);
  
  console.log('✅ Queued for send!\n');
} else {
  // Insert new prospect
  const { data, error } = await supabase
    .from('campaign_prospects')
    .insert([{
      ...TEST_PROSPECT,
      status: 'queued',
      scheduled_send_at: new Date(Date.now() - 2 * 60 * 1000).toISOString()
    }])
    .select()
    .single();
  
  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  console.log('✅ Fresh prospect added and queued!\n');
  console.log(`   Prospect ID: ${data.id}\n`);
}

console.log('Next: Run send-scheduled-prospects-cron.mjs\n');
