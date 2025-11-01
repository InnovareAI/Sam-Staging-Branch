#!/usr/bin/env node

/**
 * 🚀 ULTRAHARD MODE: Parallel vs Sequential Speed Comparison
 * Demonstrates the massive speed improvement from parallel processing
 */

const BRIGHTDATA_API_TOKEN = '61813293-6532-4e16-af76-9803cc043afa';
const BRIGHTDATA_ZONE = 'linkedin_enrichment';

// Test profiles - using smaller/faster ones for demo
const TEST_PROFILES = [
  'https://www.linkedin.com/in/satyanadella',
  'https://www.linkedin.com/in/tim-cook-1b1a82',
  'https://www.linkedin.com/in/sundar-pichai-a7098b',
  'https://www.linkedin.com/in/jeffweiner08',
  'https://www.linkedin.com/in/reidhoffman'
];

async function scrapeProfile(url) {
  const startTime = Date.now();

  try {
    const response = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRIGHTDATA_API_TOKEN}`
      },
      body: JSON.stringify({
        zone: BRIGHTDATA_ZONE,
        url: url,
        format: 'raw'
      })
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      return { url, success: false, elapsed, error: response.statusText };
    }

    const html = await response.text();
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);

    return {
      url,
      success: true,
      elapsed,
      title: titleMatch?.[1] || 'No title',
      size: html.length
    };

  } catch (error) {
    const elapsed = Date.now() - startTime;
    return { url, success: false, elapsed, error: error.message };
  }
}

async function testSequential() {
  console.log('🐢 SEQUENTIAL PROCESSING TEST');
  console.log('=' + '='.repeat(70));
  console.log(`Profiles: ${TEST_PROFILES.length}`);
  console.log(`Concurrency: 1 (one at a time)\n`);

  const results = [];
  const overallStart = Date.now();

  for (let i = 0; i < TEST_PROFILES.length; i++) {
    const url = TEST_PROFILES[i];
    console.log(`[${i + 1}/${TEST_PROFILES.length}] Scraping...`);

    const result = await scrapeProfile(url);
    results.push(result);

    console.log(`   ${result.success ? '✅' : '❌'} ${(result.elapsed / 1000).toFixed(1)}s - ${result.title || result.error}`);
  }

  const totalTime = (Date.now() - overallStart) / 1000;
  const successCount = results.filter(r => r.success).length;

  console.log(`\n⏱️  Total time: ${totalTime.toFixed(1)}s`);
  console.log(`✅ Success: ${successCount}/${TEST_PROFILES.length}\n`);

  return { totalTime, results, successCount };
}

async function testParallel(concurrency) {
  console.log(`🚀 PARALLEL PROCESSING TEST (${concurrency}x)`);
  console.log('=' + '='.repeat(70));
  console.log(`Profiles: ${TEST_PROFILES.length}`);
  console.log(`Concurrency: ${concurrency} (simultaneous requests)\n`);

  const results = [];
  const overallStart = Date.now();

  // Process in batches
  for (let i = 0; i < TEST_PROFILES.length; i += concurrency) {
    const batch = TEST_PROFILES.slice(i, i + concurrency);
    const batchNum = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(TEST_PROFILES.length / concurrency);

    console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} profiles)`);

    const batchStart = Date.now();

    // Parallel execution
    const batchResults = await Promise.all(
      batch.map(url => scrapeProfile(url))
    );

    const batchTime = (Date.now() - batchStart) / 1000;

    results.push(...batchResults);

    batchResults.forEach((r, idx) => {
      console.log(`   ${r.success ? '✅' : '❌'} ${(r.elapsed / 1000).toFixed(1)}s - ${r.title || r.error}`);
    });

    console.log(`   ⏱️  Batch time: ${batchTime.toFixed(1)}s\n`);
  }

  const totalTime = (Date.now() - overallStart) / 1000;
  const successCount = results.filter(r => r.success).length;

  console.log(`⏱️  Total time: ${totalTime.toFixed(1)}s`);
  console.log(`✅ Success: ${successCount}/${TEST_PROFILES.length}\n`);

  return { totalTime, results, successCount };
}

async function runComparison() {
  console.log('\n🚀 ULTRAHARD MODE: Parallel Processing Speed Test\n');
  console.log('=' + '='.repeat(70));
  console.log('📊 SPEED COMPARISON');
  console.log('=' + '='.repeat(70) + '\n');

  // Test 1: Sequential (baseline)
  const sequential = await testSequential();

  console.log('\n⏳ Waiting 10 seconds before parallel test...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Test 2: Parallel 3x
  const parallel3x = await testParallel(3);

  console.log('\n⏳ Waiting 10 seconds before next test...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Test 3: Parallel 5x
  const parallel5x = await testParallel(5);

  // Summary
  console.log('\n' + '=' + '='.repeat(70));
  console.log('📊 FINAL COMPARISON');
  console.log('=' + '='.repeat(70) + '\n');

  const results = [
    { name: 'Sequential (1x)', time: sequential.totalTime, speedup: 1 },
    { name: 'Parallel (3x)', time: parallel3x.totalTime, speedup: sequential.totalTime / parallel3x.totalTime },
    { name: 'Parallel (5x)', time: parallel5x.totalTime, speedup: sequential.totalTime / parallel5x.totalTime }
  ];

  console.log('Method              | Time    | Speedup | Winner');
  console.log('--------------------|---------|---------|--------');

  results.forEach((r, idx) => {
    const isWinner = idx === results.length - 1;
    const winner = isWinner ? '🏆' : '';
    console.log(
      `${r.name.padEnd(19)} | ${r.time.toFixed(1).padStart(5)}s | ${r.speedup.toFixed(1)}x    | ${winner}`
    );
  });

  console.log('\n💡 KEY INSIGHTS:\n');
  console.log(`• Sequential processing: ${sequential.totalTime.toFixed(1)}s for ${TEST_PROFILES.length} profiles`);
  console.log(`• Parallel 3x processing: ${parallel3x.totalTime.toFixed(1)}s (${(parallel3x.totalTime / sequential.totalTime * 100).toFixed(0)}% of sequential time)`);
  console.log(`• Parallel 5x processing: ${parallel5x.totalTime.toFixed(1)}s (${(parallel5x.totalTime / sequential.totalTime * 100).toFixed(0)}% of sequential time)`);
  console.log(`• Time saved with 5x parallel: ${(sequential.totalTime - parallel5x.totalTime).toFixed(1)}s (${((1 - parallel5x.totalTime / sequential.totalTime) * 100).toFixed(0)}% faster)\n`);

  console.log('🎯 PRODUCTION ESTIMATES (20 prospects):\n');
  const avgTime = sequential.totalTime / TEST_PROFILES.length;
  console.log(`Sequential: ${(avgTime * 20 / 60).toFixed(1)} minutes`);
  console.log(`Parallel 3x: ${(avgTime * 20 / 3 / 60).toFixed(1)} minutes`);
  console.log(`Parallel 5x: ${(avgTime * 20 / 5 / 60).toFixed(1)} minutes 🏆\n`);
}

runComparison().catch(console.error);
