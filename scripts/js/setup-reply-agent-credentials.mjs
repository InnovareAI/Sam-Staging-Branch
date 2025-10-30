#!/usr/bin/env node
/**
 * Reply Agent Workflow - Manual Configuration Guide
 * This script provides step-by-step instructions for completing the N8N setup
 */

import 'dotenv/config';

const WORKFLOW_ID = 'SZttg0FfQC0gZKJG';
const WORKFLOW_URL = `https://workflows.innovareai.com/workflow/${WORKFLOW_ID}`;

console.log('🎯 Reply Agent Workflow Configuration Guide');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('✅ Workflow Successfully Deployed!');
console.log(`   ID: ${WORKFLOW_ID}`);
console.log(`   Name: Reply Agent - HITL Approved Message Sender`);
console.log(`   Nodes: 13`);
console.log(`   Status: Inactive (needs configuration)\n`);

console.log('🔗 Open Workflow in N8N:');
console.log(`   ${WORKFLOW_URL}\n`);

console.log('═══════════════════════════════════════════════════════════════');
console.log('STEP 1: Configure Supabase PostgreSQL Credentials');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('1. Open the workflow in your browser:');
console.log(`   ${WORKFLOW_URL}\n`);

console.log('2. You will see 8 Postgres nodes that need credentials:');
console.log('   • Fetch Queued Messages');
console.log('   • Update Status to Sending');
console.log('   • Get Email Account');
console.log('   • Get LinkedIn Account');
console.log('   • Update Email Success');
console.log('   • Update LinkedIn Success');
console.log('   • Update Failure');
console.log('   • Retry Failed Messages\n');

console.log('3. Click on the first Postgres node (Fetch Queued Messages)\n');

console.log('4. Click "Credential to connect with" dropdown\n');

console.log('5. Select "Create New Credential"\n');

console.log('6. Enter Supabase PostgreSQL connection details:');
console.log('   ┌─────────────────────────────────────────────────────┐');
console.log('   │ Credential Name: Supabase PostgreSQL                │');
console.log('   │ Host: latxadqrvrrrcvkktrog.supabase.co             │');
console.log('   │ Database: postgres                                  │');
console.log('   │ User: postgres                                      │');
console.log('   │ Password: [Get from Supabase dashboard]            │');
console.log('   │ Port: 5432                                          │');
console.log('   │ SSL: ✓ Enabled (REQUIRED)                          │');
console.log('   └─────────────────────────────────────────────────────┘\n');

console.log('7. Click "Save" to create the credential\n');

console.log('8. Apply this credential to ALL other Postgres nodes:');
console.log('   • Click on each remaining Postgres node');
console.log('   • Select the "Supabase PostgreSQL" credential you just created');
console.log('   • Repeat for all 8 Postgres nodes\n');

console.log('💡 Tip: You can get the Supabase password from:');
console.log('   • Supabase Dashboard → Project Settings → Database');
console.log('   • Or from your .env file (SUPABASE_SERVICE_ROLE_KEY)\n');

console.log('═══════════════════════════════════════════════════════════════');
console.log('STEP 2: Configure Environment Variables');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('1. In N8N, go to: Settings → Variables (gear icon → Variables)\n');

console.log('2. Add the following environment variables:\n');

console.log('   Variable 1: UNIPILE_DSN');
console.log(`   Value: ${process.env.UNIPILE_DSN || '[Get from .env file]'}\n`);

console.log('   Variable 2: UNIPILE_API_KEY');
console.log(`   Value: ${process.env.UNIPILE_API_KEY || '[Get from .env file]'}\n`);

console.log('3. Click "Save" for each variable\n');

console.log('💡 These values are available in your .env file:');
console.log('   • UNIPILE_DSN');
console.log('   • UNIPILE_API_KEY\n');

console.log('═══════════════════════════════════════════════════════════════');
console.log('STEP 3: Test the Workflow');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('1. Insert a test message into the database:\n');

console.log('   Run this SQL in Supabase SQL Editor:\n');

console.log('   ```sql');
console.log('   INSERT INTO message_outbox (');
console.log('     id,');
console.log('     workspace_id,');
console.log('     campaign_id,');
console.log('     prospect_id,');
console.log('     reply_id,');
console.log('     channel,');
console.log('     message_content,');
console.log('     subject,');
console.log('     status,');
console.log('     scheduled_send_time,');
console.log('     metadata');
console.log('   ) VALUES (');
console.log('     gen_random_uuid(),');
console.log('     \'[your-workspace-id]\',  -- Get from workspaces table');
console.log('     NULL,  -- campaign_id can be null for tests');
console.log('     NULL,  -- prospect_id can be null for tests');
console.log('     NULL,  -- reply_id can be null for tests');
console.log('     \'email\',');
console.log('     \'This is a test message from SAM AI Reply Agent. If you receive this, the workflow is working!\',');
console.log('     \'Test: Reply Agent Working\',');
console.log('     \'queued\',');
console.log('     NOW(),');
console.log('     jsonb_build_object(');
console.log('       \'prospect_email\', \'[your-email@example.com]\',  -- Use YOUR email');
console.log('       \'test\', true');
console.log('     )');
console.log('   );');
console.log('   ```\n');

console.log('2. In N8N workflow, click "Test workflow" button\n');

console.log('3. Wait 10 seconds for the polling trigger to execute\n');

console.log('4. Check the execution results:');
console.log('   • You should see a successful execution (green checkmark)');
console.log('   • Check each node to see data flow');
console.log('   • Verify the test email was sent\n');

console.log('5. Verify in database:');
console.log('   ```sql');
console.log('   SELECT id, status, sent_at, external_message_id, failure_reason');
console.log('   FROM message_outbox');
console.log('   WHERE metadata->>\'test\' = \'true\'');
console.log('   ORDER BY created_at DESC');
console.log('   LIMIT 1;');
console.log('   ```');
console.log('   Expected: status = \'sent\', sent_at populated\n');

console.log('6. Check your email inbox for the test message\n');

console.log('═══════════════════════════════════════════════════════════════');
console.log('STEP 4: Activate the Workflow');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('Once testing is successful:\n');

console.log('1. In N8N workflow, toggle the "Active" switch (top right)\n');

console.log('2. Workflow will now poll message_outbox every 10 seconds automatically\n');

console.log('3. Monitor the "Executions" tab to verify it\'s running\n');

console.log('═══════════════════════════════════════════════════════════════');
console.log('STEP 5: Verify Production Operation');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('Monitor for the first 5-10 minutes:\n');

console.log('1. Check N8N Executions tab:');
console.log('   • Should see executions every 10 seconds');
console.log('   • All executions should be successful (green)\n');

console.log('2. Monitor database:');
console.log('   ```sql');
console.log('   -- Messages sent in last hour');
console.log('   SELECT status, channel, COUNT(*) as count');
console.log('   FROM message_outbox');
console.log('   WHERE sent_at > NOW() - INTERVAL \'1 hour\'');
console.log('   GROUP BY status, channel;');
console.log('   ```\n');

console.log('3. Check for errors:');
console.log('   ```sql');
console.log('   -- Failed messages');
console.log('   SELECT id, channel, failure_reason, failed_at');
console.log('   FROM message_outbox');
console.log('   WHERE status = \'failed\'');
console.log('   AND failed_at > NOW() - INTERVAL \'24 hours\'');
console.log('   ORDER BY failed_at DESC;');
console.log('   ```\n');

console.log('═══════════════════════════════════════════════════════════════');
console.log('Troubleshooting');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('❌ Issue: "Cannot connect to database"');
console.log('   Solution: Check Supabase credentials, ensure SSL is enabled\n');

console.log('❌ Issue: "UNIPILE_DSN not defined"');
console.log('   Solution: Verify environment variables in N8N Settings → Variables\n');

console.log('❌ Issue: "No active Unipile account"');
console.log('   Solution: Check workspace_accounts table has active Unipile account\n');

console.log('❌ Issue: "Message stuck in \'sending\' status"');
console.log('   Solution: Check N8N execution logs for errors, manually reset to \'queued\'\n');

console.log('═══════════════════════════════════════════════════════════════');
console.log('Quick Links');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`📊 Workflow: ${WORKFLOW_URL}`);
console.log('📈 Executions: https://workflows.innovareai.com/executions');
console.log('⚙️  Settings: https://workflows.innovareai.com/settings/variables');
console.log('📖 Docs: /docs/N8N_REPLY_AGENT_INTEGRATION.md\n');

console.log('═══════════════════════════════════════════════════════════════');
console.log('Summary');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('✅ Workflow deployed successfully');
console.log('⏳ Awaiting manual configuration:');
console.log('   1. Supabase PostgreSQL credentials (8 nodes)');
console.log('   2. Environment variables (UNIPILE_DSN, UNIPILE_API_KEY)');
console.log('   3. Test with sample message');
console.log('   4. Activate workflow');
console.log('   5. Monitor for 5-10 minutes\n');

console.log('🎯 Expected Result:');
console.log('   • Workflow polls every 10 seconds');
console.log('   • HITL-approved replies sent automatically');
console.log('   • <15 minute response time');
console.log('   • Full audit trail in database\n');

console.log('═══════════════════════════════════════════════════════════════\n');
