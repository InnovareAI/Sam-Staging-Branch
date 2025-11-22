#!/usr/bin/env node

/**
 * Cron-Job.org Setup Script
 *
 * Creates the "Process Send Queue" cron job via API
 *
 * Usage:
 *   node scripts/js/setup-cron-job-org.mjs <API_KEY> <CRON_SECRET>
 *
 * Example:
 *   node scripts/js/setup-cron-job-org.mjs "XuT71S7zg+G4E7eSb0kjvrrB7AwRw9vSZB9hzOBXTgw=" "your-cron-secret"
 */

const API_KEY = process.argv[2];
const CRON_SECRET = process.argv[3];

if (!API_KEY || !CRON_SECRET) {
  console.error('❌ Usage: node setup-cron-job-org.mjs <API_KEY> <CRON_SECRET>');
  console.error('');
  console.error('Example:');
  console.error('  node setup-cron-job-org.mjs "XuT71S7zg+G4E7eSb0kjvrrB7AwRw9vSZB9hzOBXTgw=" "abc123xyz789"');
  process.exit(1);
}

const cronJobConfig = {
  title: 'SAM - Process Send Queue',
  url: 'https://app.meet-sam.com/api/cron/process-send-queue',
  expression: '* * * * *', // Every minute
  timezone: 'UTC',
  auth: null, // No basic auth needed
  headers: {
    'x-cron-secret': CRON_SECRET,
    'Content-Type': 'application/json'
  },
  body: '', // POST but no body
  method: 'POST', // HTTP method
  failStatus: '400-599', // Fail on 4xx-5xx
  saveResponses: true, // Keep execution logs
  notifications: {
    onFailure: null, // No email notifications for now
    onSuccess: null
  }
};

async function setupCronJob() {
  try {
    console.log('🚀 Setting up Cron-Job.org job...');
    console.log('');
    console.log('📋 Job Configuration:');
    console.log(`  Title: ${cronJobConfig.title}`);
    console.log(`  URL: ${cronJobConfig.url}`);
    console.log(`  Schedule: ${cronJobConfig.expression} (every minute)`);
    console.log(`  Timezone: ${cronJobConfig.timezone}`);
    console.log(`  Method: ${cronJobConfig.method}`);
    console.log(`  Auth Header: x-cron-secret (provided)`);
    console.log('');

    // Step 1: Create the cron job
    console.log('📤 Creating cron job...');
    const createResponse = await fetch('https://cron-job.org/api/v2/cronjob', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cronJobConfig)
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error('❌ Failed to create cron job:');
      console.error(`   Status: ${createResponse.status}`);
      console.error(`   Response: ${error}`);
      process.exit(1);
    }

    const jobData = await createResponse.json();
    const jobId = jobData.cronjob?.id;

    if (!jobId) {
      console.error('❌ No job ID in response:');
      console.error(JSON.stringify(jobData, null, 2));
      process.exit(1);
    }

    console.log(`✅ Cron job created!`);
    console.log(`   Job ID: ${jobId}`);
    console.log('');

    // Step 2: Enable the job
    console.log('🔄 Enabling job...');
    const enableResponse = await fetch(`https://cron-job.org/api/v2/cronjob/${jobId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        enabled: true
      })
    });

    if (!enableResponse.ok) {
      const error = await enableResponse.text();
      console.error('❌ Failed to enable job:');
      console.error(`   Status: ${enableResponse.status}`);
      console.error(`   Response: ${error}`);
      process.exit(1);
    }

    console.log('✅ Job enabled!');
    console.log('');

    // Step 3: Get job details
    console.log('📊 Verifying job...');
    const getResponse = await fetch(`https://cron-job.org/api/v2/cronjob/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!getResponse.ok) {
      const error = await getResponse.text();
      console.error('❌ Failed to fetch job:');
      console.error(`   Status: ${getResponse.status}`);
      console.error(`   Response: ${error}`);
      process.exit(1);
    }

    const verifyData = await getResponse.json();
    const job = verifyData.cronjob;

    console.log('✅ Job verified!');
    console.log('');
    console.log('📋 Final Configuration:');
    console.log(`  Job ID: ${job.id}`);
    console.log(`  Title: ${job.title}`);
    console.log(`  URL: ${job.url}`);
    console.log(`  Schedule: ${job.expression}`);
    console.log(`  Status: ${job.enabled ? '🟢 ENABLED' : '🔴 DISABLED'}`);
    console.log(`  Timezone: ${job.timezone}`);
    console.log(`  Created: ${new Date(job.createdAt).toISOString()}`);
    console.log('');

    console.log('🎉 SUCCESS! Cron job is ready!');
    console.log('');
    console.log('📈 Next Steps:');
    console.log(`  1. Visit: https://cron-job.org/en/members/`);
    console.log(`  2. Find: "${job.title}" (Job ID: ${job.id})`);
    console.log(`  3. Check: Execution log should show successful runs`);
    console.log(`  4. Monitor: netlify logs --function process-send-queue --tail`);
    console.log('');

    console.log('✅ Everything is set up and running!');
    console.log('');
    console.log('To test:');
    console.log('  1. Create a campaign with 5-10 prospects');
    console.log('  2. Queue the campaign via:');
    console.log('     curl -X POST https://app.meet-sam.com/api/campaigns/direct/send-connection-requests-queued \\');
    console.log('       -H "Content-Type: application/json" \\');
    console.log('       -d \'{"campaignId": "YOUR_CAMPAIGN_ID"}\'');
    console.log('  3. Monitor send_queue table for progress');
    console.log('  4. Check LinkedIn for connection requests');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setupCronJob();
