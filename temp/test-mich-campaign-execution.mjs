#!/usr/bin/env node

/**
 * Test Mich's campaign execution to see why messages aren't sending
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const CAMPAIGN_ID = '4cd9275f-b82d-47d6-a1d4-7207b992c4b7';
const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // IA2

async function testExecution() {
  console.log('🚀 Testing Mich\'s Campaign Execution\n');
  console.log('Campaign ID:', CAMPAIGN_ID);
  console.log('Workspace ID:', WORKSPACE_ID);
  console.log('Dry Run: true (test only)\n');

  const API_URL = 'http://localhost:3000/api/campaigns/linkedin/execute-live';

  try {
    console.log('Making API call...\n');

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-trigger': 'n8n-scheduler', // Bypass auth for testing
      },
      body: JSON.stringify({
        campaignId: CAMPAIGN_ID,
        maxProspects: 1, // Test with just 1 prospect
        dryRun: true, // Don't actually send
      }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();

    console.log('\n📦 Response Data:');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ Campaign execution succeeded!');
      if (data.messages_sent > 0) {
        console.log(`   Messages sent: ${data.messages_sent}`);
      }
      if (data.errors && data.errors.length > 0) {
        console.log('\n⚠️  Errors encountered:');
        data.errors.forEach(err => console.log(`   - ${err}`));
      }
    } else {
      console.log('\n❌ Campaign execution FAILED!');
      console.log('Error:', data.error || 'Unknown error');
      if (data.details) {
        console.log('Details:', data.details);
      }
    }

  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    if (error.cause) console.error('Cause:', error.cause);
  }
}

// Check if dev server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000/api/health', {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Main
(async () => {
  const serverRunning = await checkServer();

  if (!serverRunning) {
    console.error('❌ Dev server not running!');
    console.error('\nPlease start the dev server first:');
    console.error('   npm run dev\n');
    process.exit(1);
  }

  await testExecution();
})();
