#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

console.log('▶️  Resuming Campaigns - Morning Restart\n');

// Load saved campaign data
const resumeData = JSON.parse(
  readFileSync(join(__dirname, 'campaigns-to-resume.json'), 'utf8')
);

console.log(`Campaigns paused at: ${new Date(resumeData.paused_at).toLocaleString()}`);
console.log(`Campaigns to resume: ${resumeData.campaigns.length}\n`);

resumeData.campaigns.forEach((c, i) => {
  console.log(`${i + 1}. ${c.name} (${c.workspace})`);
});

console.log('');

// Step 1: Reset failed/queued prospects to pending
console.log('Step 1: Resetting failed/queued prospects...\n');

const { data: reset } = await supabase
  .from('campaign_prospects')
  .update({ 
    status: 'pending',
    contacted_at: null
  })
  .in('campaign_id', resumeData.campaign_ids)
  .in('status', ['queued_in_n8n', 'failed'])
  .select();

console.log(`✅ Reset ${reset?.length || 0} prospects to pending\n`);

// Step 2: Resume campaigns
console.log('Step 2: Resuming campaigns...\n');

const { data: resumed } = await supabase
  .from('campaigns')
  .update({ 
    status: 'active',
    updated_at: new Date().toISOString()
  })
  .in('id', resumeData.campaign_ids)
  .select('id, name, workspaces(name)');

console.log(`✅ Resumed ${resumed?.length || 0} campaigns\n`);

resumed?.forEach((c, i) => {
  console.log(`${i + 1}. ${c.name} (${c.workspaces.name}) → ACTIVE`);
});

console.log('');
console.log('='.repeat(60));
console.log('✅ CAMPAIGNS RESUMED - READY TO SEND');
console.log('='.repeat(60));
console.log('');
console.log('Campaigns are now active and will start processing prospects');
console.log('Monitor N8N executions: https://workflows.innovareai.com');
console.log('');
