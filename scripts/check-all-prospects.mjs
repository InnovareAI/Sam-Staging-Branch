#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SERVICE_ROLE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

console.log('\n📊 ALL PROSPECTS IN SYSTEM\n');
console.log('='.repeat(80) + '\n');

// Get all prospects
const { data: allProspects, error } = await supabase
  .from('workspace_prospects')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(20);

if (error) {
  console.log('❌ Error:', error.message);
  process.exit(1);
}

console.log(`Total prospects (showing first 20): ${allProspects?.length || 0}\n`);

// Group by approval_status
const byStatus = {};
allProspects?.forEach(p => {
  const status = p.approval_status || 'pending';
  if (!byStatus[status]) byStatus[status] = [];
  byStatus[status].push(p);
});

console.log('BY STATUS:\n');
Object.entries(byStatus).forEach(([status, prospects]) => {
  console.log(`${status}: ${prospects.length}`);
});
console.log('');

console.log('='.repeat(80) + '\n');
console.log('RECENT PROSPECTS:\n');

allProspects?.slice(0, 10).forEach((p, i) => {
  console.log(`${i + 1}. ${p.full_name || 'Unnamed'}`);
  console.log(`   ID: ${p.id}`);
  console.log(`   Status: ${p.approval_status || 'pending'}`);
  console.log(`   LinkedIn: ${p.linkedin_url || 'No URL'}`);
  console.log(`   Created: ${new Date(p.created_at).toLocaleDateString()}`);
  console.log('');
});

// Check campaign_prospects table structure
console.log('='.repeat(80) + '\n');
console.log('CAMPAIGN_PROSPECTS TABLE:\n');

const { data: campaignProspects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .limit(5);

if (campaignProspects && campaignProspects.length > 0) {
  console.log('Sample campaign_prospect:\n');
  const sample = campaignProspects[0];
  console.log(JSON.stringify(sample, null, 2));
  console.log('');
  console.log(`Fields: ${Object.keys(sample).join(', ')}`);
} else {
  console.log('No campaign prospects found');
}
console.log('');
