#!/usr/bin/env node

/**
 * 🚀 ULTRAHARD MODE: Direct BrightData API Test
 * Tests BrightData Web Unlocker API with real LinkedIn profile
 */

const BRIGHTDATA_API_TOKEN = '61813293-6532-4e16-af76-9803cc043afa';
const BRIGHTDATA_ZONE = 'linkedin_enrichment'; // ✅ CONFIRMED WORKING
const TEST_LINKEDIN_URL = 'https://www.linkedin.com/in/satyanadella';

async function testBrightDataAPI() {
  console.log('🚀 ULTRAHARD MODE: Testing LinkedIn Enrichment...\n');
  console.log(`🎯 Zone: ${BRIGHTDATA_ZONE}`);
  console.log(`👤 Profile: ${TEST_LINKEDIN_URL}\n`);

  try {
    const startTime = Date.now();

    const response = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRIGHTDATA_API_TOKEN}`
      },
      body: JSON.stringify({
        zone: BRIGHTDATA_ZONE,
        url: TEST_LINKEDIN_URL,
        format: 'raw'
      })
    });

    const elapsed = Date.now() - startTime;
    console.log(`⏱️  Response time: ${elapsed}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error:\n${errorText}`);
      process.exit(1);
    }

    const html = await response.text();
    console.log(`📄 HTML received: ${html.length.toLocaleString()} bytes`);

    // Check for LinkedIn content markers
    const hasLinkedIn = html.toLowerCase().includes('linkedin');
    const hasProfile = html.includes('profile') || html.includes('experience');
    const hasMeta = html.includes('og:title') || html.includes('og:description');

    console.log(`✅ Contains "linkedin": ${hasLinkedIn}`);
    console.log(`✅ Contains profile data: ${hasProfile}`);
    console.log(`✅ Has OpenGraph meta: ${hasMeta}\n`);

    // Extract title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      console.log(`📌 Page title: ${titleMatch[1]}\n`);
    }

    // Extract OpenGraph data
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);

    if (ogTitle) console.log(`👤 OG Title: ${ogTitle[1]}`);
    if (ogDesc) console.log(`💼 OG Description: ${ogDesc[1]}\n`);

    // Show first 1000 chars
    console.log(`📝 HTML Preview (first 1000 chars):`);
    console.log(html.substring(0, 1000));
    console.log('\n...\n');

    if (hasLinkedIn && html.length > 5000) {
      console.log('✅ ✅ ✅ LINKEDIN ENRICHMENT IS WORKING! ✅ ✅ ✅\n');
      console.log('🚀 Next: Update production code with zone "linkedin_enrichment"');
    } else {
      console.log('⚠️  Warning: Response may be incomplete or blocked');
    }

  } catch (error) {
    console.error('❌ Fatal Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testBrightDataAPI();
