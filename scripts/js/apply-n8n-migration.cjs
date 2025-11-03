const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

(async () => {
  console.log('🔧 Applying N8N migration: Making workspace_n8n_workflow_id nullable...\n');

  // Check current constraint
  console.log('1. Checking current constraint...');
  const { data: before, error: beforeError } = await supabase
    .from('n8n_campaign_executions')
    .select('id')
    .limit(1);

  if (beforeError) {
    console.log('   Current state check:', beforeError.message);
  } else {
    console.log('   ✅ Table accessible');
  }

  // The Supabase JS client doesn't support ALTER TABLE directly
  // We need to use the REST API or direct PostgreSQL connection

  console.log('\n2. Attempting to apply migration via PostgreSQL...');

  // Try using node-postgres
  const { Client } = require('pg');

  const client = new Client({
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.latxadqrvrrrcvkktrog',
    password: 'QFe75XZ2kqhy2AyH',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('   ✅ Connected to PostgreSQL');

    // Apply migration
    const result = await client.query(`
      ALTER TABLE n8n_campaign_executions
      ALTER COLUMN workspace_n8n_workflow_id DROP NOT NULL;
    `);

    console.log('   ✅ Migration applied successfully!');
    console.log('   Result:', result);

    // Verify
    const verify = await client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'n8n_campaign_executions'
        AND column_name = 'workspace_n8n_workflow_id';
    `);

    console.log('\n3. Verification:');
    console.log('   Column:', verify.rows[0].column_name);
    console.log('   Is Nullable:', verify.rows[0].is_nullable);
    console.log('   Data Type:', verify.rows[0].data_type);

    await client.end();

  } catch (error) {
    console.log('   ❌ PostgreSQL error:', error.message);
    console.log('\n📋 Manual SQL Required:');
    console.log('   Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql');
    console.log('   Run: ALTER TABLE n8n_campaign_executions ALTER COLUMN workspace_n8n_workflow_id DROP NOT NULL;');
  }

  console.log('\n4. Testing API endpoint after fix...');

  const testResponse = await fetch('https://app.meet-sam.com/api/n8n/log-execution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspace_id: 'babdcab8-1a78-4b2f-913e-6e9fd9821009',
      n8n_execution_id: 'test-' + Date.now(),
      n8n_workflow_id: 'aVG6LC4ZFRMN7Bw6',
      campaign_name: 'Test Campaign via Script',
      execution_status: 'running',
      total_prospects: 0,
      current_step: 'initialization',
      progress_percentage: 0
    })
  });

  const testResult = await testResponse.json();

  if (testResponse.ok) {
    console.log('   ✅ API endpoint working!');
    console.log('   Response:', testResult);
    console.log('\n🎉 SUCCESS! N8N execution tracking is now fully operational!');
  } else {
    console.log('   ❌ API still has issues:', testResult);
  }
})();
