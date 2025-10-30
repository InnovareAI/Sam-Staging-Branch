#!/usr/bin/env node
/**
 * Deploy N8N Reply Agent HITL Sender Workflow
 * Polls message_outbox every 10 seconds and sends HITL-approved replies
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.error('❌ N8N_API_KEY environment variable is required');
  process.exit(1);
}

async function makeN8NRequest(endpoint, method = 'GET', body = null) {
  const response = await fetch(`${N8N_API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`N8N API error ${response.status}: ${text}`);
  }

  return await response.json();
}

console.log('🚀 Deploying Reply Agent HITL Sender Workflow...\n');

// Read the workflow JSON
const workflowPath = join(__dirname, '../../n8n-workflows/reply-agent-hitl-sender.json');
const workflowData = JSON.parse(readFileSync(workflowPath, 'utf-8'));

console.log('📋 Workflow details:');
console.log(`   Name: ${workflowData.name}`);
console.log(`   Type: Schedule Trigger (polls every 10 seconds)`);
console.log(`   Nodes: ${workflowData.nodes.length}`);
console.log(`   Channels: Email (Unipile) + LinkedIn (Unipile)`);
console.log('');

try {
  // Check if workflow with this name already exists
  console.log('🔍 Checking for existing workflow...');
  const workflows = await makeN8NRequest('/workflows');
  const existingWorkflow = workflows.data?.find(w => w.name === workflowData.name);

  let workflowId;

  // Remove read-only fields that N8N API doesn't expect
  // Filter settings to only include accepted properties
  const acceptedSettings = {};
  if (workflowData.settings) {
    const allowedSettingsKeys = ['executionOrder', 'saveManualExecutions', 'saveDataErrorExecution', 'saveDataSuccessExecution', 'saveExecutionProgress'];
    for (const key of allowedSettingsKeys) {
      if (workflowData.settings[key] !== undefined) {
        acceptedSettings[key] = workflowData.settings[key];
      }
    }
  }

  const payload = {
    name: workflowData.name,
    nodes: workflowData.nodes,
    connections: workflowData.connections,
    settings: acceptedSettings,
    staticData: workflowData.staticData || null
  };

  if (existingWorkflow) {
    console.log(`✅ Found existing workflow: ${existingWorkflow.id}`);
    console.log('📝 Updating existing workflow...\n');

    await makeN8NRequest(`/workflows/${existingWorkflow.id}`, 'PUT', payload);
    workflowId = existingWorkflow.id;

    console.log('✅ Workflow updated!');
  } else {
    console.log('📝 Creating new workflow...\n');

    // Create new workflow
    const result = await makeN8NRequest('/workflows', 'POST', payload);
    workflowId = result.id;

    console.log('✅ Workflow created!');
    console.log(`   ID: ${workflowId}`);
  }

  console.log('');
  console.log('🔧 Workflow architecture:');
  console.log('   1. Poll Every 10 Seconds → Schedule trigger');
  console.log('   2. Fetch Queued Messages → Query message_outbox');
  console.log('   3. Has Messages? → Check if any queued');
  console.log('   4. Update Status to Sending → Mark as sending');
  console.log('   5. Route by Channel → Email or LinkedIn');
  console.log('   6. Get Account → Fetch workspace Unipile account');
  console.log('   7. Send via Unipile → Send message');
  console.log('   8. Update Success → Mark as sent');
  console.log('   9. Update Failure → Mark as failed (on error)');
  console.log('   10. Retry Failed → Re-queue failed messages (max 3 attempts)');
  console.log('');

  console.log('📊 Database tables used:');
  console.log('   • message_outbox → Stores queued reply messages');
  console.log('   • campaign_replies → Stores prospect replies and metadata');
  console.log('   • workspaces → Workspace information');
  console.log('   • workspace_accounts → Unipile account credentials');
  console.log('');

  console.log('⚠️  IMPORTANT: Workflow is NOT activated yet');
  console.log('');
  console.log('📋 Next steps to complete deployment:');
  console.log('');
  console.log('1. Configure Supabase Database Credentials in N8N:');
  console.log('   • Go to: https://workflows.innovareai.com');
  console.log(`   • Open workflow: "${workflowData.name}"`);
  console.log('   • Click on any Postgres node');
  console.log('   • Create credential: "Supabase PostgreSQL"');
  console.log('   • Enter connection details:');
  console.log('     - Host: latxadqrvrrrcvkktrog.supabase.co');
  console.log('     - Database: postgres');
  console.log('     - User: postgres');
  console.log('     - Password: [your Supabase password]');
  console.log('     - Port: 5432');
  console.log('     - SSL: Enabled');
  console.log('');
  console.log('2. Configure Environment Variables in N8N:');
  console.log('   • Settings → Variables');
  console.log('   • Add these variables:');
  console.log('     - UNIPILE_DSN: [your Unipile DSN]');
  console.log('     - UNIPILE_API_KEY: [your Unipile API key]');
  console.log('');
  console.log('3. Test the Workflow:');
  console.log('   • Click "Test workflow" in N8N UI');
  console.log('   • Insert test message:');
  console.log('');
  console.log('     INSERT INTO message_outbox (');
  console.log('       id, workspace_id, campaign_id, prospect_id, reply_id,');
  console.log('       channel, message_content, subject, status,');
  console.log('       scheduled_send_time, metadata');
  console.log('     ) VALUES (');
  console.log('       gen_random_uuid(),');
  console.log('       \'[your-workspace-id]\',');
  console.log('       \'[your-campaign-id]\',');
  console.log('       \'[your-prospect-id]\',');
  console.log('       \'[your-reply-id]\',');
  console.log('       \'email\',');
  console.log('       \'This is a test reply message from SAM AI.\',');
  console.log('       \'Re: Your inquiry\',');
  console.log('       \'queued\',');
  console.log('       NOW(),');
  console.log('       jsonb_build_object(');
  console.log('         \'prospect_email\', \'test@example.com\',');
  console.log('         \'test\', true');
  console.log('       )');
  console.log('     );');
  console.log('');
  console.log('   • Wait 10 seconds for workflow to pick it up');
  console.log('   • Check N8N execution log for success');
  console.log('');
  console.log('4. Activate the Workflow:');
  console.log('   • Toggle "Active" switch in N8N UI');
  console.log('   • Workflow will poll every 10 seconds automatically');
  console.log('');
  console.log('5. Verify Deployment:');
  console.log('   • Monitor N8N executions for 1-2 minutes');
  console.log('   • Check message_outbox table for status updates');
  console.log('   • Verify messages being sent via Unipile');
  console.log('');
  console.log('🎯 Benefits of this workflow:');
  console.log('   ✅ Automatic sending of HITL-approved replies');
  console.log('   ✅ <15 minute SLA from prospect reply to response');
  console.log('   ✅ Handles both email and LinkedIn channels');
  console.log('   ✅ Automatic retry for failed messages (max 3 attempts)');
  console.log('   ✅ Full audit trail in database');
  console.log('   ✅ No manual intervention required');
  console.log('');
  console.log('📈 Expected performance:');
  console.log('   • Processing: Up to 10 messages per 10-second cycle');
  console.log('   • Throughput: ~3,600 messages per hour (max)');
  console.log('   • Latency: 10 seconds average (worst case)');
  console.log('   • Error handling: Automatic retry with exponential backoff');
  console.log('');
  console.log(`🔗 Workflow URL: ${N8N_API_URL.replace('/api/v1', '')}/workflow/${workflowId}`);
  console.log('');

} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  console.error('\nTroubleshooting:');
  console.error('   1. Verify N8N_API_KEY is set correctly in .env');
  console.error('   2. Check N8N instance is accessible');
  console.error('   3. Verify workflow JSON file exists at:');
  console.error('      n8n-workflows/reply-agent-hitl-sender.json');
  process.exit(1);
}
