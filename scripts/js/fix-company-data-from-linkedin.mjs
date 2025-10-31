#!/usr/bin/env node
/**
 * Fix Company Data from LinkedIn Profiles
 * Re-enriches prospects with bad company data using corrected extraction logic
 *
 * Accounts: Noriko's and Michelle's LinkedIn
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

// Noriko's and Michelle's Unipile account IDs
const UNIPILE_ACCOUNTS = {
  michelle: 'lN6tdIWOStK_dEaxhygCEQ',
  noriko: process.env.NORIKO_UNIPILE_ACCOUNT_ID || 'lN6tdIWOStK_dEaxhygCEQ' // Use Michelle's if Noriko's not set
};

console.log('🔧 Fixing Company Data from LinkedIn Profiles');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Load bad prospect IDs
const badProspectData = JSON.parse(readFileSync('/tmp/bad-company-prospect-ids.json', 'utf8'));
const prospectIds = badProspectData.prospect_ids;

console.log(`📊 Prospects to fix: ${prospectIds.length}`);
console.log(`📋 Campaign: ${badProspectData.campaign_name}\n`);

/**
 * Check if text looks like a LinkedIn headline instead of a company name
 */
function isHeadlineLike(text) {
  if (!text || text === 'Unknown Company') return false;

  const headlinePatterns = [
    /\|/,  // Pipes used in headlines
    /•/,   // Bullets used in headlines
    /\bCEO\b|\bCOO\b|\bCTO\b|\bCFO\b|\bVP\b|\bVice President\b|\bDirector\b|\bManager\b|\bExecutive\b/i,
    /Strategy|Innovation|Leader|Leadership|Expert|Specialist|Consultant|Adviser|Advisor/i,
    /Driving|Leading|Building|Growing|Enabling|Transforming/i,
    /Healthcare.*Life Sciences|Life Sciences.*Healthcare/i,
    /&.*&/,  // Multiple & symbols
    /@/      // Job title with @ company format
  ];

  return headlinePatterns.some(pattern => pattern.test(text));
}

/**
 * Extract company name from Unipile profile data using smart prioritization
 */
function extractCompanyName(profileData) {
  // Priority 1: Current position from experience array (most reliable)
  if (profileData.experience && Array.isArray(profileData.experience) && profileData.experience.length > 0) {
    const currentJob = profileData.experience[0];
    if (currentJob.company && !isHeadlineLike(currentJob.company)) {
      return currentJob.company;
    }
  }

  // Priority 2: Company object with name property
  if (profileData.company?.name && !isHeadlineLike(profileData.company.name)) {
    return profileData.company.name;
  }

  // Priority 3: Current position object (alternative structure)
  if (profileData.current_position?.company && !isHeadlineLike(profileData.current_position.company)) {
    return profileData.current_position.company;
  }

  // Priority 4: company_name field (validate it's not headline)
  if (profileData.company_name && !isHeadlineLike(profileData.company_name)) {
    return profileData.company_name;
  }

  // Priority 5: Try to extract from headline if it has "at Company" format
  if (profileData.headline) {
    const atMatch = profileData.headline.match(/@\s*([^|•]+)/);
    if (atMatch) {
      const company = atMatch[1].trim();
      if (!isHeadlineLike(company)) {
        return company;
      }
    }

    const atWordMatch = profileData.headline.match(/\bat\s+([^|•]+)/i);
    if (atWordMatch) {
      const company = atWordMatch[1].trim();
      if (!isHeadlineLike(company)) {
        return company;
      }
    }
  }

  return null; // Let caller handle fallback
}

/**
 * Fetch LinkedIn profile from Unipile
 */
async function fetchLinkedInProfile(linkedinUrl, unipileAccountId) {
  try {
    const linkedinUsername = linkedinUrl.split('/in/')[1]?.split('?')[0]?.replace('/', '');

    if (!linkedinUsername) {
      return { error: 'Invalid LinkedIn URL' };
    }

    const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinUsername}?account_id=${unipileAccountId}`;

    const response = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return { error: `Unipile API error: ${response.status}` };
    }

    return await response.json();

  } catch (error) {
    return { error: error.message };
  }
}

async function fixProspects() {
  // Get prospects that need fixing
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, company_name, title, linkedin_url, added_by_unipile_account')
    .in('id', prospectIds);

  if (error || !prospects) {
    console.error('❌ Failed to fetch prospects:', error?.message);
    process.exit(1);
  }

  console.log(`\n🔄 Processing ${prospects.length} prospects...\n`);

  let fixed = 0;
  let failed = 0;
  let alreadyGood = 0;

  for (const prospect of prospects) {
    const prospectName = `${prospect.first_name} ${prospect.last_name}`;

    // Determine which Unipile account to use
    const unipileAccountId = prospect.added_by_unipile_account || UNIPILE_ACCOUNTS.michelle;

    console.log(`\n📝 ${prospectName}`);
    console.log(`   Current company: "${prospect.company_name}"`);

    // Check if company is already good
    if (prospect.company_name &&
        prospect.company_name !== 'Unknown Company' &&
        !isHeadlineLike(prospect.company_name)) {
      console.log(`   ✅ Company looks good, skipping`);
      alreadyGood++;
      continue;
    }

    // Fetch fresh LinkedIn profile data
    console.log(`   🔍 Fetching LinkedIn profile...`);
    const profileData = await fetchLinkedInProfile(prospect.linkedin_url, unipileAccountId);

    if (profileData.error) {
      console.log(`   ❌ Failed: ${profileData.error}`);
      failed++;
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }

    // Extract company using smart logic
    const extractedCompany = extractCompanyName(profileData);

    if (!extractedCompany) {
      console.log(`   ⚠️  Could not extract company, using fallback`);

      // Update with whatever we can get
      const { error: updateError } = await supabase
        .from('campaign_prospects')
        .update({
          company_name: 'Unknown Company',
          personalization_data: supabase.rpc('jsonb_set', {
            target: prospect.personalization_data || {},
            path: '{re_enriched_at}',
            new_value: `"${new Date().toISOString()}"`
          })
        })
        .eq('id', prospect.id);

      if (updateError) {
        console.log(`   ❌ Update failed: ${updateError.message}`);
      }
      failed++;
      await new Promise(resolve => setTimeout(resolve, 1500));
      continue;
    }

    // Update with correct company
    console.log(`   ✅ Extracted: "${extractedCompany}"`);

    const { error: updateError } = await supabase
      .from('campaign_prospects')
      .update({
        company_name: extractedCompany,
        title: profileData.headline || prospect.title
      })
      .eq('id', prospect.id);

    if (updateError) {
      console.log(`   ❌ Update failed: ${updateError.message}`);
      failed++;
    } else {
      console.log(`   💾 Updated in database`);
      fixed++;
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RESULTS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`✅ Fixed: ${fixed}`);
  console.log(`✅ Already good: ${alreadyGood}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total processed: ${prospects.length}\n`);

  if (fixed > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 NEXT STEP:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Run message regeneration script:');
    console.log('  node scripts/js/regenerate-personalization.mjs\n');
  }
}

fixProspects().catch(console.error);
