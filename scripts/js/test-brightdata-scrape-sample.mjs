#!/usr/bin/env node
/**
 * Test BrightData Scraping - Sample Preview
 * Scrapes 2-3 prospects to show data quality before full enrichment
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

console.log('🧪 Testing BrightData Scraping - Sample Preview');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('This will scrape 3 sample prospects to show data quality');
console.log('before we enrich all 35 prospects.\n');

// Load bad prospect IDs
const badProspectData = JSON.parse(readFileSync('/tmp/bad-company-prospect-ids.json', 'utf8'));

// Pick 3 diverse examples
const sampleProspectIds = [
  badProspectData.prospect_ids[0],  // First one
  badProspectData.prospect_ids[6],  // Danni L (has some company data)
  badProspectData.prospect_ids[7]   // Darrick Chan (has Bain & Company)
];

console.log(`📊 Testing ${sampleProspectIds.length} sample prospects\n`);

/**
 * Scrape LinkedIn profile using BrightData MCP
 */
async function scrapeLinkedInProfile(linkedinUrl) {
  try {
    console.log(`   🌐 Calling BrightData MCP...`);

    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        toolName: 'brightdata_scrape_as_markdown',
        arguments: {
          url: linkedinUrl
        },
        server: 'brightdata'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        error: `BrightData MCP error: ${response.status}`,
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
 * Parse LinkedIn profile from BrightData markdown output
 */
function parseLinkedInMarkdown(markdown) {
  const profile = {
    company: null,
    title: null,
    experience: [],
    education: [],
    rawMarkdown: markdown
  };

  if (!markdown) return profile;

  console.log('   📄 Parsing markdown content...');
  console.log(`   📏 Content length: ${markdown.length} characters\n`);

  // Show first 500 characters of markdown
  console.log('   📋 Raw content preview:');
  console.log('   ─────────────────────────────────────');
  console.log(markdown.substring(0, 500));
  console.log('   ─────────────────────────────────────\n');

  // Look for current position patterns in markdown

  // Pattern 1: "Current: Title at Company"
  const currentMatch = markdown.match(/Current[:\s]+([^\n]+?)\s+at\s+([^\n]+)/i);
  if (currentMatch) {
    profile.title = currentMatch[1].trim();
    profile.company = currentMatch[2].trim();
    console.log(`   ✅ Pattern 1 matched: "Current: Title at Company"`);
    return profile;
  }

  // Pattern 2: "## Experience" section with first entry
  const expMatch = markdown.match(/##?\s*Experience[^\n]*\n+[*-]?\s*([^\n]+?)\s+at\s+([^\n]+)/i);
  if (expMatch) {
    profile.title = expMatch[1].trim();
    profile.company = expMatch[2].trim();
    console.log(`   ✅ Pattern 2 matched: "Experience section"`);
    return profile;
  }

  // Pattern 3: Look for company name directly
  const companyMatch = markdown.match(/Company[:\s]+([^\n]+)/i);
  if (companyMatch) {
    profile.company = companyMatch[1].trim();
    console.log(`   ✅ Pattern 3 matched: "Company:"`);
  }

  // Pattern 4: Look for "Title\nCompany" pattern in structured sections
  const lines = markdown.split('\n').map(l => l.trim()).filter(l => l);
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];

    // Skip headers and common sections
    if (line.startsWith('#') || line.startsWith('Experience') || line.startsWith('Education')) {
      continue;
    }

    // If current line looks like a title and next line is a company
    if (line.length < 100 && !line.includes('http') && nextLine.length < 100) {
      if (!profile.title) {
        profile.title = line;
        profile.company = nextLine;
        console.log(`   ✅ Pattern 4 matched: "Title/Company line pairs"`);
        break;
      }
    }
  }

  return profile;
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

    // Normalize LinkedIn URL (remove query params)
    const cleanUrl = prospect.linkedin_url.split('?')[0];
    console.log(`   🔗 Clean URL: ${cleanUrl}\n`);

    // Scrape with BrightData MCP
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

    // Check what we got back
    console.log(`   📦 BrightData Response Structure:`);
    console.log(`   Keys: ${Object.keys(profileData).join(', ')}\n`);

    // Try to parse the markdown content
    const markdown = profileData.content || profileData.result || profileData.markdown || '';

    if (!markdown) {
      console.log(`   ⚠️  No markdown content found in response`);
      console.log(`   Full response:`, JSON.stringify(profileData, null, 2).substring(0, 500));
      console.log('\n');
      continue;
    }

    const parsed = parseLinkedInMarkdown(markdown);

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

    console.log(`   ─────────────────────────────────────\n`);

    // Compare old vs new
    console.log(`   📈 COMPARISON:`);
    console.log(`   ─────────────────────────────────────`);
    console.log(`   Old company: "${prospect.company_name}"`);
    console.log(`   New company: "${parsed.company || 'NOT FOUND'}"`);
    console.log(`   ─────────────────────────────────────`);

    if (parsed.company && parsed.company !== prospect.company_name) {
      console.log(`   ✅ IMPROVEMENT: Got real company name!`);
    } else if (!parsed.company) {
      console.log(`   ⚠️  WARNING: Could not extract company from BrightData`);
    } else {
      console.log(`   ℹ️  Same company name`);
    }

    console.log('\n');

    // Rate limiting
    if (i < prospects.length - 1) {
      console.log(`⏳ Waiting 3 seconds before next scrape...\n`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 TEST SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Prospects tested: ${prospects.length}`);
  console.log(`Estimated cost: ${prospects.length} × $0.01 = $${(prospects.length * 0.01).toFixed(2)}\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 NEXT STEPS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Review the extracted data above.');
  console.log('');
  console.log('If data looks good:');
  console.log('  node scripts/js/rescrape-with-brightdata-mcp.mjs');
  console.log('');
  console.log('If data extraction needs improvement:');
  console.log('  - Check BrightData MCP configuration');
  console.log('  - Adjust markdown parsing logic');
  console.log('  - Consider alternative scraping method\n');
}

// Check if dev server is running
console.log('⚠️  IMPORTANT: Make sure dev server is running!');
console.log('   Terminal 1: npm run dev');
console.log('   Terminal 2: (this script)\n');
console.log('Press Ctrl+C within 3 seconds to cancel...\n');

await new Promise(resolve => setTimeout(resolve, 3000));

testScraping().catch(console.error);
