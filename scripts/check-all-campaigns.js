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

async function checkAllCampaigns() {
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n📋 Recent Campaigns:\n');
  campaigns?.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name || 'Unnamed'}`);
    console.log(`   ID: ${c.id}`);
    console.log(`   Status: ${c.status}`);
    console.log(`   Type: ${c.campaign_type || c.type}`);
    console.log(`   Created: ${new Date(c.created_at).toLocaleString()}`);
    console.log(`   Launched: ${c.launched_at ? new Date(c.launched_at).toLocaleString() : 'Not launched'}`);
    console.log('');
  });

  // Check for any N8N executions
  const { data: executions } = await supabase
    .from('n8n_campaign_executions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (executions && executions.length > 0) {
    console.log('\n🚀 Recent N8N Executions:\n');
    executions.forEach((exec, i) => {
      console.log(`${i + 1}. Execution ${exec.id.substring(0, 8)}...`);
      console.log(`   N8N ID: ${exec.n8n_execution_id || 'Pending'}`);
      console.log(`   Status: ${exec.execution_status}`);
      console.log(`   Created: ${new Date(exec.created_at).toLocaleString()}`);
      console.log('');
    });
  } else {
    console.log('\n❌ No N8N executions found\n');
  }
}

checkAllCampaigns();
