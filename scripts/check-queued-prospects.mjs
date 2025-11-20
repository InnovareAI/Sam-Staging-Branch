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

console.log('\n🔍 Investigating prospects with status="queued"...\n');

// Get prospects with status='queued'
const { data: queuedProspects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, scheduled_send_at, created_at, campaign_id')
  .eq('status', 'queued')
  .order('scheduled_send_at', { ascending: true })
  .limit(10);

console.log(`Found ${queuedProspects?.length || 0} prospects with status='queued'\n`);

if (queuedProspects && queuedProspects.length > 0) {
  console.log('Sample prospects:');
  for (const p of queuedProspects.slice(0, 5)) {
    console.log(`  • ${p.first_name} ${p.last_name}`);
    console.log(`    Campaign: ${p.campaign_id}`);
    console.log(`    Scheduled: ${p.scheduled_send_at || 'NULL'}`);
    console.log(`    Created: ${p.created_at}`);
  }
}

// Get prospects with status='queued_in_n8n'
const { data: queuedInN8N } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status')
  .eq('status', 'queued_in_n8n')
  .limit(10);

console.log(`\n\nFound ${queuedInN8N?.length || 0} prospects with status='queued_in_n8n'\n`);

// Get recently sent
const { data: recentlySent } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, contacted_at')
  .eq('status', 'connection_requested')
  .gte('contacted_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Last 2 hours
  .order('contacted_at', { ascending: false })
  .limit(10);

console.log(`Recently sent (last 2 hours): ${recentlySent?.length || 0} prospects\n`);

if (recentlySent && recentlySent.length > 0) {
  console.log('Sample recently sent:');
  for (const p of recentlySent.slice(0, 5)) {
    console.log(`  • ${p.first_name} ${p.last_name} - ${p.contacted_at}`);
  }
}

console.log('\n');
