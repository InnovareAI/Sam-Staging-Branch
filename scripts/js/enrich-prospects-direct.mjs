#!/usr/bin/env node
/**
 * Direct BrightData Enrichment - Bypass MCP Timeout
 *
 * Uses BrightData API directly instead of MCP to avoid timeout issues
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

// BrightData credentials from env
const BRIGHTDATA_CUSTOMER = process.env.BRIGHT_DATA_CUSTOMER_ID;
const BRIGHTDATA_ZONE = process.env.BRIGHT_DATA_ZONE;
const BRIGHTDATA_PASSWORD = process.env.BRIGHT_DATA_PASSWORD;

console.log('🔧 Direct BrightData Enrichment');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Check BrightData credentials
if (!BRIGHTDATA_CUSTOMER || !BRIGHTDATA_ZONE || !BRIGHTDATA_PASSWORD) {
  console.log('❌ ERROR: Missing BrightData credentials in .env.local');
  console.log('   Required:');
  console.log('   - BRIGHTDATA_CUSTOMER');
  console.log('   - BRIGHTDATA_ZONE');
  console.log('   - BRIGHTDATA_PASSWORD\n');
  process.exit(1);
}

console.log('✅ BrightData credentials found');
console.log(`   Customer: ${BRIGHTDATA_CUSTOMER}`);
console.log(`   Zone: ${BRIGHTDATA_ZONE}\n`);

// Load bad prospect IDs
let badProspectData;
try {
  badProspectData = JSON.parse(readFileSync('/tmp/bad-company-prospect-ids.json', 'utf8'));
} catch (error) {
  console.log('❌ ERROR: Could not load /tmp/bad-company-prospect-ids.json');
  console.log('   Run the data analysis script first to identify prospects.\n');
  process.exit(1);
}

console.log(`📊 Found ${badProspectData.prospect_ids.length} prospects to enrich\n`);

/**
 * Scrape LinkedIn profile using BrightData SERP API directly
 */
async function scrapeLinkedInDirect(linkedinUrl) {
  try {
    // BrightData proxy configuration
    const proxyUrl = `http://${BRIGHTDATA_CUSTOMER}-zone-${BRIGHTDATA_ZONE}:${BRIGHTDATA_PASSWORD}@brd.superproxy.io:33335`;

    console.log('   🌐 Fetching via BrightData proxy...');

    // Use BrightData's SERP API for LinkedIn scraping
    const serpApiUrl = `https://api.brightdata.com/serp/v1/linkedin-profile`;

    const response = await fetch(serpApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BRIGHTDATA_API_TOKEN || BRIGHTDATA_PASSWORD}`
      },
      body: JSON.stringify({
        url: linkedinUrl,
        country: 'us',
        format: 'json'
      }),
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        error: `BrightData API error: ${response.status}`,
        details: errorText
      };
    }

    const data = await response.json();
    return data;

  } catch (error) {
    return {
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Parse LinkedIn profile data from BrightData response
 */
function parseProfile(profileData) {
  const profile = {
    company: null,
    title: null,
    industry: null,
    location: null,
    rawData: profileData
  };

  if (!profileData || profileData.error) {
    return profile;
  }

  // BrightData SERP API returns structured data
  if (profileData.positions && profileData.positions.length > 0) {
    const currentPosition = profileData.positions[0];
    profile.company = currentPosition.company_name;
    profile.title = currentPosition.title;
    profile.industry = currentPosition.industry;
  }

  if (profileData.location) {
    profile.location = profileData.location;
  }

  // Fallback: try to extract from other fields
  if (!profile.company && profileData.headline) {
    // Extract company from headline like "CEO at CompanyName"
    const atMatch = profileData.headline.match(/\bat\s+(.+?)(?:\s*\||$)/i);
    if (atMatch) {
      profile.company = atMatch[1].trim();
    }
  }

  return profile;
}

/**
 * Test scraping on sample prospects
 */
async function testScraping() {
  // Pick 3 diverse examples
  const sampleIds = [
    badProspectData.prospect_ids[0],  // First one
    badProspectData.prospect_ids[Math.floor(badProspectData.prospect_ids.length / 2)],  // Middle
    badProspectData.prospect_ids[badProspectData.prospect_ids.length - 1]  // Last
  ];

  console.log('🧪 Testing 3 sample prospects...\n');

  // Get sample prospects
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, company_name, title, linkedin_url')
    .in('id', sampleIds);

  if (error || !prospects) {
    console.error('❌ Failed to fetch prospects:', error?.message);
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < prospects.length; i++) {
    const prospect = prospects[i];
    const prospectName = `${prospect.first_name} ${prospect.last_name}`;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`SAMPLE ${i + 1} of ${prospects.length}: ${prospectName}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`📝 Current Data (BAD):`);
    console.log(`   Name: ${prospectName}`);
    console.log(`   Company: "${prospect.company_name}"`);
    console.log(`   Title: "${prospect.title}"`);
    console.log(`   LinkedIn: ${prospect.linkedin_url}\n`);

    // Normalize LinkedIn URL
    const cleanUrl = prospect.linkedin_url.split('?')[0];
    console.log(`   🔗 Clean URL: ${cleanUrl}\n`);

    // Scrape with BrightData directly
    const startTime = Date.now();
    const profileData = await scrapeLinkedInDirect(cleanUrl);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`   ⏱️  Scraping time: ${duration}s\n`);

    if (profileData.error) {
      console.log(`   ❌ SCRAPING FAILED`);
      console.log(`   Error: ${profileData.error}`);
      if (profileData.details) {
        console.log(`   Details: ${profileData.details.substring(0, 200)}`);
      }
      console.log('\n');
      failCount++;
      continue;
    }

    const parsed = parseProfile(profileData);

    console.log(`   📊 EXTRACTED DATA (NEW):`);
    console.log(`   ─────────────────────────────────────`);

    if (parsed.company) {
      console.log(`   ✅ Company: "${parsed.company}"`);
    } else {
      console.log(`   ❌ Company: NOT FOUND`);
    }

    if (parsed.title) {
      console.log(`   ✅ Title: "${parsed.title}"`);
    } else {
      console.log(`   ❌ Title: NOT FOUND`);
    }

    if (parsed.industry) {
      console.log(`   ✅ Industry: "${parsed.industry}"`);
    }

    console.log(`   ─────────────────────────────────────\n`);

    // Compare
    console.log(`   📈 COMPARISON:`);
    console.log(`   ─────────────────────────────────────`);
    console.log(`   Old company: "${prospect.company_name}"`);
    console.log(`   New company: "${parsed.company || 'NOT FOUND'}"`);
    console.log(`   ─────────────────────────────────────`);

    if (parsed.company && parsed.company !== prospect.company_name) {
      console.log(`   ✅ IMPROVEMENT: Got real company name!`);
      successCount++;
    } else if (!parsed.company) {
      console.log(`   ⚠️  WARNING: Could not extract company`);
      failCount++;
    } else {
      console.log(`   ℹ️  Same company name`);
      successCount++;
    }

    console.log('\n');

    // Rate limiting
    if (i < prospects.length - 1) {
      console.log(`⏳ Waiting 5 seconds before next scrape...\n`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 TEST SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Success Rate: ${((successCount / prospects.length) * 100).toFixed(1)}%\n`);

  if (successCount > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 NEXT STEPS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Data extraction is working!');
    console.log(`\nTo enrich all ${badProspectData.prospect_ids.length} prospects:`);
    console.log('  node scripts/js/enrich-all-prospects.mjs\n');
  } else {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  TROUBLESHOOTING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Data extraction failed. Possible issues:');
    console.log('1. BrightData credentials invalid');
    console.log('2. BrightData SERP API not available');
    console.log('3. LinkedIn URLs require different scraping method');
    console.log('4. Need to use BrightData Scraping Browser instead\n');
  }
}

testScraping().catch(console.error);
