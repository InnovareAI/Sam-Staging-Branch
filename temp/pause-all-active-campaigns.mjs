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

console.log('⏸️  Pausing All Active Campaigns Until Tomorrow Morning\n');

// Get all active campaigns across all workspaces
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, workspace_id, workspaces(name)')
  .in('status', ['active', 'running']);

console.log(`Found ${campaigns.length} active campaigns:\n`);

campaigns.forEach((c, i) => {
  console.log(`${i + 1}. ${c.name}`);
  console.log(`   Workspace: ${c.workspaces.name}`);
  console.log(`   ID: ${c.id}`);
  console.log('');
});

if (campaigns.length === 0) {
  console.log('✅ No active campaigns to pause\n');
  process.exit(0);
}

// Pause all active campaigns
const { data: paused, error } = await supabase
  .from('campaigns')
  .update({ 
    status: 'paused',
    updated_at: new Date().toISOString()
  })
  .in('status', ['active', 'running'])
  .select('id, name, workspaces(name)');

if (error) {
  console.error('❌ Error pausing campaigns:', error);
  process.exit(1);
}

console.log('='.repeat(60));
console.log(`✅ PAUSED ${paused.length} CAMPAIGNS`);
console.log('='.repeat(60));
console.log('');

paused.forEach((c, i) => {
  console.log(`${i + 1}. ${c.name} (${c.workspaces.name})`);
});

console.log('');
console.log('📝 Campaign IDs saved for resume:\n');
const campaignIds = paused.map(c => c.id);
console.log(JSON.stringify(campaignIds, null, 2));

// Save to file for tomorrow
const resumeData = {
  paused_at: new Date().toISOString(),
  campaign_ids: campaignIds,
  campaigns: paused.map(c => ({
    id: c.id,
    name: c.name,
    workspace: c.workspaces.name
  }))
};

const fs = await import('fs');
fs.writeFileSync(
  join(__dirname, 'campaigns-to-resume.json'),
  JSON.stringify(resumeData, null, 2)
);

console.log('\n✅ Saved resume data to: temp/campaigns-to-resume.json');
console.log('');
console.log('='.repeat(60));
console.log('NEXT STEPS:');
console.log('='.repeat(60));
console.log('');
console.log('Tomorrow morning, run:');
console.log('  node temp/resume-campaigns.mjs');
console.log('');
console.log('This will:');
console.log('  ✅ Resume all paused campaigns');
console.log('  ✅ Reset failed prospects to pending');
console.log('  ✅ Start fresh with cleared rate limits');
console.log('');
