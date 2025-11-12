#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6'; // SAM Master Campaign Orchestrator

console.log('🔍 SAM MASTER CAMPAIGN ORCHESTRATOR - ERROR ANALYSIS\n');

// Get latest execution
const execResponse = await fetch(`${N8N_API_URL}/executions?workflowId=${WORKFLOW_ID}&limit=1`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const execResult = await execResponse.json();
const exec = (execResult.data || execResult)[0];

console.log(`Latest Execution: ${exec.id}`);
console.log(`Status: ${exec.status}`);
console.log(`Time: ${new Date(exec.startedAt).toLocaleString()}\n`);

// Get execution details
const detailResponse = await fetch(`${N8N_API_URL}/executions/${exec.id}`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const detail = await detailResponse.json();

console.log('━'.repeat(60));
console.log('ERROR DETAILS:');
console.log('━'.repeat(60));
console.log('');

// Overall error
if (detail.data?.resultData?.error) {
  console.log('❌ WORKFLOW ERROR:');
  console.log(`   ${detail.data.resultData.error.message}`);
  if (detail.data.resultData.error.description) {
    console.log(`   ${detail.data.resultData.error.description}`);
  }
  console.log('');
}

// Node errors
const runData = detail.data?.resultData?.runData || {};
for (const [nodeName, runs] of Object.entries(runData)) {
  const lastRun = runs[runs.length - 1];
  if (lastRun?.error) {
    console.log(`❌ NODE: "${nodeName}"`);
    console.log(`   Error: ${lastRun.error.message}`);
    if (lastRun.error.description) {
      console.log(`   Description: ${lastRun.error.description}`);
    }
    if (lastRun.error.httpCode) {
      console.log(`   HTTP Code: ${lastRun.error.httpCode}`);
    }
    console.log('');
  }
}

console.log('━'.repeat(60));
console.log('');
