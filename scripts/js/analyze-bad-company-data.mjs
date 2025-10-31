#!/usr/bin/env node
/**
 * Analyze Bad Company Data
 * Identifies prospects with headline data in company_name field
 */
import { createClient } from '@supabase/supabase-js';
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

const CAMPAIGN_ID = '51803ded-bbc9-4564-aefb-c6d11d69f17c';

console.log('🔍 Analyzing company data quality\n');

async function analyzeBadData() {
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, company_name, title, linkedin_url')
    .eq('campaign_id', CAMPAIGN_ID);

  if (error || !prospects) {
    console.error('❌ Error fetching prospects:', error?.message);
    return;
  }

  console.log(`📊 Total prospects: ${prospects.length}\n`);

  // Patterns that indicate headline data in company field
  const headlinePatterns = [
    /healthcare.*life sciences|life sciences.*healthcare/i,
    /\||•|&|@/,  // Common headline separators
    /\bCOO\b|\bCEO\b|\bVP\b|\bDirector\b|\bManager\b/i,  // Titles in company field
    /Executive|Leader|Strategist|Consultant/i,
    /Digital|Innovation|Strategy|Growth/i
  ];

  const badCompanyData = [];
  const unknownCompany = [];
  const emptyCompany = [];
  const goodCompany = [];

  for (const prospect of prospects) {
    const companyName = prospect.company_name || '';

    if (companyName === 'Unknown Company') {
      unknownCompany.push(prospect);
    } else if (!companyName || companyName.trim() === '') {
      emptyCompany.push(prospect);
    } else {
      // Check if company name matches headline patterns
      const matchesHeadlinePattern = headlinePatterns.some(pattern =>
        pattern.test(companyName)
      );

      if (matchesHeadlinePattern) {
        badCompanyData.push(prospect);
      } else {
        goodCompany.push(prospect);
      }
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ANALYSIS RESULTS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`❌ Bad company data (headline in company field): ${badCompanyData.length}`);
  console.log(`⚠️  Unknown Company: ${unknownCompany.length}`);
  console.log(`⚠️  Empty/blank company: ${emptyCompany.length}`);
  console.log(`✅ Good company data: ${goodCompany.length}\n`);

  if (badCompanyData.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`❌ HEADLINE DATA IN COMPANY FIELD (${badCompanyData.length} prospects):`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    badCompanyData.forEach((p, i) => {
      console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`   Company (BAD): "${p.company_name}"`);
      console.log(`   Title: "${p.title}"`);
      console.log(`   LinkedIn: ${p.linkedin_url}`);
      console.log('');
    });
  }

  if (unknownCompany.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⚠️  UNKNOWN COMPANY (${unknownCompany.length} prospects):`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    unknownCompany.slice(0, 5).forEach((p, i) => {
      console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`   Title: "${p.title}"`);
      console.log(`   LinkedIn: ${p.linkedin_url}`);
      console.log('');
    });

    if (unknownCompany.length > 5) {
      console.log(`   ... and ${unknownCompany.length - 5} more\n`);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 RECOMMENDED ACTIONS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const totalBad = badCompanyData.length + unknownCompany.length + emptyCompany.length;

  console.log(`1. Fix ${totalBad} prospect records with missing/wrong company data`);
  console.log('2. Extract real company names from LinkedIn profiles');
  console.log('3. Regenerate personalized messages with correct company names');
  console.log('4. Fix the root cause in data import process\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 NEXT STEPS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Option 1: Manual fix via LinkedIn profile scraping');
  console.log('  - Use Unipile/LinkedIn API to get real company names');
  console.log('  - Update campaign_prospects.company_name');
  console.log('  - Regenerate personalization_data.message\n');

  console.log('Option 2: Ask client for prospect list with correct company names');
  console.log('  - Export bad prospects to CSV');
  console.log('  - Client provides correct company data');
  console.log('  - Import and update\n');

  // Export IDs for fixing
  const idsToFix = [
    ...badCompanyData.map(p => p.id),
    ...unknownCompany.map(p => p.id),
    ...emptyCompany.map(p => p.id)
  ];

  console.log(`🔑 Prospect IDs to fix (${idsToFix.length} total):`);
  console.log('   Saved to: /tmp/bad-company-prospect-ids.json\n');

  // Save to file
  const fs = await import('fs');
  fs.writeFileSync('/tmp/bad-company-prospect-ids.json', JSON.stringify({
    campaign_id: CAMPAIGN_ID,
    campaign_name: '20251028-3AI-SEO search 3',
    total_prospects: prospects.length,
    needs_fixing: idsToFix.length,
    breakdown: {
      headline_in_company: badCompanyData.length,
      unknown_company: unknownCompany.length,
      empty_company: emptyCompany.length
    },
    prospect_ids: idsToFix,
    bad_examples: badCompanyData.slice(0, 10).map(p => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      bad_company: p.company_name,
      title: p.title,
      linkedin_url: p.linkedin_url
    }))
  }, null, 2));

  console.log('✅ Analysis complete\n');
}

analyzeBadData().catch(console.error);
