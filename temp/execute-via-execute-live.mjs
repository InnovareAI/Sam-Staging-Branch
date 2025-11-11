#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const CAMPAIGN_ID = '4cd9275f-b82d-47d6-a1d4-7207b992c4b7';

async function executeViaLive() {
  console.log('🚀 Executing via execute-live endpoint\n');

  const API_URL = 'https://app.meet-sam.com/api/campaigns/linkedin/execute-live';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-trigger': 'cron-pending-prospects', // Bypass auth
      },
      body: JSON.stringify({
        campaignId: CAMPAIGN_ID,
        maxProspects: 3,
        dryRun: false, // ACTUALLY SEND
      }),
    });

    console.log('Status:', response.status);

    const data = await response.json();
    console.log('\nResponse:');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ CAMPAIGN EXECUTED!');
      console.log(`Messages sent: ${data.messages_sent || 0}`);
      console.log(`Errors: ${data.errors?.length || 0}`);
    } else {
      console.log('\n❌ FAILED:', data.error);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

executeViaLive();
