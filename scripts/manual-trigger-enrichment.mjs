#!/usr/bin/env node

/**
 * Manually Trigger N8N Enrichment Workflow
 *
 * Triggers the N8N webhook directly for the stuck job
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const brightdataToken = process.env.BRIGHTDATA_API_TOKEN || 'hl_8aca120e:vokteG-4zibcy-juwrux';
const brightdataZone = process.env.BRIGHTDATA_ZONE || 'residential';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔄 Manual N8N Webhook Trigger');
console.log('==============================\n');

async function triggerWebhook() {
  // Get the latest pending job
  const { data: job, error } = await supabase
    .from('enrichment_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !job) {
    console.log('❌ No pending jobs found');
    return;
  }

  console.log('📋 Found pending job:');
  console.log('   ID:', job.id);
  console.log('   Prospects:', job.prospect_ids.length);
  console.log('   Created:', new Date(job.created_at).toLocaleString());

  const webhookUrl = 'https://workflows.innovareai.com/webhook/prospect-enrichment';

  console.log('\n📞 Calling N8N webhook:', webhookUrl);

  const payload = {
    job_id: job.id,
    workspace_id: job.workspace_id,
    prospect_ids: job.prospect_ids,
    supabase_url: supabaseUrl,
    supabase_service_key: supabaseKey,
    brightdata_api_token: brightdataToken,
    brightdata_zone: brightdataZone
  };

  console.log('\n📦 Payload:');
  console.log(JSON.stringify({
    ...payload,
    supabase_service_key: '[REDACTED]',
    brightdata_api_token: '[REDACTED]'
  }, null, 2));

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('\n📡 Response:');
    console.log('   Status:', response.status, response.statusText);
    console.log('   Headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const result = await response.json();
      console.log('\n✅ Success!');
      console.log(JSON.stringify(result, null, 2));
    } else {
      const errorText = await response.text();
      console.log('\n❌ Failed:');
      console.log(errorText);
    }

    // Check N8N executions
    console.log('\n🔍 Check execution at:');
    console.log('   https://workflows.innovareai.com/executions');

  } catch (error) {
    console.error('\n❌ Webhook call failed:', error.message);
  }
}

triggerWebhook().catch(console.error);
