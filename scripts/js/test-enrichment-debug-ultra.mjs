#!/usr/bin/env node

/**
 * 🚀 ULTRAHARD MODE: Debug Enrichment Failure
 * Tests the exact enrichment flow with detailed error logging
 */

const BRIGHTDATA_API_TOKEN = '61813293-6532-4e16-af76-9803cc043afa';
const BRIGHTDATA_ZONE = 'linkedin_enrichment';

// Test with a known working LinkedIn URL
const TEST_URL = 'https://www.linkedin.com/in/satyanadella';

console.log('🔍 DEBUGGING ENRICHMENT FAILURE\n');
console.log('Testing with:', TEST_URL);
console.log('Zone:', BRIGHTDATA_ZONE);
console.log('Token:', BRIGHTDATA_API_TOKEN.substring(0, 20) + '...\n');

async function testDirectBrightData() {
  console.log('1️⃣ Testing Direct BrightData API...\n');

  try {
    const response = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRIGHTDATA_API_TOKEN}`
      },
      body: JSON.stringify({
        zone: BRIGHTDATA_ZONE,
        url: TEST_URL,
        format: 'raw'
      })
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ BrightData API Error:');
      console.error(errorText);
      return false;
    }

    const html = await response.text();
    console.log(`✅ Success! Received ${html.length} bytes`);
    console.log(`HTML contains "linkedin": ${html.toLowerCase().includes('linkedin')}`);
    console.log(`HTML contains "microsoft": ${html.toLowerCase().includes('microsoft')}\n`);

    return true;

  } catch (error) {
    console.error('❌ Exception:', error.message);
    return false;
  }
}

async function testInternalAPI() {
  console.log('2️⃣ Testing Internal /api/leads/brightdata-scraper...\n');

  try {
    const response = await fetch('https://app.meet-sam.com/api/leads/brightdata-scraper', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'enrich_linkedin_profiles',
        linkedin_urls: [TEST_URL],
        include_contact_info: true,
        include_company_info: true
      })
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.success && data.enriched_profiles?.[0]) {
      console.log('\n✅ Enrichment Successful!');
      console.log('Company:', data.enriched_profiles[0].company_name);
      console.log('Title:', data.enriched_profiles[0].job_title);
      console.log('Location:', data.enriched_profiles[0].location);
      return true;
    } else {
      console.error('\n❌ Enrichment Failed');
      console.error('Error:', data.error);
      return false;
    }

  } catch (error) {
    console.error('❌ Exception:', error.message);
    return false;
  }
}

async function runDiagnostics() {
  console.log('=' + '='.repeat(70));
  console.log('🚀 ENRICHMENT DIAGNOSTICS');
  console.log('=' + '='.repeat(70) + '\n');

  const test1 = await testDirectBrightData();
  console.log('\n' + '-'.repeat(70) + '\n');

  const test2 = await testInternalAPI();
  console.log('\n' + '='.repeat(70));

  console.log('\n📊 RESULTS:');
  console.log(`Direct BrightData API: ${test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Internal Scraper API: ${test2 ? '✅ PASS' : '❌ FAIL'}`);

  if (!test1) {
    console.log('\n🔴 ISSUE: BrightData API is failing');
    console.log('Check:');
    console.log('  1. API token is valid');
    console.log('  2. Zone "linkedin_enrichment" exists');
    console.log('  3. BrightData account is active');
  } else if (!test2) {
    console.log('\n🔴 ISSUE: Internal API is failing');
    console.log('Check:');
    console.log('  1. Netlify deployment completed');
    console.log('  2. Environment variables set');
    console.log('  3. Function logs for errors');
  } else {
    console.log('\n✅ ✅ ✅ ALL TESTS PASSED!');
    console.log('Enrichment should be working now.');
  }

  console.log('\n💡 Next Steps:');
  console.log('1. Share this output with the team');
  console.log('2. Check Netlify function logs');
  console.log('3. Verify prospect ID and workspace ID are correct');
}

runDiagnostics().catch(console.error);
