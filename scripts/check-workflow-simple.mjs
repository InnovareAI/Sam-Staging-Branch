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

console.log('\n🔍 LINKEDIN MESSAGING WORKFLOW CHECK\n');
console.log('='.repeat(80) + '\n');

// Check active campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('*')
  .eq('status', 'active')
  .limit(3);

console.log(`📊 Active Campaigns: ${campaigns?.length || 0}\n`);

for (const campaign of campaigns || []) {
  console.log(`📋 ${campaign.name}`);
  console.log(`   ID: ${campaign.id}`);
  console.log(`   Workspace: ${campaign.workspace_id}`);
  
  // Get campaign prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id)
    .limit(5);
  
  console.log(`   Prospects: ${prospects?.length || 0} total`);
  
  if (prospects && prospects.length > 0) {
    const withLinkedInId = prospects.filter(p => p.linkedin_user_id).length;
    const withMessages = prospects.filter(p => p.message_status === 'sent').length;
    
    console.log(`   └─ With LinkedIn IDs: ${withLinkedInId}`);
    console.log(`   └─ Messages sent: ${withMessages}`);
  }
  console.log('');
}

console.log('='.repeat(80) + '\n');

// Check one campaign in detail
if (campaigns && campaigns.length > 0) {
  const campaign = campaigns[0];
  
  console.log(`🔍 DETAILED VIEW: "${campaign.name}"\n`);
  
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id)
    .limit(3);
  
  prospects?.forEach((p, i) => {
    console.log(`${i + 1}. Prospect ID: ${p.prospect_id || p.id}`);
    console.log(`   LinkedIn URL: ${p.linkedin_url || 'Missing'}`);
    console.log(`   LinkedIn Internal ID: ${p.linkedin_user_id || 'Not synced'}`);
    console.log(`   Message Status: ${p.message_status || 'not_sent'}`);
    console.log('');
  });
}

console.log('='.repeat(80) + '\n');
console.log('💡 NEXT ACTIONS:\n');
console.log('1. Choose a campaign to test');
console.log('2. Sync LinkedIn internal IDs for prospects');
console.log('3. Generate personalized messages');
console.log('4. Send via /api/campaigns/linkedin/execute-direct\n');
