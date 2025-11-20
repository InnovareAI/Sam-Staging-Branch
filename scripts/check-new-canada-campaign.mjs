import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaign() {
  console.log('🔍 Checking New Campaign-Canada for Charissa...\n');

  // Find the campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .ilike('name', '%New Campaign-Canada%')
    .single();

  if (campaignError) {
    console.error('Error finding campaign:', campaignError);
    return;
  }

  console.log('📋 Campaign Details:');
  console.log('  Name:', campaign.name);
  console.log('  ID:', campaign.id);
  console.log('  Status:', campaign.status);
  console.log('  Type:', campaign.campaign_type);
  console.log('  Created:', new Date(campaign.created_at).toLocaleString());
  console.log('  N8N Execution ID:', campaign.n8n_execution_id || 'NONE');
  console.log('  N8N Workflow ID:', campaign.n8n_workflow_id || 'NONE');
  console.log('  N8N Webhook URL:', campaign.n8n_webhook_url || 'NONE');
  console.log('  Auto Execute:', campaign.auto_execute);
  console.log('  Next Execution Time:', campaign.next_execution_time);
  console.log('');

  // Check message templates
  console.log('💬 Message Templates:');
  if (campaign.message_templates) {
    console.log('  Connection Request:', campaign.message_templates.connection_request ? 'YES' : 'NO');
    console.log('  Follow-up 1:', campaign.message_templates.follow_up_1 ? 'YES' : 'NO');
    console.log('  Follow-up 2:', campaign.message_templates.follow_up_2 ? 'YES' : 'NO');
  } else {
    console.log('  NO MESSAGE TEMPLATES FOUND ⚠️');
  }
  console.log('');

  // Get prospects
  const { data: prospects, error: prospectsError } = await supabase
    .from('campaign_prospects')
    .select('id, status, contacted_at, created_at')
    .eq('campaign_id', campaign.id)
    .order('created_at', { ascending: false });

  if (prospectsError) {
    console.error('Error fetching prospects:', prospectsError);
    return;
  }

  console.log(`👥 Prospects (${prospects.length} total):`);
  const statusCounts = prospects.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  console.log('');

  // Show sample prospects
  console.log('Sample Prospects (first 5):');
  prospects.slice(0, 5).forEach((p, i) => {
    console.log(`  ${i + 1}. Status: ${p.status}`);
    console.log(`     Created: ${new Date(p.created_at).toLocaleString()}`);
    console.log(`     Contacted: ${p.contacted_at || 'NEVER'}`);
    if (p.error_message) {
      console.log(`     Error: ${p.error_message}`);
    }
    console.log('');
  });

  // Check workspace account
  const { data: account } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', campaign.workspace_id)
    .single();

  if (account) {
    console.log('🔗 LinkedIn Account:');
    console.log('  Name:', account.account_name);
    console.log('  Unipile ID:', account.unipile_account_id);
    console.log('  Connection Status:', account.connection_status);
    console.log('  Active:', account.is_active);
    console.log('');
  }
}

checkCampaign().catch(console.error);
