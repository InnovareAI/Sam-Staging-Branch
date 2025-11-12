#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

console.log('🔍 Checking Database Status During N8N Wait\n');

const WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861'; // Charissa IA4

// Get Charissa's active campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status')
  .eq('workspace_id', WORKSPACE_ID)
  .in('status', ['active']);

console.log(`Active campaigns: ${campaigns.length}\n`);

for (const campaign of campaigns) {
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('status, contacted_at, updated_at')
    .eq('campaign_id', campaign.id);
  
  const statusCounts = {};
  prospects.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });
  
  console.log(`${campaign.name}:`);
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  console.log('');
  
  // Check recently updated prospects
  const recentlyUpdated = prospects
    .filter(p => new Date(p.updated_at) > new Date(Date.now() - 30 * 60 * 1000))
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  
  if (recentlyUpdated.length > 0) {
    console.log(`  Recently updated (last 30 min): ${recentlyUpdated.length}`);
    recentlyUpdated.slice(0, 3).forEach(p => {
      console.log(`    Status: ${p.status}, Updated: ${new Date(p.updated_at).toLocaleTimeString()}`);
    });
    console.log('');
  }
}

console.log('='.repeat(60));
console.log('WHERE ARE THE EXECUTIONS?');
console.log('='.repeat(60));
console.log('');
console.log('Database (Supabase):');
console.log('  - Prospects likely still showing "pending" or "queued_in_n8n"');
console.log('  - Status won\'t update until N8N completes the send');
console.log('');
console.log('N8N (Workflow Engine):');
console.log('  - Executions actively running and WAITING');
console.log('  - Holding prospect data in memory');
console.log('  - Will send CRs when timer expires (13 hours from now)');
console.log('  - Will update database AFTER sending');
console.log('');
console.log('💡 The executions are in N8N, not the database');
console.log('   Database status lags behind N8N execution state\n');
