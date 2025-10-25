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

console.log('\n🔍 PROSPECT → CAMPAIGN FLOW ANALYSIS\n');
console.log('='.repeat(80) + '\n');

// 1. Check workspace_prospects by approval status
console.log('1️⃣ WORKSPACE_PROSPECTS BY APPROVAL STATUS:\n');

const { data: prospectStats } = await supabase
  .from('workspace_prospects')
  .select('approval_status');

const statuses = {};
prospectStats?.forEach(p => {
  statuses[p.approval_status || 'null'] = (statuses[p.approval_status || 'null'] || 0) + 1;
});

Object.entries(statuses).forEach(([status, count]) => {
  console.log(`   ${status}: ${count}`);
});
console.log('');

// 2. Check approved prospects
const { data: approvedProspects } = await supabase
  .from('workspace_prospects')
  .select('id, full_name, approval_status, linkedin_url, workspace_id, created_at')
  .eq('approval_status', 'approved')
  .order('created_at', { ascending: false })
  .limit(10);

console.log('='.repeat(80) + '\n');
console.log(`2️⃣ APPROVED PROSPECTS (${approvedProspects?.length || 0} shown):\n`);

approvedProspects?.forEach((p, i) => {
  console.log(`${i + 1}. ${p.full_name || 'Unnamed'}`);
  console.log(`   ID: ${p.id}`);
  console.log(`   LinkedIn: ${p.linkedin_url ? 'Yes' : 'No'}`);
  console.log(`   Approved: ${new Date(p.created_at).toLocaleDateString()}`);
  console.log('');
});

// 3. Check if these are in campaign_prospects
console.log('='.repeat(80) + '\n');
console.log('3️⃣ CHECKING IF APPROVED PROSPECTS ARE IN CAMPAIGNS:\n');

for (const prospect of approvedProspects?.slice(0, 5) || []) {
  const { data: campaignProspect } = await supabase
    .from('campaign_prospects')
    .select('campaign_id, campaigns(name)')
    .eq('prospect_id', prospect.id)
    .single();
  
  console.log(`${prospect.full_name || prospect.id.substring(0, 8)}...`);
  if (campaignProspect) {
    console.log(`   ✅ In campaign: ${campaignProspect.campaigns?.name}`);
  } else {
    console.log(`   ❌ NOT in any campaign`);
  }
  console.log('');
}

// 4. Summary
console.log('='.repeat(80) + '\n');
console.log('💡 CURRENT STATE:\n');

const approvedNotInCampaign = [];
for (const prospect of approvedProspects || []) {
  const { data } = await supabase
    .from('campaign_prospects')
    .select('id')
    .eq('prospect_id', prospect.id)
    .single();
  
  if (!data) {
    approvedNotInCampaign.push(prospect);
  }
}

console.log(`Total approved prospects: ${approvedProspects?.length || 0}`);
console.log(`Approved but NOT in campaigns: ${approvedNotInCampaign.length}`);
console.log('');

if (approvedNotInCampaign.length > 0) {
  console.log('⚠️  These approved prospects need to be added to campaigns:\n');
  approvedNotInCampaign.slice(0, 5).forEach(p => {
    console.log(`   - ${p.full_name || p.id.substring(0, 8)}...`);
  });
  console.log('');
}

console.log('📋 WORKFLOW GAP IDENTIFIED:\n');
console.log('Current flow:');
console.log('  1. Import prospects → workspace_prospects');
console.log('  2. Approve prospects → approval_status = "approved"');
console.log('  3. ⚠️  MISSING: Link approved prospects to campaign');
console.log('  4. Campaign prospects → campaign_prospects table');
console.log('');
console.log('Needed:');
console.log('  → After approval, show "Add to Campaign" UI');
console.log('  → Or auto-create campaign from approved prospects');
console.log('');
