#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔄 Backfilling company_name from prospect_approval_data\n');
console.log('This extracts company data that was ALREADY captured during LinkedIn search\n');

// Get campaign_prospects with missing company_name
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, linkedin_url, company_name, first_name, last_name')
  .or('company_name.is.null,company_name.eq.')
  .not('linkedin_url', 'is', null)
  .limit(200);

if (!prospects || prospects.length === 0) {
  console.log('✅ No prospects with missing company_name');
  process.exit(0);
}

console.log(`Found ${prospects.length} prospects with missing company_name\n`);

let fixed = 0;
let notFound = 0;
let errors = 0;

for (const prospect of prospects) {
  try {
    // Find the original approval data by matching linkedin_url
    const { data: approvalData } = await supabase
      .from('prospect_approval_data')
      .select('company, title')
      .eq('contact->>linkedin_url', prospect.linkedin_url)
      .limit(1)
      .maybeSingle();

    if (!approvalData) {
      console.log(`⚠️  No approval data found for: ${prospect.first_name} ${prospect.last_name}`);
      notFound++;
      continue;
    }

    const companyName = approvalData.company?.name || '';
    
    if (!companyName) {
      console.log(`⚠️  No company in approval data: ${prospect.first_name} ${prospect.last_name}`);
      notFound++;
      continue;
    }

    // Update the campaign_prospect with the company data
    const { error: updateError } = await supabase
      .from('campaign_prospects')
      .update({
        company_name: companyName
      })
      .eq('id', prospect.id);

    if (updateError) {
      console.log(`❌ Update failed for ${prospect.first_name} ${prospect.last_name}: ${updateError.message}`);
      errors++;
    } else {
      console.log(`✅ ${prospect.first_name} ${prospect.last_name} → ${companyName}`);
      fixed++;
    }

  } catch (error) {
    console.log(`❌ Error processing ${prospect.first_name} ${prospect.last_name}: ${error.message}`);
    errors++;
  }
}

console.log(`\n📊 Backfill Results:`);
console.log(`   ✅ Fixed: ${fixed} prospects`);
console.log(`   ⚠️  No data found: ${notFound} prospects`);
console.log(`   ❌ Errors: ${errors} prospects`);

if (fixed > 0) {
  console.log(`\n✅ ${fixed} prospects now have company names from their original LinkedIn search data!`);
}
