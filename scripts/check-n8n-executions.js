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

async function checkN8nExecutions() {
  // Get all n8n_campaign_executions ordered by created_at
  const { data: executions } = await supabase
    .from('n8n_campaign_executions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n📊 Recent N8N Executions:\n');
  if (!executions || executions.length === 0) {
    console.log('❌ No N8N executions found in database');
    return;
  }

  executions.forEach((exec, i) => {
    console.log(`${i + 1}. Execution ID: ${exec.id}`);
    console.log(`   Campaign ID: ${exec.campaign_id || 'NULL'}`);
    console.log(`   Status: ${exec.execution_status || exec.status}`);
    console.log(`   Created: ${new Date(exec.created_at).toLocaleString()}`);
    console.log(`   N8N Execution ID: ${exec.n8n_execution_id || 'NULL'}`);
    console.log(`   Workflow ID: ${exec.n8n_workflow_id || 'NULL'}`);
    if (exec.error_message) {
      console.log(`   ❌ Error: ${exec.error_message}`);
    }
    console.log('');
  });
}

checkN8nExecutions();
