#!/usr/bin/env node
/**
 * Test BrightData Direct - Bypass MCP Proxy
 * Tests BrightData scraping by calling their API directly
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

console.log('🧪 Testing BrightData Direct API - Sample Preview');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Load bad prospect IDs
const badProspectData = JSON.parse(readFileSync('/tmp/bad-company-prospect-ids.json', 'utf8'));

// Pick 3 diverse examples
const sampleProspectIds = [
  badProspectData.prospect_ids[0],  // First one
  badProspectData.prospect_ids[6],  // Mid
  badProspectData.prospect_ids[7]   // Another
];

console.log(`📊 Testing ${sampleProspectIds.length} sample prospects\n`);

/**
 * Extract BrightData token from .mcp.json
 */
function getBrightDataToken() {
  try {
    const mcpConfig = JSON.parse(readFileSync(join(__dirname, '../../.mcp.json'), 'utf8'));
    const brightdataArgs = mcpConfig.mcpServers?.brightdata?.args || [];

    // Token is in: https://mcp.brightdata.com/sse?token=XXX
    const tokenUrl = brightdataArgs.find(arg => arg.includes('token='));
    if (tokenUrl) {
      const match = tokenUrl.match(/token=([^&]+)/);
      return match ? match[1] : null;
    }
    return null;
  } catch (error) {
    console.error('❌ Could not read BrightData token from .mcp.json');
    return null;
  }
}

/**
 * Scrape LinkedIn profile using BrightData Direct API
 */
async function scrapeLinkedInProfile(linkedinUrl) {
  try {
    console.log(`   🌐 Calling BrightData Direct API...`);

    const token = getBrightDataToken();
    if (!token) {
      return {
        error: 'BrightData token not found in .mcp.json'
      };
    }

    // BrightData scraping endpoint
    // Note: This is a placeholder - actual BrightData API structure may differ
    const response = await fetch('https://api.brightdata.com/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: linkedinUrl,
        format: 'structured',
        fields: ['name', 'company', 'title', 'experience']
      })
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

async function testScraping() {
  // Get sample prospects
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, company_name, title, linkedin_url')
    .in('id', sampleProspectIds);

  if (error || !prospects) {
    console.error('❌ Failed to fetch prospects:', error?.message);
    process.exit(1);
  }

  console.log(`🔄 Testing ${prospects.length} prospects...\n`);

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

    // Test BrightData Direct
    const startTime = Date.now();
    const profileData = await scrapeLinkedInProfile(cleanUrl);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`   ⏱️  Scraping time: ${duration}s\n`);

    if (profileData.error) {
      console.log(`   ❌ SCRAPING FAILED`);
      console.log(`   Error: ${profileData.error}`);
      if (profileData.details) {
        console.log(`   Details: ${profileData.details}`);
      }
      console.log('\n');
      continue;
    }

    console.log(`   📦 BrightData Response:`, JSON.stringify(profileData, null, 2).substring(0, 500));
    console.log('\n');

    if (i < prospects.length - 1) {
      console.log(`⏳ Waiting 3 seconds before next scrape...\n`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 TEST COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🎯 NEXT STEPS:');
  console.log('1. Review BrightData API documentation for correct endpoint');
  console.log('2. Adjust scraping method based on their actual API structure');
  console.log('3. Consider alternative: Use Thorsten\\'s Sales Nav to re-search\n');
}

testScraping().catch(console.error);
