#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

console.log('🧪 Manual Workflow Execution Test\n');

// Create minimal test payload
const testPayload = {
  workspaceId: "test-workspace-123",
  campaignId: "test-campaign-456",
  unipileAccountId: "test-account-789",
  prospects: [{
    id: "test-prospect-1",
    first_name: "John",
    last_name: "Doe",
    linkedin_url: "https://www.linkedin.com/in/johndoe",
    email: "john@example.com"
  }],
  messages: {
    cr: "Hi {first_name}, test message"
  },
  timing: {
    fu1_delay_hours: 6,
    fu2_delay_days: 3,
    fu3_delay_days: 5
  },
  supabase_url: "https://example.supabase.co",
  supabase_service_key: "test-key",
  unipile_dsn: "https://test.unipile.com",
  unipile_api_key: "test-api-key"
};

console.log('Sending test webhook...\n');

const response = await fetch(`${process.env.N8N_CAMPAIGN_WEBHOOK_URL}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(testPayload)
});

console.log(`Status: ${response.status} ${response.statusText}`);

const text = await response.text();
console.log(`Response: ${text}\n`);

// Wait 2 seconds then check execution
await new Promise(resolve => setTimeout(resolve, 2000));

const execResponse = await fetch(`${N8N_API_URL}/executions?workflowId=aVG6LC4ZFRMN7Bw6&limit=1`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const execResult = await execResponse.json();
const exec = (execResult.data || execResult)[0];

console.log(`Latest Execution:`);
console.log(`  ID: ${exec.id}`);
console.log(`  Status: ${exec.status}`);
console.log(`  Finished: ${exec.finished}`);
