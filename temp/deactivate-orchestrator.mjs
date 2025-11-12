#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

console.log('🔧 Deactivating SAM Master Campaign Orchestrator\n');

// Deactivate the broken orchestrator
const response = await fetch(`${N8N_API_URL}/workflows/aVG6LC4ZFRMN7Bw6/deactivate`, {
  method: 'POST',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY
  }
});

if (response.ok) {
  console.log('✅ Orchestrator deactivated');
} else {
  console.log('❌ Failed:', await response.text());
}

// Verify
const checkResponse = await fetch(`${N8N_API_URL}/workflows/aVG6LC4ZFRMN7Bw6`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const workflow = await checkResponse.json();
console.log(`\nWorkflow: ${workflow.name}`);
console.log(`Active: ${workflow.active ? 'YES' : 'NO'}`);
console.log('');
