#!/usr/bin/env node

/**
 * Test Script: Background LinkedIn Search Jobs
 *
 * Tests the async prospect search system:
 * 1. Setup database tables
 * 2. Create a search job
 * 3. Monitor progress
 * 4. Fetch results
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setupTables() {
  log('\n📊 Step 1: Setting up database tables...', 'cyan');

  try {
    const response = await fetch(`${BASE_URL}/api/admin/setup-search-jobs-tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (data.success) {
      log('✅ Tables created successfully', 'green');
      log(`   - prospect_search_jobs: ${data.tables_verified.prospect_search_jobs ? '✅' : '❌'}`, 'green');
      log(`   - prospect_search_results: ${data.tables_verified.prospect_search_results ? '✅' : '❌'}`, 'green');
      return true;
    } else {
      log(`❌ Table setup failed: ${data.error}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error setting up tables: ${error.message}`, 'red');
    return false;
  }
}

async function createSearchJob() {
  log('\n🚀 Step 2: Creating search job...', 'cyan');

  try {
    // Test search criteria - small search for testing
    const searchCriteria = {
      category: 'people',
      keywords: 'CEO tech startup',
      location: ['103644278'], // United States
      title: 'CEO',
      company_headcount: ['B', 'C'], // 11-50, 51-200 employees
    };

    const response = await fetch(`${BASE_URL}/api/linkedin/search/create-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In real usage, you'd need authentication cookies here
      },
      body: JSON.stringify({
        search_criteria: searchCriteria,
        search_type: 'linkedin',
        target_count: 50 // Small test
      })
    });

    const data = await response.json();

    if (data.success) {
      log(`✅ Job created: ${data.job_id}`, 'green');
      log(`   API: ${data.metadata.api}`, 'blue');
      log(`   Max results: ${data.metadata.max_results}`, 'blue');
      log(`   Est. time: ~${data.metadata.estimated_time_seconds}s`, 'blue');
      return data.job_id;
    } else {
      log(`❌ Job creation failed: ${data.error}`, 'red');
      if (data.action === 'connect_linkedin') {
        log('   💡 You need to connect a LinkedIn account first', 'yellow');
      }
      return null;
    }
  } catch (error) {
    log(`❌ Error creating job: ${error.message}`, 'red');
    return null;
  }
}

async function monitorJob(jobId) {
  log('\n⏳ Step 3: Monitoring job progress...', 'cyan');

  const maxPolls = 60; // 5 minutes max (5s intervals)
  let polls = 0;

  while (polls < maxPolls) {
    try {
      const response = await fetch(`${BASE_URL}/api/linkedin/search/create-job?job_id=${jobId}`, {
        headers: {
          // Note: In real usage, you'd need authentication cookies here
        }
      });

      const data = await response.json();

      if (!data.success) {
        log(`❌ Failed to get job status: ${data.error}`, 'red');
        return null;
      }

      const { job } = data;
      const percentage = job.progress.percentage;
      const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));

      process.stdout.write(`\r   [${progressBar}] ${percentage}% (${job.progress.current}/${job.progress.total}) - ${job.status}     `);

      if (job.status === 'completed') {
        log('\n✅ Job completed successfully', 'green');
        log(`   Total results: ${job.results_count}`, 'green');
        log(`   Duration: ${Math.round((new Date(job.completed_at) - new Date(job.started_at)) / 1000)}s`, 'blue');
        return job;
      }

      if (job.status === 'failed') {
        log(`\n❌ Job failed: ${job.error_message}`, 'red');
        return null;
      }

      await sleep(5000); // Poll every 5 seconds
      polls++;

    } catch (error) {
      log(`\n❌ Error monitoring job: ${error.message}`, 'red');
      return null;
    }
  }

  log('\n⏰ Timeout: Job took longer than expected', 'yellow');
  return null;
}

async function fetchResults(jobId) {
  log('\n📥 Step 4: Fetching results...', 'cyan');

  try {
    const response = await fetch(`${BASE_URL}/api/linkedin/search/results?job_id=${jobId}&page=1&per_page=10`, {
      headers: {
        // Note: In real usage, you'd need authentication cookies here
      }
    });

    const data = await response.json();

    if (data.success) {
      log(`✅ Fetched ${data.prospects.length} prospects`, 'green');
      log(`   Total available: ${data.pagination.total}`, 'blue');
      log(`   Pages: ${data.pagination.total_pages}`, 'blue');

      if (data.prospects.length > 0) {
        log('\n📋 Sample prospects:', 'cyan');
        data.prospects.slice(0, 3).forEach((prospect, idx) => {
          log(`\n   ${idx + 1}. ${prospect.name}`, 'blue');
          log(`      Title: ${prospect.title}`, 'blue');
          log(`      Company: ${prospect.company}`, 'blue');
          log(`      Location: ${prospect.location}`, 'blue');
          log(`      LinkedIn: ${prospect.linkedinUrl}`, 'blue');
        });
      }

      return data;
    } else {
      log(`❌ Failed to fetch results: ${data.error}`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Error fetching results: ${error.message}`, 'red');
    return null;
  }
}

async function main() {
  log('\n🧪 Testing Background LinkedIn Search System', 'cyan');
  log('==========================================\n', 'cyan');

  // Step 1: Setup tables
  const setupSuccess = await setupTables();
  if (!setupSuccess) {
    log('\n❌ Test failed: Could not setup tables', 'red');
    process.exit(1);
  }

  // Step 2: Create job
  const jobId = await createSearchJob();
  if (!jobId) {
    log('\n❌ Test failed: Could not create job', 'red');
    log('\n💡 Note: This test requires:', 'yellow');
    log('   1. A connected LinkedIn account', 'yellow');
    log('   2. Valid authentication session', 'yellow');
    log('   3. Unipile API credentials configured', 'yellow');
    process.exit(1);
  }

  // Step 3: Monitor job
  const job = await monitorJob(jobId);
  if (!job) {
    log('\n❌ Test failed: Job did not complete successfully', 'red');
    process.exit(1);
  }

  // Step 4: Fetch results
  const results = await fetchResults(jobId);
  if (!results) {
    log('\n❌ Test failed: Could not fetch results', 'red');
    process.exit(1);
  }

  log('\n\n🎉 All tests passed!', 'green');
  log('==========================================\n', 'green');
}

// Run tests
main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
