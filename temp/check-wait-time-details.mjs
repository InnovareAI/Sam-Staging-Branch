#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

console.log('🕐 Checking Wait Times\n');

// Get recent waiting executions
const response = await fetch(`${N8N_API_URL}/executions?workflowId=aVG6LC4ZFRMN7Bw6&limit=10`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const result = await response.json();
const executions = result.data || result;

const waiting = executions.filter(e => e.status === 'waiting' || e.waitTill);

console.log(`Executions with wait times: ${waiting.length}\n`);

const now = new Date();
console.log(`Current time: ${now.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET\n`);

waiting.forEach((exec, i) => {
  const waitTill = new Date(exec.waitTill);
  const hoursUntil = (waitTill - now) / (1000 * 60 * 60);
  
  console.log(`${i + 1}. Execution ${exec.id}`);
  console.log(`   Started: ${new Date(exec.startedAt).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);
  console.log(`   Wait until: ${waitTill.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);
  console.log(`   Hours from now: ${hoursUntil.toFixed(1)} hours`);
  console.log('');
});

if (waiting.length > 0 && waiting[0].waitTill) {
  const waitTill = new Date(waiting[0].waitTill);
  const hoursUntil = (waitTill - now) / (1000 * 60 * 60);
  
  if (hoursUntil > 1) {
    console.log('⚠️  Wait time is MUCH longer than expected!');
    console.log(`   Expected: Minutes (anti-bot delay)`);
    console.log(`   Actual: ${hoursUntil.toFixed(1)} hours\n`);
    console.log('This suggests the "Wait for Cadence Delay" node is getting');
    console.log('a much larger send_delay_minutes value than intended.\n');
  }
}
