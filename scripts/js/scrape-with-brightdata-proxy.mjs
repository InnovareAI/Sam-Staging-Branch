#!/usr/bin/env node
/**
 * Scrape LinkedIn Profiles Using BrightData Proxy
 * Uses BrightData residential proxies to scrape complete profile data
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 Re-scraping Bad Prospects with BrightData Proxy');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// BrightData proxy configuration
const BRIGHTDATA_USERNAME = `${process.env.BRIGHT_DATA_CUSTOMER_ID}-zone-${process.env.BRIGHT_DATA_ZONE}`;
const BRIGHTDATA_PASSWORD = process.env.BRIGHT_DATA_PASSWORD;
const BRIGHTDATA_HOST = 'brd.superproxy.io';
const BRIGHTDATA_PORT = 22225;

// Build proxy URL
const proxyUrl = `http://${BRIGHTDATA_USERNAME}:${BRIGHTDATA_PASSWORD}@${BRIGHTDATA_HOST}:${BRIGHTDATA_PORT}`;
console.log(`📡 Proxy configured: ${BRIGHTDATA_USERNAME}@${BRIGHTDATA_HOST}:${BRIGHTDATA_PORT}\n`);

// Load bad prospect IDs
const badProspectData = JSON.parse(readFileSync('/tmp/bad-company-prospect-ids.json', 'utf8'));
const prospectIds = badProspectData.prospect_ids;

console.log(`📊 Prospects to fix: ${prospectIds.length}`);
console.log(`📋 Campaign: ${badProspectData.campaign_name}\n`);

/**
 * Scrape LinkedIn profile using BrightData proxy
 */
async function scrapeLinkedInProfile(linkedinUrl) {
  try {
    const agent = new HttpsProxyAgent(proxyUrl);

    const response = await fetch(linkedinUrl, {
      agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const html = await response.text();

    // Parse HTML to extract profile data
    return parseLinkedInHTML(html, linkedinUrl);

  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Parse LinkedIn HTML to extract profile information
 */
function parseLinkedInHTML(html, url) {
  const profile = {
    company: null,
    title: null,
    experience: []
  };

  try {
    // Look for JSON-LD structured data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/is);
    if (jsonLdMatch) {
      const jsonData = JSON.parse(jsonLdMatch[1]);
      if (jsonData.jobTitle) {
        profile.title = jsonData.jobTitle;
      }
      if (jsonData.worksFor && jsonData.worksFor.name) {
        profile.company = jsonData.worksFor.name;
      }
    }

    // Look for Open Graph meta tags
    const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    if (ogTitleMatch && !profile.title) {
      // Format: "Name - Title at Company"
      const titleParts = ogTitleMatch[1].split(' - ');
      if (titleParts.length > 1) {
        const jobAndCompany = titleParts[1].split(' at ');
        if (jobAndCompany.length === 2) {
          profile.title = jobAndCompany[0].trim();
          profile.company = jobAndCompany[1].trim();
        }
      }
    }

    // Look for experience section in HTML
    const experienceMatch = html.match(/<section[^>]*aria-label="Experience"[^>]*>(.*?)<\/section>/is);
    if (experienceMatch) {
      // Extract company names from experience entries
      const companyMatches = experienceMatch[1].matchAll(/<span[^>]*>([^<]+)<\/span>/g);
      for (const match of companyMatches) {
        const text = match[1].trim();
        if (text && text.length > 2 && text.length < 100) {
          profile.experience.push(text);
        }
      }
    }

    // If still no company, try to extract from page title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch && !profile.company) {
      const pageTitle = titleMatch[1];
      const atMatch = pageTitle.match(/at\s+([^-|]+)/i);
      if (atMatch) {
        profile.company = atMatch[1].trim();
      }
    }

    return profile;

  } catch (error) {
    console.error('Error parsing LinkedIn HTML:', error);
    return {
      error: 'Failed to parse LinkedIn profile HTML',
      details: error.message
    };
  }
}

async function rescrapeProspects() {
  // Get prospects that need fixing
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, company_name, title, linkedin_url')
    .in('id', prospectIds)
    .limit(3); // TEST WITH 3 FIRST

  if (error || !prospects) {
    console.error('❌ Failed to fetch prospects:', error?.message);
    process.exit(1);
  }

  console.log(`\n🔄 Testing ${prospects.length} prospects first...\n`);

  let fixed = 0;
  let failed = 0;

  for (const prospect of prospects) {
    const prospectName = `${prospect.first_name} ${prospect.last_name}`;

    console.log(`\n📝 ${prospectName}`);
    console.log(`   Current company: "${prospect.company_name}"`);
    console.log(`   LinkedIn: ${prospect.linkedin_url}`);

    // Normalize LinkedIn URL
    const cleanUrl = prospect.linkedin_url.split('?')[0];
    console.log(`   🔗 Scraping: ${cleanUrl}`);

    // Scrape with BrightData Proxy
    console.log(`   🌐 Using BrightData proxy...`);
    const startTime = Date.now();
    const profileData = await scrapeLinkedInProfile(cleanUrl);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`   ⏱️  Scraping time: ${duration}s`);

    if (profileData.error) {
      console.log(`   ❌ Failed: ${profileData.error}`);
      failed++;
      await new Promise(resolve => setTimeout(resolve, 2000));
      continue;
    }

    console.log(`   📦 Raw data:`, JSON.stringify(profileData, null, 2));

    if (profileData.company) {
      console.log(`   ✅ Extracted company: "${profileData.company}"`);
      console.log(`   💼 Title: "${profileData.title || 'N/A'}"`);

      console.log(`\n   📈 COMPARISON:`);
      console.log(`   Old: "${prospect.company_name}"`);
      console.log(`   New: "${profileData.company}"`);

      if (profileData.company !== prospect.company_name) {
        console.log(`   ✅ IMPROVEMENT!`);
        fixed++;
      }
    } else {
      console.log(`   ⚠️  No company data extracted`);
      failed++;
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds between requests
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 TEST RESULTS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`✅ Successfully extracted: ${fixed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total tested: ${prospects.length}\n`);

  if (fixed > 0) {
    console.log('🎯 NEXT STEP:');
    console.log('If results look good, remove .limit(3) and run full scrape\n');
  } else {
    console.log('⚠️  BrightData proxy scraping did not work.');
    console.log('LinkedIn likely requires authentication to view full profiles.\n');
    console.log('RECOMMENDED: Use Thorsten\'s Sales Navigator account instead.\n');
  }
}

rescrapeProspects().catch(console.error);
