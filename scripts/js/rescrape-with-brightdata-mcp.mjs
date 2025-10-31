#!/usr/bin/env node
/**
 * Re-scrape Bad Prospects Using BrightData MCP
 * Uses BrightData's LinkedIn scraping to get complete profile data
 * Including company name, experience, and optionally emails
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

console.log('🔧 Re-scraping Bad Prospects with BrightData MCP');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Load bad prospect IDs
const badProspectData = JSON.parse(readFileSync('/tmp/bad-company-prospect-ids.json', 'utf8'));
const prospectIds = badProspectData.prospect_ids;

console.log(`📊 Prospects to fix: ${prospectIds.length}`);
console.log(`📋 Campaign: ${badProspectData.campaign_name}\n`);

/**
 * Scrape LinkedIn profile using BrightData MCP
 */
async function scrapeLinkedInProfile(linkedinUrl) {
  try {
    // Call BrightData MCP directly via /api/mcp endpoint
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
      return { error: `BrightData MCP error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();

    // BrightData returns markdown content, parse it
    return parseLinkedInMarkdown(data.content || data.result || '');

  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Parse LinkedIn profile from BrightData markdown output
 */
function parseLinkedInMarkdown(markdown) {
  const profile = {
    company: null,
    title: null,
    experience: []
  };

  if (!markdown) return profile;

  // Look for current position patterns in markdown
  // BrightData typically structures LinkedIn profiles with headers

  // Pattern 1: "Current: Title at Company"
  const currentMatch = markdown.match(/Current[:\s]+([^\n]+?)\s+at\s+([^\n]+)/i);
  if (currentMatch) {
    profile.title = currentMatch[1].trim();
    profile.company = currentMatch[2].trim();
    return profile;
  }

  // Pattern 2: "## Experience" section with first entry
  const expMatch = markdown.match(/##?\s*Experience[^\n]*\n+[*-]?\s*([^\n]+?)\s+at\s+([^\n]+)/i);
  if (expMatch) {
    profile.title = expMatch[1].trim();
    profile.company = expMatch[2].trim();
    return profile;
  }

  // Pattern 3: Look for "Title\nCompany" pattern
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
      profile.title = line;
      profile.company = nextLine;
      return profile;
    }
  }

  return profile;
}

/**
 * Extract company name from parsed profile data
 */
function extractCompanyFromBrightData(profileData) {
  // Check if we got company and title from markdown parsing
  if (profileData.company && profileData.title) {
    return {
      company: profileData.company,
      title: profileData.title,
      email: null // Markdown scraping won't have email
    };
  }

  return null;
}

async function rescrapeProspects() {
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
  let failed = 0;
  let alreadyGood = 0;

  for (const prospect of prospects) {
    const prospectName = `${prospect.first_name} ${prospect.last_name}`;

    console.log(`\n📝 ${prospectName}`);
    console.log(`   Current company: "${prospect.company_name}"`);
    console.log(`   LinkedIn: ${prospect.linkedin_url}`);

    // Normalize LinkedIn URL (remove query params)
    const cleanUrl = prospect.linkedin_url.split('?')[0];
    console.log(`   🔗 Scraping: ${cleanUrl}`);

    // Scrape with BrightData MCP
    console.log(`   🌐 Calling BrightData MCP...`);
    const profileData = await scrapeLinkedInProfile(cleanUrl);

    if (profileData.error) {
      console.log(`   ❌ Failed: ${profileData.error}`);
      failed++;
      await new Promise(resolve => setTimeout(resolve, 2000));
      continue;
    }

    // Extract company from BrightData response
    const extracted = extractCompanyFromBrightData(profileData);

    if (!extracted || !extracted.company) {
      console.log(`   ⚠️  No company data in BrightData response`);
      console.log(`   📋 Response keys: ${Object.keys(profileData).join(', ')}`);
      failed++;
      await new Promise(resolve => setTimeout(resolve, 2000));
      continue;
    }

    console.log(`   ✅ Extracted company: "${extracted.company}"`);
    console.log(`   💼 Title: "${extracted.title}"`);
    if (extracted.email) {
      console.log(`   📧 Email: ${extracted.email}`);
    }

    // Update campaign_prospects
    const updateData = {
      company_name: extracted.company,
      title: extracted.title || prospect.title
    };

    // Add email to personalization_data if found
    if (extracted.email) {
      const currentData = prospect.personalization_data || {};
      updateData.personalization_data = {
        ...currentData,
        email: extracted.email,
        email_verified: false,
        email_source: 'brightdata'
      };
    }

    const { error: updateError } = await supabase
      .from('campaign_prospects')
      .update(updateData)
      .eq('id', prospect.id);

    if (updateError) {
      console.log(`   ❌ Update failed: ${updateError.message}`);
      failed++;
    } else {
      console.log(`   💾 Updated in database`);
      fixed++;
    }

    // Rate limiting - BrightData may have limits
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds between requests
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RESULTS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`✅ Fixed: ${fixed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total processed: ${prospects.length}\n`);

  if (fixed > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💰 COST ESTIMATE:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Prospects scraped: ${fixed}`);
    console.log(`Cost per prospect: ~$0.20`);
    console.log(`Total cost: ~$${(fixed * 0.20).toFixed(2)}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 NEXT STEP:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Run message regeneration script:');
    console.log('  node scripts/js/regenerate-personalization.mjs\n');
  } else {
    console.log('\n⚠️  WARNING: No prospects were fixed!');
    console.log('\nPossible issues:');
    console.log('1. BrightData MCP not configured correctly');
    console.log('2. BrightData API endpoint not responding');
    console.log('3. LinkedIn URLs are invalid or blocked\n');
    console.log('Next steps:');
    console.log('- Check BrightData MCP configuration in .mcp.json');
    console.log('- Test BrightData endpoint: /api/leads/brightdata-scraper');
    console.log('- Verify BrightData API credentials\n');
  }
}

rescrapeProspects().catch(console.error);
