#!/usr/bin/env node
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const CAMPAIGN_ID = 'ade10177-afe6-4770-a64d-b4ac0928b66a';

async function executeNow() {
  console.log('🚀 Executing campaign directly...\n');

  const response = await fetch('http://localhost:3000/api/campaigns/linkedin/execute-live', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-trigger': 'manual-test'
    },
    body: JSON.stringify({
      campaignId: CAMPAIGN_ID,
      maxProspects: 3,
      dryRun: false
    })
  });

  console.log('Status:', response.status);
  console.log('Content-Type:', response.headers.get('content-type'));
  
  const text = await response.text();
  console.log('\nResponse:');
  console.log(text.substring(0, 500));
}

executeNow().catch(console.error);
