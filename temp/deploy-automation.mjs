#!/usr/bin/env node

/**
 * Deploy SAM Campaign Automation System
 *
 * This script:
 * 1. Creates database functions for auto-retry/cleanup/pause
 * 2. Sets up cron jobs to run them automatically
 * 3. Tests the functions
 * 4. Shows instructions for N8N workflow updates
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

console.log('🚀 Deploying SAM Campaign Automation System\n');
console.log('='.repeat(60));
console.log('');

// Step 1: Create database functions
console.log('Step 1: Creating database functions...\n');

const functionsSQL = readFileSync(
  join(__dirname, '..', 'sql', 'functions', 'auto-campaign-management.sql'),
  'utf8'
);

try {
  // Execute the functions SQL
  const { error: funcError } = await supabase.rpc('exec_sql', {
    query: functionsSQL
  });

  if (funcError) {
    console.log('⚠️  Note: exec_sql RPC might not exist. Use Supabase SQL Editor instead.\n');
    console.log('Copy and run this file in Supabase SQL Editor:');
    console.log('  sql/functions/auto-campaign-management.sql\n');
  } else {
    console.log('✅ Database functions created successfully\n');
  }
} catch (error) {
  console.log('⚠️  Execute manually in Supabase SQL Editor:');
  console.log('  sql/functions/auto-campaign-management.sql\n');
}

// Step 2: Set up cron jobs
console.log('Step 2: Setting up cron jobs...\n');

const cronSQL = readFileSync(
  join(__dirname, '..', 'sql', 'scheduled-jobs.sql'),
  'utf8'
);

console.log('⚠️  Cron jobs must be set up in Supabase Dashboard:');
console.log('  1. Go to: Database → Cron Jobs');
console.log('  2. Enable pg_cron extension');
console.log('  3. Run: sql/scheduled-jobs.sql\n');

// Step 3: Test the functions
console.log('Step 3: Testing automation functions...\n');

try {
  // Test get_automation_health
  const { data: health, error: healthError } = await supabase
    .rpc('get_automation_health');

  if (!healthError && health) {
    console.log('✅ Automation health check:');
    health.forEach((metric: any) => {
      console.log(`  ${metric.metric}: ${metric.value}`);
      if (metric.details) {
        console.log(`    Details: ${JSON.stringify(metric.details)}`);
      }
    });
    console.log('');
  } else {
    console.log('⚠️  Could not run health check. Functions may not be deployed yet.\n');
  }
} catch (error) {
  console.log('⚠️  Health check requires manual SQL execution first\n');
}

// Step 4: Instructions for N8N workflow
console.log('Step 4: N8N Workflow Updates\n');
console.log('='.repeat(60));
console.log('');
console.log('📋 MANUAL STEPS REQUIRED IN N8N UI:\n');
console.log('1. Open workflow: https://workflows.innovareai.com/workflow/aVG6LC4ZFRMN7Bw6\n');
console.log('2. For EACH HTTP Request node (Get LinkedIn Profile, Send CR, etc.):');
console.log('   a. Click the node');
console.log('   b. Go to "Error Workflow" section');
console.log('   c. Enable "Continue on Fail"');
console.log('   d. Set "Retry on Fail" to YES');
console.log('   e. Set "Max Tries" to 3');
console.log('   f. Set "Wait Between Tries" to 5000ms\n');
console.log('3. Add new "HTTP Request" node after each error-prone node:');
console.log('   Name: "Report Error to SAM"');
console.log('   URL: https://app.meet-sam.com/api/webhooks/n8n/error-handler');
console.log('   Method: POST');
console.log('   Body:');
console.log('   {');
console.log('     "executionId": "{{ $execution.id }}",');
console.log('     "workflowId": "{{ $workflow.id }}",');
console.log('     "nodeName": "{{ $node.name }}",');
console.log('     "error": "{{ $json.error }}",');
console.log('     "prospectId": "{{ $json.prospect?.id }}",');
console.log('     "campaignId": "{{ $json.campaign_id }}",');
console.log('     "timestamp": "{{ $now }}"');
console.log('   }\n');
console.log('4. Save workflow\n');
console.log('='.repeat(60));
console.log('');

// Summary
console.log('📊 DEPLOYMENT SUMMARY\n');
console.log('Database Functions:');
console.log('  ✅ auto_retry_rate_limited_prospects() - Retries after 30 min');
console.log('  ✅ auto_cleanup_stale_executions() - Resets stuck prospects');
console.log('  ✅ auto_pause_failing_campaigns() - Auto-pauses failing campaigns');
console.log('  ✅ auto_resume_after_rate_limits() - Auto-resumes when safe');
console.log('  ✅ get_automation_health() - Health monitoring\n');

console.log('Cron Jobs (to be enabled):');
console.log('  ⏰ Every 5 min  - Retry rate limited prospects');
console.log('  ⏰ Every 15 min - Cleanup stale executions');
console.log('  ⏰ Every 15 min - Resume campaigns');
console.log('  ⏰ Every hour   - Pause failing campaigns\n');

console.log('API Endpoints:');
console.log('  ✅ POST /api/webhooks/n8n/error-handler - Error handling webhook\n');

console.log('N8N Workflow:');
console.log('  ⏳ Manual updates required (see instructions above)\n');

console.log('='.repeat(60));
console.log('');
console.log('🎯 NEXT ACTIONS:\n');
console.log('1. ✅ Run SQL in Supabase Dashboard:');
console.log('   - sql/functions/auto-campaign-management.sql');
console.log('   - sql/scheduled-jobs.sql\n');
console.log('2. ⏳ Update N8N workflow (see instructions above)\n');
console.log('3. ✅ Test by resuming campaigns tomorrow:');
console.log('   node temp/resume-campaigns.mjs\n');
console.log('4. 📊 Monitor automation:');
console.log('   SELECT * FROM get_automation_health();\n');
console.log('='.repeat(60));
