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

async function verify() {
  const { data } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, status, personalization_data')
    .eq('campaign_id', '73bedc34-3b24-4315-8cf1-043e454019af')
    .eq('first_name', 'Ignacio')
    .single();

  console.log('✅ Prospect status after N8N trigger:\n');
  console.log(`   Name: ${data.first_name} ${data.last_name}`);
  console.log(`   Status: ${data.status}`);
  console.log(`   N8N Execution ID: ${data.personalization_data?.n8n_execution_id || 'N/A'}`);
  console.log(`   Queued at: ${data.personalization_data?.queued_at || 'N/A'}`);
}

verify();
