#!/usr/bin/env node

/**
 * 🚀 ULTRAHARD MODE: Direct ICP Speed Test (No Auth)
 * Tests BrightData scraping speed directly
 */

const BRIGHTDATA_API_TOKEN = '61813293-6532-4e16-af76-9803cc043afa';
const BRIGHTDATA_ZONE = 'linkedin_enrichment';

const TEST_PROFILES = [
  {
    name: 'Satya Nadella',
    url: 'https://www.linkedin.com/in/satyanadella',
    company: 'Microsoft'
  },
  {
    name: 'Tim Cook',
    url: 'https://www.linkedin.com/in/tim-cook-1b1a82',
    company: 'Apple'
  },
  {
    name: 'Sundar Pichai',
    url: 'https://www.linkedin.com/in/sundar-pichai-a7098b',
    company: 'Google'
  }
];

async function scrapeLinkedInProfile(profileUrl, profileName) {
  const startTime = Date.now();

  try {
    console.log(`🔍 Scraping: ${profileName}`);
    console.log(`📍 URL: ${profileUrl}`);

    const response = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRIGHTDATA_API_TOKEN}`
      },
      body: JSON.stringify({
        zone: BRIGHTDATA_ZONE,
        url: profileUrl,
        format: 'raw'
      })
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ FAILED (${(elapsed / 1000).toFixed(2)}s): ${errorText.substring(0, 100)}\n`);
      return { success: false, elapsed, error: errorText };
    }

    const html = await response.text();

    // Extract key data
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);

    console.log(`✅ SUCCESS (${(elapsed / 1000).toFixed(2)}s)`);
    console.log(`📄 HTML Size: ${(html.length / 1024).toFixed(1)}KB`);
    if (titleMatch) console.log(`📌 Title: ${titleMatch[1]}`);
    if (ogTitle) console.log(`👤 OG Title: ${ogTitle[1]}`);
    if (ogDesc) console.log(`💼 Description: ${ogDesc[1].substring(0, 100)}...`);
    console.log('');

    return {
      success: true,
      elapsed,
      htmlSize: html.length,
      title: titleMatch?.[1],
      ogTitle: ogTitle?.[1],
      ogDesc: ogDesc?.[1]
    };

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`❌ ERROR (${(elapsed / 1000).toFixed(2)}s): ${error.message}\n`);
    return { success: false, elapsed, error: error.message };
  }
}

async function testICPSpeed() {
  console.log('🚀 ULTRAHARD MODE: ICP Enrichment Speed Test\n');
  console.log('=' + '='.repeat(70));
  console.log('🎯 TESTING BRIGHTDATA LINKEDIN SCRAPING SPEED');
  console.log('=' + '='.repeat(70));
  console.log(`Zone: ${BRIGHTDATA_ZONE}`);
  console.log(`Profiles: ${TEST_PROFILES.length}\n`);

  const results = [];

  for (let i = 0; i < TEST_PROFILES.length; i++) {
    const profile = TEST_PROFILES[i];

    console.log(`\n[${ i + 1}/${TEST_PROFILES.length}] Testing: ${profile.name} (${profile.company})`);
    console.log('-'.repeat(70));

    const result = await scrapeLinkedInProfile(profile.url, profile.name);
    results.push({ profile, result });

    // Rate limiting - wait 5s between requests
    if (i < TEST_PROFILES.length - 1) {
      console.log('⏳ Waiting 5 seconds before next request...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Summary
  console.log('\n' + '=' + '='.repeat(70));
  console.log('📊 SPEED TEST RESULTS');
  console.log('=' + '='.repeat(70) + '\n');

  const successful = results.filter(r => r.result.success);
  const failed = results.filter(r => !r.result.success);

  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}\n`);

  if (successful.length > 0) {
    const times = successful.map(r => r.result.elapsed / 1000);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    console.log('⏱️  Scraping Times:');
    console.log(`   Average: ${avgTime.toFixed(2)}s`);
    console.log(`   Min: ${minTime.toFixed(2)}s`);
    console.log(`   Max: ${maxTime.toFixed(2)}s\n`);

    const sizes = successful.map(r => r.result.htmlSize / 1024);
    const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;

    console.log('📄 HTML Sizes:');
    console.log(`   Average: ${avgSize.toFixed(1)}KB`);
    console.log(`   Min: ${Math.min(...sizes).toFixed(1)}KB`);
    console.log(`   Max: ${Math.max(...sizes).toFixed(1)}KB\n`);
  }

  console.log('🎯 FULL ICP ENRICHMENT ESTIMATE:');
  console.log('=' + '='.repeat(70));

  if (successful.length > 0) {
    const avgScrapeTime = successful.reduce((sum, r) => sum + r.result.elapsed, 0) / successful.length / 1000;

    console.log(`\nPer Prospect (Sequential):`);
    console.log(`  • LinkedIn Scrape: ${avgScrapeTime.toFixed(1)}s`);
    console.log(`  • Website Analysis: ~10s (estimated)`);
    console.log(`  • AI ICP Scoring: ~3s (estimated)`);
    console.log(`  • Total: ~${(avgScrapeTime + 13).toFixed(1)}s\n`);

    console.log(`Batch Processing (${TEST_PROFILES.length} prospects):`);
    console.log(`  • Sequential: ~${((avgScrapeTime + 13) * TEST_PROFILES.length / 60).toFixed(1)} minutes`);
    console.log(`  • Parallel (3 concurrent): ~${((avgScrapeTime + 13) * TEST_PROFILES.length / 3 / 60).toFixed(1)} minutes\n`);
  }

  console.log('🚀 Performance Insights:');
  console.log(`  • BrightData is the bottleneck (${successful.length > 0 ? (successful.reduce((sum, r) => sum + r.result.elapsed, 0) / successful.length / 1000).toFixed(1) : 'N/A'}s per profile)`);
  console.log(`  • Consider parallel processing for batches`);
  console.log(`  • Cache profiles to avoid re-scraping`);
  console.log(`  • Use incremental enrichment (basic first, then deep)\n`);
}

testICPSpeed().catch(console.error);
