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

// Get campaign name from command line
const campaignName = process.argv[2];
if (!campaignName) {
  console.error('Usage: node scripts/fix-campaign-linkedin-urls.mjs "Campaign Name"');
  process.exit(1);
}

console.log(`\n🔧 FIXING LINKEDIN URLS FOR CAMPAIGN: ${campaignName}\n`);
console.log('='.repeat(80) + '\n');

// Get the campaign
const { data: campaign, error: campaignError } = await supabase
  .from('campaigns')
  .select('id, name, workspace_id')
  .eq('name', campaignName)
  .single();

if (campaignError || !campaign) {
  console.error('❌ Campaign not found:', campaignError?.message || 'No campaign found');
  process.exit(1);
}

console.log('✅ Found campaign:', campaign.name);
console.log('   Workspace ID:', campaign.workspace_id);
console.log('   Campaign ID:', campaign.id);
console.log('\n');

// Get campaign prospects without LinkedIn URLs
const { data: prospects, error: prospectsError } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaign.id);

if (prospectsError) {
  console.error('❌ Error fetching prospects:', prospectsError.message);
  process.exit(1);
}

console.log(`📊 Total prospects in campaign: ${prospects.length}`);
const prospectsWithoutUrls = prospects.filter(p => !p.linkedin_url);
console.log(`⚠️  Prospects without LinkedIn URLs: ${prospectsWithoutUrls.length}\n`);

if (prospectsWithoutUrls.length === 0) {
  console.log('✅ All prospects already have LinkedIn URLs!\n');
  process.exit(0);
}

// Get approved prospects from approval data
const { data: approvedProspects, error: approvedError } = await supabase
  .from('prospect_approval_data')
  .select('*')
  .eq('approval_status', 'approved');

if (approvedError) {
  console.error('❌ Error fetching approval data:', approvedError.message);
  process.exit(1);
}

console.log(`📋 Found ${approvedProspects.length} approved prospects in approval data\n`);

let fixedCount = 0;

// Match prospects by name and update LinkedIn URLs
for (const prospect of prospectsWithoutUrls) {
  const fullName = `${prospect.first_name} ${prospect.last_name}`.trim();
  
  // Find matching approved prospect
  const match = approvedProspects.find(ap => 
    ap.name?.toLowerCase() === fullName.toLowerCase()
  );

  if (match && (match.linkedin_url || match.contact?.linkedin_url)) {
    const linkedinUrl = match.linkedin_url || match.contact?.linkedin_url;
    
    console.log(`✅ Matched: ${fullName}`);
    console.log(`   LinkedIn URL: ${linkedinUrl}`);
    
    // Update the prospect
    const { error: updateError } = await supabase
      .from('campaign_prospects')
      .update({ linkedin_url: linkedinUrl })
      .eq('id', prospect.id);

    if (updateError) {
      console.error(`   ❌ Failed to update: ${updateError.message}`);
    } else {
      console.log(`   ✓ Updated!\n`);
      fixedCount++;
    }
  } else {
    console.log(`⚠️  No match found for: ${fullName}`);
    if (match) {
      console.log(`   (Found prospect but no LinkedIn URL in approval data)\n`);
    } else {
      console.log(`   (Prospect not found in approval data)\n`);
    }
  }
}

console.log('='.repeat(80));
console.log(`\n✅ FIXED ${fixedCount} of ${prospectsWithoutUrls.length} prospects\n`);

// Show final stats
const { data: updatedProspects } = await supabase
  .from('campaign_prospects')
  .select('linkedin_url')
  .eq('campaign_id', campaign.id);

const withUrls = updatedProspects.filter(p => p.linkedin_url).length;
const total = updatedProspects.length;

console.log(`📊 Final Stats:`);
console.log(`   Total prospects: ${total}`);
console.log(`   With LinkedIn URLs: ${withUrls}`);
console.log(`   Ready for messaging: ${withUrls}\n`);
