#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔄 Extracting company names from title field\n');
console.log('This uses data ALREADY captured during LinkedIn search\n');

// Get prospects with missing company_name but has title
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, company_name, title')
  .or('company_name.is.null,company_name.eq.,company_name.eq.Unknown Company')
  .not('title', 'is', null)
  .limit(200);

if (!prospects || prospects.length === 0) {
  console.log('✅ No prospects need company extraction');
  process.exit(0);
}

console.log(`Found ${prospects.length} prospects to process\n`);

function extractCompanyFromTitle(title) {
  if (!title) return null;
  
  // Pattern 1: "Position at Company"
  if (title.includes(' at ')) {
    const parts = title.split(' at ');
    if (parts.length > 1) {
      // Take everything after the last " at "
      let company = parts.slice(1).join(' at ').trim();
      // Clean up: remove everything after | or parentheses
      company = company.split('|')[0].trim();
      company = company.split('(')[0].trim();
      return company;
    }
  }
  
  // Pattern 2: "Position @ Company"
  if (title.includes(' @ ')) {
    const parts = title.split(' @ ');
    if (parts.length > 1) {
      let company = parts.slice(1).join(' @ ').trim();
      company = company.split('|')[0].trim();
      company = company.split('(')[0].trim();
      return company;
    }
  }
  
  // Pattern 3: "Position | Company" (take last segment if looks like company)
  if (title.includes(' | ')) {
    const parts = title.split(' | ');
    // If last part looks like a company (Capital letters, not just keywords)
    const lastPart = parts[parts.length - 1].trim();
    if (lastPart.length > 3 && /^[A-Z]/.test(lastPart)) {
      return lastPart;
    }
  }
  
  return null;
}

let extracted = 0;
let noMatch = 0;

for (const prospect of prospects) {
  const company = extractCompanyFromTitle(prospect.title);
  
  if (!company || company.length < 3) {
    console.log(`⚠️  No company found: ${prospect.first_name} ${prospect.last_name}`);
    console.log(`   Title: "${prospect.title}"`);
    noMatch++;
    continue;
  }
  
  // Update the prospect
  const { error } = await supabase
    .from('campaign_prospects')
    .update({ company_name: company })
    .eq('id', prospect.id);
  
  if (error) {
    console.log(`❌ Update failed: ${error.message}`);
  } else {
    console.log(`✅ ${prospect.first_name || '(no name)'} ${prospect.last_name || ''} → ${company}`);
    extracted++;
  }
}

console.log(`\n📊 Extraction Results:`);
console.log(`   ✅ Extracted: ${extracted} companies`);
console.log(`   ⚠️  No match: ${noMatch} prospects`);

if (extracted > 0) {
  console.log(`\n✅ ${extracted} prospects now have company names extracted from their LinkedIn titles!`);
  console.log('This data was already in the database - no external API calls needed.');
}

