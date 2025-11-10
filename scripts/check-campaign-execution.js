#!/usr/bin/env node

/**
 * Check if campaign has been executed and sent to N8N
 */

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

const CAMPAIGN_ID = '3c984824-5561-4ba5-8b08-f34af2a00e27';
const SESSION_ID = 'c4a1adf4-ffc3-493b-b7d9-f549318236b5';

async function checkCampaignExecution() {
  console.log('\n🔍 Checking campaign execution status...\n');

  // 1. Check campaign details
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', CAMPAIGN_ID)
    .single();

  if (campaignError) {
    console.error('❌ Error fetching campaign:', campaignError.message);
    return;
  }

  console.log('📋 Campaign Details:');
  console.log(`   Name: ${campaign.name}`);
  console.log(`   Status: ${campaign.status}`);
  console.log(`   Type: ${campaign.campaign_type || campaign.type}`);
  console.log(`   Created: ${new Date(campaign.created_at).toLocaleString()}`);
  console.log(`   Launched: ${campaign.launched_at || 'Not launched'}\n`);

  // 2. Check campaign prospects
  const { count: prospectCount } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', CAMPAIGN_ID);

  console.log(`👥 Campaign Prospects: ${prospectCount || 0}\n`);

  // 3. Check N8N campaign executions
  const { data: executions, error: execError } = await supabase
    .from('n8n_campaign_executions')
    .select('*')
    .eq('campaign_approval_session_id', SESSION_ID)
    .order('created_at', { ascending: false });

  if (execError) {
    console.log('⚠️  n8n_campaign_executions table may not exist yet');
    console.log('   This is normal if you haven\'t executed the campaign\n');
  } else if (!executions || executions.length === 0) {
    console.log('❌ No N8N executions found');
    console.log('   Campaign has NOT been executed yet\n');
  } else {
    console.log(`✅ Found ${executions.length} N8N execution(s):\n`);
    executions.forEach((exec, i) => {
      console.log(`   Execution ${i + 1}:`);
      console.log(`   - ID: ${exec.id}`);
      console.log(`   - N8N Execution ID: ${exec.n8n_execution_id || 'Pending'}`);
      console.log(`   - Status: ${exec.execution_status}`);
      console.log(`   - Started: ${exec.n8n_started_at || 'Not started'}`);
      console.log(`   - Created: ${new Date(exec.created_at).toLocaleString()}`);
      console.log('');
    });
  }

  // 4. Check prospect status distribution
  const { data: statusCounts } = await supabase
    .from('campaign_prospects')
    .select('status')
    .eq('campaign_id', CAMPAIGN_ID);

  if (statusCounts) {
    const statusMap = statusCounts.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});

    console.log('📊 Prospect Status Distribution:');
    Object.entries(statusMap).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    console.log('');
  }

  // 5. Recommendations
  console.log('💡 Next Steps:');
  if (!executions || executions.length === 0) {
    console.log('   1. The campaign exists but has NOT been executed');
    console.log('   2. No data has been sent to N8N yet');
    console.log('   3. To execute the campaign, you need to:');
    console.log('      - Click "Launch Campaign" in the UI, OR');
    console.log('      - Call POST /api/campaign/execute-n8n\n');
  } else {
    const latestExec = executions[0];
    if (latestExec.execution_status === 'started' || latestExec.execution_status === 'running') {
      console.log('   ✅ Campaign is executing in N8N');
      console.log('   - Check N8N workflow logs for progress');
      console.log('   - Monitor prospect status updates\n');
    } else if (latestExec.execution_status === 'error') {
      console.log('   ❌ Campaign execution failed');
      console.log(`   - Error: ${latestExec.error_message || 'Unknown'}`);
      console.log('   - Check N8N logs and retry\n');
    }
  }
}

checkCampaignExecution();
