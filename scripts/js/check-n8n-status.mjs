#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get campaign ID
const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, name')
  .eq('name', '20251028-IAI-test 11')
  .single();

console.log('Campaign:', campaign?.name);

// Check prospect statuses
const { data: statuses } = await supabase
  .from('campaign_prospects')
  .select('status')
  .eq('campaign_id', campaign?.id);

const grouped = statuses?.reduce((acc, p) => {
  acc[p.status] = (acc[p.status] || 0) + 1;
  return acc;
}, {});

console.log('Prospect statuses:', grouped);

// Check N8N API for recent executions
const n8nUrl = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const workflowId = 'aVG6LC4ZFRMN7Bw6';

try {
  const res = await fetch(`${n8nUrl}/executions?workflowId=${workflowId}&limit=5`, {
    headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY }
  });
  const execs = await res.json();
  console.log('\nN8N Executions (last 5):', execs.data?.length || 0);
  if (execs.data?.length > 0) {
    execs.data.forEach(e => console.log(`  - ${e.id}: ${e.status} (${e.startedAt})`));
  } else {
    console.log('  No executions found');
  }
} catch (err) {
  console.log('N8N check failed:', err.message);
}
