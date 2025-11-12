#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

console.log('🔍 Checking Active N8N Activity\n');

const WORKSPACE_ID = '04666209-fce8-4d71-8eaf-01278edfc73b'; // IA2/Michelle

// Check prospect statuses
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('status, campaign_id, campaigns(name)')
  .eq('campaigns.workspace_id', WORKSPACE_ID);

const statusCounts = {};
prospects.forEach(p => {
  statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
});

console.log('Prospect Status Summary:');
Object.entries(statusCounts).forEach(([status, count]) => {
  console.log(`  ${status}: ${count}`);
});
console.log('');

// Check for queued prospects
const queued = prospects.filter(p => p.status === 'queued_in_n8n' || p.status === 'connection_requested');
console.log(`Prospects in N8N pipeline: ${queued.length}\n`);

if (queued.length > 0) {
  console.log('⚠️  N8N may still be processing these prospects!');
  console.log('   Wait nodes could still be active.\n');
}

// Check N8N executions
const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

const execResponse = await fetch(`${N8N_API_URL}/executions?workflowId=aVG6LC4ZFRMN7Bw6&status=running&limit=10`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const execResult = await execResponse.json();
const running = execResult.data || execResult;

console.log(`Active N8N Executions: ${running.length}\n`);

if (running.length > 0) {
  console.log('⚠️  WARNING: N8N executions are still running!');
  running.forEach((exec, i) => {
    console.log(`  ${i + 1}. Execution ID: ${exec.id}`);
    console.log(`     Started: ${exec.startedAt}`);
    console.log(`     Status: ${exec.status}`);
    console.log(`     Wait Till: ${exec.waitTill || 'N/A'}`);
  });
} else {
  console.log('✅ No active N8N executions');
}
