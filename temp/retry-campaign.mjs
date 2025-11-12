#!/usr/bin/env node

/**
 * Retry Campaign Execution After N8N Fix
 *
 * This script:
 * 1. Resets failed/queued prospects to pending
 * 2. Re-executes the campaign
 * 3. Monitors the results
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CAMPAIGN_ID = '4cd9275f-b82d-47d6-a1d4-7207b992c4b7';
const N8N_WEBHOOK_URL = process.env.N8N_CAMPAIGN_WEBHOOK_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

console.log('🔄 Retrying Campaign After N8N Fix\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// Step 1: Check current state
console.log('📊 Current Campaign State:\n');

const { data: currentProspects } = await supabase
  .from('campaign_prospects')
  .select('status')
  .eq('campaign_id', CAMPAIGN_ID);

const statusCounts = currentProspects.reduce((acc, p) => {
  acc[p.status] = (acc[p.status] || 0) + 1;
  return acc;
}, {});

console.log('Status breakdown:');
Object.entries(statusCounts).forEach(([status, count]) => {
  console.log(`  ${status}: ${count}`);
});
console.log('');

// Step 2: Reset failed/queued prospects
console.log('🔧 Resetting failed and queued prospects...\n');

const { data: resetProspects, error: resetError } = await supabase
  .from('campaign_prospects')
  .update({
    status: 'pending',
    contacted_at: null
  })
  .eq('campaign_id', CAMPAIGN_ID)
  .in('status', ['failed', 'queued_in_n8n'])
  .select();

if (resetError) {
  console.error('❌ Error resetting prospects:', resetError);
  process.exit(1);
}

console.log(`✅ Reset ${resetProspects.length} prospects to pending\n`);

// Step 3: Get campaign details
const { data: campaign } = await supabase
  .from('campaigns')
  .select('*, workspace_accounts(*)')
  .eq('id', CAMPAIGN_ID)
  .single();

console.log('📋 Campaign Details:');
console.log(`   Name: ${campaign.name}`);
console.log(`   Type: ${campaign.campaign_type}`);
console.log(`   Status: ${campaign.status}`);
console.log('');

// Step 4: Get prospects to send
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', CAMPAIGN_ID)
  .eq('status', 'pending')
  .limit(5);

console.log(`📤 Ready to send to ${prospects.length} prospects:\n`);
prospects.forEach(p => {
  console.log(`   • ${p.first_name} ${p.last_name} - ${p.linkedin_url}`);
});
console.log('');

// Step 5: Prepare N8N payload
const unipileAccountId = campaign.workspace_accounts?.[0]?.unipile_account_id;
if (!unipileAccountId) {
  console.error('❌ No Unipile account found for campaign');
  process.exit(1);
}

const messageTemplate = campaign.message_templates?.connection_request || campaign.connection_message;
if (!messageTemplate) {
  console.error('❌ No message template found for campaign');
  process.exit(1);
}

console.log('📝 Message Template:');
console.log(`   "${messageTemplate.substring(0, 100)}..."\n`);

// Step 6: Send to N8N
console.log('🚀 Triggering N8N Workflow...\n');

const n8nPayload = {
  campaign_id: CAMPAIGN_ID,
  workspace_id: campaign.workspace_id,
  unipile_account_id: unipileAccountId,
  campaign_type: campaign.campaign_type,
  message_template: messageTemplate,
  prospects: prospects.map(p => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    company_name: p.company_name,
    linkedin_url: p.linkedin_url,
    email: p.email
  })),
  supabase_url: SUPABASE_URL,
  supabase_key: SUPABASE_SERVICE_KEY
};

try {
  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${N8N_API_KEY}`
    },
    body: JSON.stringify(n8nPayload)
  });

  console.log(`N8N Response: ${response.status} ${response.statusText}`);

  if (response.ok) {
    const result = await response.json();
    console.log('✅ N8N webhook accepted:', result);

    // Update prospects to queued_in_n8n
    await supabase
      .from('campaign_prospects')
      .update({ status: 'queued_in_n8n' })
      .in('id', prospects.map(p => p.id));

    console.log('\n✅ Prospects queued in N8N');
  } else {
    const errorText = await response.text();
    console.error('❌ N8N webhook failed:', errorText);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error calling N8N:', error.message);
  process.exit(1);
}

// Step 7: Monitor for status updates
console.log('\n⏳ Monitoring for status updates (60 seconds)...\n');

let lastStatus = {};
const startTime = Date.now();

const monitorInterval = setInterval(async () => {
  const { data: updatedProspects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, contacted_at')
    .eq('campaign_id', CAMPAIGN_ID)
    .in('id', prospects.map(p => p.id));

  updatedProspects.forEach(p => {
    if (p.status !== lastStatus[p.id]) {
      const statusEmoji = {
        'pending': '⏸️',
        'queued_in_n8n': '⏳',
        'connection_requested': '✅',
        'failed': '❌'
      }[p.status] || '❓';

      console.log(`${statusEmoji} ${p.first_name} ${p.last_name}: ${lastStatus[p.id] || 'unknown'} → ${p.status}`);

      if (p.contacted_at) {
        console.log(`   Contacted at: ${new Date(p.contacted_at).toLocaleString()}`);
      }

      lastStatus[p.id] = p.status;
    }
  });

  // Check if we should stop monitoring
  const allComplete = updatedProspects.every(p =>
    ['connection_requested', 'failed'].includes(p.status)
  );

  if (allComplete || Date.now() - startTime > 60000) {
    clearInterval(monitorInterval);

    console.log('\n' + '─'.repeat(60));
    console.log('📊 Final Status:\n');

    const finalCounts = updatedProspects.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});

    Object.entries(finalCounts).forEach(([status, count]) => {
      const emoji = {
        'connection_requested': '✅',
        'failed': '❌',
        'queued_in_n8n': '⏳',
        'pending': '⏸️'
      }[status] || '❓';
      console.log(`${emoji} ${status}: ${count}`);
    });

    console.log('\n💡 Next Steps:');
    if (finalCounts.connection_requested > 0) {
      console.log('   ✅ Verify connection requests on LinkedIn:');
      console.log('      https://www.linkedin.com/mynetwork/invitation-manager/sent/');
    }
    if (finalCounts.failed > 0) {
      console.log('   ⚠️  Check N8N execution logs for failed prospects:');
      console.log('      https://workflows.innovareai.com/executions');
    }
    if (finalCounts.queued_in_n8n > 0) {
      console.log('   ⏳ Some prospects still processing, check again in a few minutes');
    }

    console.log('');
    process.exit(0);
  }
}, 5000); // Check every 5 seconds
