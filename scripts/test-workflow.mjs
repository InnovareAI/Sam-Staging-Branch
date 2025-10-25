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

console.log('\n🔍 WORKFLOW STATUS CHECK\n');
console.log('='.repeat(80) + '\n');

// 1. Check approved prospects
console.log('1️⃣ CHECKING APPROVED PROSPECTS...\n');

const { data: approvedProspects, error: prospectError } = await supabase
  .from('workspace_prospects')
  .select('id, full_name, approval_status, campaign_id, linkedin_url, workspaces(name)')
  .eq('approval_status', 'approved')
  .order('created_at', { ascending: false })
  .limit(5);

if (prospectError) {
  console.log('❌ Error:', prospectError.message);
} else {
  console.log(`Found ${approvedProspects?.length || 0} approved prospects\n`);
  
  approvedProspects?.forEach((p, i) => {
    console.log(`${i + 1}. ${p.full_name}`);
    console.log(`   Workspace: ${p.workspaces?.name}`);
    console.log(`   Campaign: ${p.campaign_id ? '✅ Linked' : '❌ Not linked'}`);
    console.log(`   LinkedIn URL: ${p.linkedin_url || 'Missing'}`);
    console.log('');
  });
}

// 2. Check active campaigns
console.log('='.repeat(80) + '\n');
console.log('2️⃣ CHECKING ACTIVE CAMPAIGNS...\n');

const { data: campaigns, error: campaignError } = await supabase
  .from('campaigns')
  .select('id, name, status, workspace_id, workspaces(name), campaign_prospects(count)')
  .eq('status', 'active')
  .limit(5);

if (campaignError) {
  console.log('❌ Error:', campaignError.message);
} else {
  console.log(`Found ${campaigns?.length || 0} active campaigns\n`);
  
  campaigns?.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name}`);
    console.log(`   Workspace: ${c.workspaces?.name}`);
    console.log(`   Prospects: ${c.campaign_prospects?.[0]?.count || 0}`);
    console.log('');
  });
}

// 3. Check campaign_prospects with LinkedIn IDs
console.log('='.repeat(80) + '\n');
console.log('3️⃣ CHECKING CAMPAIGN PROSPECTS WITH LINKEDIN IDs...\n');

const { data: campaignProspects, error: cpError } = await supabase
  .from('campaign_prospects')
  .select('id, linkedin_user_id, message_status, workspace_prospects(full_name, linkedin_url)')
  .not('linkedin_user_id', 'is', null)
  .limit(5);

if (cpError) {
  console.log('❌ Error:', cpError.message);
} else {
  console.log(`Found ${campaignProspects?.length || 0} prospects with LinkedIn IDs\n`);
  
  campaignProspects?.forEach((cp, i) => {
    console.log(`${i + 1}. ${cp.workspace_prospects?.full_name || 'Unknown'}`);
    console.log(`   LinkedIn ID: ${cp.linkedin_user_id}`);
    console.log(`   Message Status: ${cp.message_status || 'Not sent'}`);
    console.log('');
  });
}

// 4. Summary of gaps
console.log('='.repeat(80) + '\n');
console.log('📋 WORKFLOW GAPS:\n');

const approvedWithoutCampaign = approvedProspects?.filter(p => !p.campaign_id).length || 0;
const approvedWithoutLinkedIn = approvedProspects?.filter(p => !p.linkedin_url).length || 0;

console.log(`⚠️  Approved prospects without campaign: ${approvedWithoutCampaign}`);
console.log(`⚠️  Approved prospects without LinkedIn URL: ${approvedWithoutLinkedIn}`);
console.log('');

console.log('Next steps:');
console.log('  1. Link approved prospects to campaigns');
console.log('  2. Sync LinkedIn internal IDs for messaging');
console.log('  3. Generate AI messages for prospects');
console.log('  4. Send via Unipile execute-direct endpoint');
console.log('');
