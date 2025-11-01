#!/usr/bin/env node

/**
 * 🚀 ULTRAHARD MODE: ICP Enrichment Speed Test
 * Tests the full ICP enrichment pipeline with BrightData
 */

const API_URL = 'https://app.meet-sam.com';
const WORKSPACE_ID = 'b9ad0c85-c30b-4c29-a58c-2ca7e3aeb41c'; // InnovareAI workspace

// Test prospect - Satya Nadella (Microsoft CEO)
const TEST_PROSPECT = {
  linkedin_url: 'https://www.linkedin.com/in/satyanadella',
  first_name: 'Satya',
  last_name: 'Nadella',
  company_name: 'Microsoft',
  website_url: 'https://www.microsoft.com',
  email_address: 'satya@microsoft.com',
  job_title: 'Chairman and CEO',
  source: 'manual'
};

async function testICPEnrichment() {
  console.log('🚀 ULTRAHARD MODE: ICP Enrichment Speed Test\n');
  console.log('=' + '='.repeat(70));
  console.log('📊 TEST PROSPECT');
  console.log('=' + '='.repeat(70));
  console.log(`Name: ${TEST_PROSPECT.first_name} ${TEST_PROSPECT.last_name}`);
  console.log(`Company: ${TEST_PROSPECT.company_name}`);
  console.log(`Title: ${TEST_PROSPECT.job_title}`);
  console.log(`LinkedIn: ${TEST_PROSPECT.linkedin_url}`);
  console.log(`Website: ${TEST_PROSPECT.website_url}\n`);

  // Phase 1: Direct BrightData Test
  console.log('=' + '='.repeat(70));
  console.log('🔬 PHASE 1: Direct BrightData LinkedIn Scrape');
  console.log('=' + '='.repeat(70) + '\n');

  const bdStartTime = Date.now();

  try {
    const bdResponse = await fetch(`${API_URL}/api/leads/brightdata-scraper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'enrich_linkedin_profiles',
        linkedin_urls: [TEST_PROSPECT.linkedin_url],
        include_contact_info: true,
        include_company_info: true
      })
    });

    const bdElapsed = Date.now() - bdStartTime;
    console.log(`⏱️  BrightData Response Time: ${(bdElapsed / 1000).toFixed(2)}s`);
    console.log(`📊 Status: ${bdResponse.status} ${bdResponse.statusText}\n`);

    if (bdResponse.ok) {
      const bdData = await bdResponse.json();
      console.log('✅ BrightData Scrape: SUCCESS');
      console.log(`📦 Profiles Enriched: ${bdData.enriched_profiles?.length || 0}`);

      if (bdData.enriched_profiles?.[0]) {
        const profile = bdData.enriched_profiles[0];
        console.log(`\n📌 Extracted Data:`);
        console.log(`   Company: ${profile.company_name || 'N/A'}`);
        console.log(`   Title: ${profile.job_title || 'N/A'}`);
        console.log(`   Location: ${profile.location || 'N/A'}`);
        console.log(`   Industry: ${profile.industry || 'N/A'}`);
        console.log(`   Status: ${profile.verification_status}`);
      }
    } else {
      const errorText = await bdResponse.text();
      console.log('❌ BrightData Scrape: FAILED');
      console.log(`Error: ${errorText.substring(0, 300)}`);
    }
  } catch (error) {
    console.error('❌ BrightData Test Error:', error.message);
  }

  // Phase 2: Full ICP Enrichment Pipeline
  console.log('\n' + '=' + '='.repeat(70));
  console.log('🔬 PHASE 2: Full ICP Enrichment Pipeline');
  console.log('=' + '='.repeat(70));
  console.log('⚠️  Note: Requires authentication - testing from browser console\n');

  console.log('📋 To test full ICP enrichment, run this in browser console:');
  console.log('=' + '='.repeat(70));
  console.log(`
fetch('${API_URL}/api/data-enrichment/enrich', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  credentials: 'include',
  body: JSON.stringify({
    prospect_data: ${JSON.stringify(TEST_PROSPECT, null, 2)},
    user_id: 'YOUR_USER_ID',
    workspace_id: '${WORKSPACE_ID}',
    enrichment_depth: 'standard'
  })
}).then(r => r.json()).then(d => {
  console.log('ICP Enrichment Result:', d);
  if (d.enriched_data) {
    console.log('ICP Score:', d.enriched_data.service_fit_analysis?.icp_score);
    console.log('Confidence:', d.enriched_data.confidence_score);
    console.log('Data Sources:', d.enriched_data.data_sources);
  }
});
  `.trim());
  console.log('=' + '='.repeat(70) + '\n');

  // Summary
  console.log('=' + '='.repeat(70));
  console.log('📊 SPEED TEST SUMMARY');
  console.log('=' + '='.repeat(70) + '\n');

  console.log('⚡ Expected Performance:');
  console.log('  • BrightData LinkedIn Scrape: 30-60s per profile');
  console.log('  • Website Analysis: 5-15s (if implemented)');
  console.log('  • ICP Scoring: 2-5s (AI analysis)');
  console.log('  • Total ICP Enrichment: 40-80s per prospect\n');

  console.log('🎯 Bottlenecks:');
  console.log('  1. BrightData scraping (largest factor)');
  console.log('  2. Website intelligence gathering');
  console.log('  3. AI service fit analysis\n');

  console.log('🚀 Optimization Ideas:');
  console.log('  • Parallel scraping (LinkedIn + Website)');
  console.log('  • Cache frequently accessed profiles');
  console.log('  • Batch processing for multiple prospects');
  console.log('  • Incremental enrichment (basic → comprehensive)\n');
}

testICPEnrichment().catch(console.error);
