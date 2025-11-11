#!/usr/bin/env node

/**
 * Manually execute Mich's campaign
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const CAMPAIGN_ID = '4cd9275f-b82d-47d6-a1d4-7207b992c4b7';
const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function executeNow() {
  console.log('🚀 EXECUTING MICH\'S CAMPAIGN NOW\n');

  const API_URL = 'https://app.meet-sam.com/api/campaigns/linkedin/execute-via-n8n';

  console.log('Target: Production (app.meet-sam.com)');
  console.log('Campaign:', CAMPAIGN_ID);
  console.log('Workspace:', WORKSPACE_ID);
  console.log('Batch size: 5 prospects\n');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Use internal trigger to bypass auth
        'x-internal-trigger': 'manual-execution',
      },
      body: JSON.stringify({
        campaignId: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID,
        maxProspects: 5, // Send to 5 prospects
      }),
    });

    console.log('Response Status:', response.status, response.statusText);

    const data = await response.json();

    console.log('\n📦 Response:');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ SUCCESS! Campaign is executing!');
      console.log('\n🎯 Next Steps:');
      console.log('1. Check N8N workflow at: https://workflows.innovareai.com');
      console.log('2. Monitor prospect status in database');
      console.log('3. Check LinkedIn for sent connection requests\n');
    } else {
      console.log('\n❌ EXECUTION FAILED');
      console.log('Error:', data.error);
      console.log('Details:', data.details || 'No details provided');
    }

  } catch (error) {
    console.error('\n❌ REQUEST FAILED:', error.message);
  }
}

executeNow();
