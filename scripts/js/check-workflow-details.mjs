#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWorkflow() {
  // Check if N8N workflows are configured in the database
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, n8n_workflow_id')
    .not('n8n_workflow_id', 'is', null)
    .limit(5);

  console.log('Campaigns with N8N workflows:');
  campaigns?.forEach(c => {
    console.log(`  ${c.name}: ${c.n8n_workflow_id || 'None'}`);
  });

  console.log('\n');
  console.log('Expected workflow for campaign execution:');
  console.log('  URL: https://workflows.innovareai.com/workflow/FNwzHH1WTHGMtdEe');
  console.log('  This should be the main LinkedIn campaign execution workflow');
}

checkWorkflow();
