#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function searchCampaigns() {
  // Search for "V1" or "Orchestration" in campaign names
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .or('name.ilike.%v1%,name.ilike.%orchestration%')
    .order('created_at', { ascending: false });

  console.log('\n🔍 Searching for V1/Orchestration campaigns:\n');

  if (!campaigns || campaigns.length === 0) {
    console.log('❌ No campaigns found with "V1" or "Orchestration" in name\n');
  } else {
    campaigns.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name}`);
      console.log(`   ID: ${c.id}`);
      console.log(`   Status: ${c.status}`);
      console.log(`   Launched: ${c.launched_at || 'Not launched'}`);
      console.log('');
    });
  }

  // Check for ANY recent N8N executions (not session-specific)
  const { data: executions } = await supabase
    .from('n8n_campaign_executions')
    .select('*, campaigns(name)')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n🚀 ALL Recent N8N Executions (last 10):\n');

  if (!executions || executions.length === 0) {
    console.log('❌ No N8N executions found at all\n');
  } else {
    executions.forEach((exec, i) => {
      console.log(`${i + 1}. Campaign: ${exec.campaigns?.name || 'Unknown'}`);
      console.log(`   Execution ID: ${exec.id.substring(0, 8)}...`);
      console.log(`   N8N ID: ${exec.n8n_execution_id || 'Pending'}`);
      console.log(`   Status: ${exec.execution_status}`);
      console.log(`   Created: ${new Date(exec.created_at).toLocaleString()}`);
      console.log('');
    });
  }
}

searchCampaigns();
