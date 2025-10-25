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

const campaignName = process.argv[2] || "20251025-IAI-test 03";

console.log(`\n🚨 URGENT FIX FOR: ${campaignName}\n`);

// Get campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, workspace_id')
  .eq('name', campaignName)
  .single();

if (!campaign) {
  console.error('Campaign not found');
  process.exit(1);
}

// Get prospects
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaign.id);

console.log(`Found ${prospects.length} prospects in campaign\n`);

// Get ALL pending approval data for this workspace
const { data: approvalData } = await supabase
  .from('prospect_approval_data')
  .select(`
    *,
    prospect_approval_sessions(workspace_id)
  `)
  .eq('prospect_approval_sessions.workspace_id', campaign.workspace_id);

console.log(`Found ${approvalData?.length || 0} prospects in approval data\n`);

let fixed = 0;

for (const prospect of prospects) {
  // Match by company name
  const match = approvalData?.find(ap => 
    ap.company?.name === prospect.company_name ||
    ap.company_name === prospect.company_name
  );

  if (match) {
    const linkedinUrl = match.linkedin_url || match.contact?.linkedin_url;
    const nameParts = (match.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    console.log(`✅ Matched by company: ${prospect.company_name}`);
    console.log(`   Name: ${match.name}`);
    console.log(`   LinkedIn: ${linkedinUrl}`);

    const { error } = await supabase
      .from('campaign_prospects')
      .update({
        first_name: firstName,
        last_name: lastName,
        linkedin_url: linkedinUrl,
        title: match.title || prospect.title
      })
      .eq('id', prospect.id);

    if (!error) {
      console.log(`   ✓ FIXED!\n`);
      fixed++;
    } else {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  } else {
    console.log(`⚠️  No match for company: ${prospect.company_name}\n`);
  }
}

console.log(`\n✅ FIXED ${fixed} of ${prospects.length} prospects\n`);
