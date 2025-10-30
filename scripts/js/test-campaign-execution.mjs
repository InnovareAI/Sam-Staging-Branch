#!/usr/bin/env node
/**
 * Test Campaign Execution - DRY RUN
 * Tests LinkedIn messaging without actually sending
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env.local') });

const CAMPAIGN_ID = '73bedc34-3b24-4315-8cf1-043e454019af'; // test 9 campaign
const API_URL = 'http://localhost:3000/api/campaigns/linkedin/execute-live';

async function testCampaign() {
  console.log('🧪 Testing Campaign Execution (DRY RUN)\n');
  console.log(`Campaign ID: ${CAMPAIGN_ID}`);
  console.log(`API URL: ${API_URL}\n`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-trigger': 'cron-pending-prospects' // Bypass auth for testing
      },
      body: JSON.stringify({
        campaignId: CAMPAIGN_ID,
        maxProspects: 1,
        dryRun: true
      })
    });

    const data = await response.json();

    console.log('📊 Response:');
    console.log(`Status: ${response.status}`);
    console.log(`Success: ${data.success ? '✅' : '❌'}`);
    console.log();

    if (data.success) {
      console.log('✅ Campaign execution successful!');
      console.log();
      console.log('Results:');
      console.log(`  - Messages sent: ${data.results?.sent || 0}`);
      console.log(`  - Failed: ${data.results?.failed || 0}`);
      console.log(`  - Dry run: ${data.dryRun ? 'Yes' : 'No'}`);

      if (data.results?.details) {
        console.log('\nDetails:');
        data.results.details.forEach((detail, i) => {
          console.log(`  ${i + 1}. ${detail.prospect || 'Unknown'}`);
          console.log(`     Status: ${detail.status}`);
          if (detail.error) {
            console.log(`     Error: ${detail.error}`);
          }
        });
      }

      if (data.dryRun) {
        console.log('\n💡 To execute for real, set dryRun: false');
      }
    } else {
      console.log('❌ Campaign execution failed');
      console.log(`Error: ${data.error || 'Unknown error'}`);
      if (data.details) {
        console.log(`Details: ${data.details}`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   1. Dev server is running (npm run dev)');
    console.error('   2. Database is accessible');
    console.error('   3. Environment variables are set');
  }
}

testCampaign();
