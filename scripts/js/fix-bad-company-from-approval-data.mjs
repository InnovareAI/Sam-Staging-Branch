#!/usr/bin/env node
/**
 * Fix Bad Company Data from Prospect Approval Data
 * Specifically targets the 35 prospects with headline stored as company_name
 * Extracts correct company from original Sales Navigator scraping data
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 Fixing Bad Company Data from Original Sales Navigator Scrape');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Load bad prospect IDs
const badProspectData = JSON.parse(readFileSync('/tmp/bad-company-prospect-ids.json', 'utf8'));
const prospectIds = badProspectData.prospect_ids;

console.log(`📊 Prospects to fix: ${prospectIds.length}`);
console.log(`📋 Campaign: ${badProspectData.campaign_name}\n`);

async function fixProspects() {
  // Get prospects that need fixing
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, company_name, title, linkedin_url')
    .in('id', prospectIds);

  if (error || !prospects) {
    console.error('❌ Failed to fetch prospects:', error?.message);
    process.exit(1);
  }

  console.log(`\n🔄 Processing ${prospects.length} prospects...\n`);

  let fixed = 0;
  let notFound = 0;
  let alreadyGood = 0;
  let errors = 0;

  for (const prospect of prospects) {
    const prospectName = `${prospect.first_name} ${prospect.last_name}`;

    console.log(`\n📝 ${prospectName}`);
    console.log(`   Current company: "${prospect.company_name}"`);
    console.log(`   LinkedIn: ${prospect.linkedin_url}`);

    try {
      // Normalize LinkedIn URL - remove query parameters for matching
      // Campaign prospects have: https://www.linkedin.com/in/username?miniProfileUrn=urn...
      // Approval data has: https://www.linkedin.com/in/username
      const normalizedUrl = prospect.linkedin_url.split('?')[0];
      console.log(`   🔗 Normalized URL: ${normalizedUrl}`);

      // Find the original approval data by matching normalized linkedin_url
      // Query all approval data and search in memory (since contact field is JSONB)
      const { data: approvalDataList, error: approvalError } = await supabase
        .from('prospect_approval_data')
        .select('id, contact, company, title, created_at')
        .order('created_at', { ascending: false });

      if (approvalError) {
        console.log(`   ❌ Error querying approval data: ${approvalError.message}`);
        errors++;
        continue;
      }

      if (!approvalDataList || approvalDataList.length === 0) {
        console.log(`   ⚠️  No approval data found in table`);
        notFound++;
        continue;
      }

      console.log(`   🔍 Searching ${approvalDataList.length} approval records...`);

      // Search through approval data for matching LinkedIn URL
      let matchingApproval = null;
      for (const approval of approvalDataList) {
        const contactLinkedIn = approval.contact?.linkedin_url || approval.contact?.linkedInUrl;

        if (!contactLinkedIn) continue;

        // Normalize both URLs for comparison
        const normalizedContactUrl = contactLinkedIn.split('?')[0];

        if (normalizedContactUrl === normalizedUrl) {
          matchingApproval = approval;
          break;
        }
      }

      if (!matchingApproval) {
        console.log(`   ⚠️  No matching approval data for LinkedIn URL`);
        notFound++;
        continue;
      }

      console.log(`   ✅ Found matching approval data (ID: ${matchingApproval.id})`);

      // Extract company from the approval data
      // Check multiple possible locations
      let companyName = null;

      // Priority 1: company field (if exists)
      if (matchingApproval.company?.name) {
        companyName = matchingApproval.company.name;
        console.log(`   📌 Found company in 'company.name': "${companyName}"`);
      }

      // Priority 2: contact.company
      if (!companyName && matchingApproval.contact?.company) {
        companyName = matchingApproval.contact.company;
        console.log(`   📌 Found company in 'contact.company': "${companyName}"`);
      }

      // Priority 3: contact.current_positions[0].company (Sales Navigator data)
      if (!companyName && matchingApproval.contact?.current_positions?.length > 0) {
        companyName = matchingApproval.contact.current_positions[0].company;
        console.log(`   📌 Found company in 'current_positions[0].company': "${companyName}"`);
      }

      // Priority 4: Parse from headline if it has "at [Company]" format
      if (!companyName && matchingApproval.contact?.headline) {
        const headline = matchingApproval.contact.headline;
        if (headline.includes(' at ')) {
          const parts = headline.split(' at ');
          const extracted = parts.slice(1).join(' at ').trim();

          // Validate it's not another headline-like pattern
          if (!extracted.includes('|') && !extracted.includes('•')) {
            companyName = extracted;
            console.log(`   📌 Extracted company from headline: "${companyName}"`);
          }
        }
      }

      if (!companyName) {
        console.log(`   ⚠️  No company found in approval data`);
        console.log(`   📋 Available fields: ${Object.keys(matchingApproval.contact || {}).join(', ')}`);
        notFound++;
        continue;
      }

      // Check if extracted company is actually valid (not a headline)
      const headlinePatterns = [
        /\|/,  // Pipes
        /•/,   // Bullets
        /\bCEO\b|\bCOO\b|\bVP\b|\bDirector\b|\bManager\b/i,
        /Strategy|Innovation|Leader|Executive/i,
        /Healthcare.*Life Sciences|Life Sciences.*Healthcare/i
      ];

      const isHeadlineLike = headlinePatterns.some(pattern => pattern.test(companyName));

      if (isHeadlineLike) {
        console.log(`   ⚠️  Extracted company looks like headline: "${companyName}"`);
        notFound++;
        continue;
      }

      // Update the campaign_prospect with the correct company data
      console.log(`   💾 Updating to: "${companyName}"`);

      const { error: updateError } = await supabase
        .from('campaign_prospects')
        .update({
          company_name: companyName,
          title: matchingApproval.title || prospect.title
        })
        .eq('id', prospect.id);

      if (updateError) {
        console.log(`   ❌ Update failed: ${updateError.message}`);
        errors++;
      } else {
        console.log(`   ✅ Successfully updated!`);
        fixed++;
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      errors++;
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RESULTS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`✅ Fixed: ${fixed}`);
  console.log(`⚠️  Not found/no data: ${notFound}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📊 Total processed: ${prospects.length}\n`);

  if (fixed > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 NEXT STEP:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Run message regeneration script:');
    console.log('  node scripts/js/regenerate-personalization.mjs\n');
  } else {
    console.log('\n⚠️  WARNING: No prospects were fixed!');
    console.log('\nPossible reasons:');
    console.log('1. Approval data table is empty or missing these prospects');
    console.log('2. LinkedIn URLs don\'t match between tables');
    console.log('3. Original scrape data didn\'t include company information\n');
    console.log('Next steps:');
    console.log('- Check prospect_approval_data table manually');
    console.log('- Verify LinkedIn URLs match exactly');
    console.log('- Consider manual CSV correction instead\n');
  }
}

fixProspects().catch(console.error);
