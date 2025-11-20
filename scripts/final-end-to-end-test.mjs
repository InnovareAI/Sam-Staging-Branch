#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Previously tested names to avoid
const testedNames = [
  'Martin Redmond', 'David Pisarek', 'John P. Perkins', 'Vinci Ravindran',
  'Simon Sokol', 'Paul Landry', 'Reid Hoffman', 'John P. Perkins, P.E.',
  'Sean Meister', 'Mark Poppen', 'Erik McBain', 'Erik McBain, CFA',
  'ZAKAR HOSSAIN', 'Maca Atencio', 'Russ Jarman Price', 'Emmett Cooper',
  'Zachary Schmidt', 'Zachary J. Schmidt'
];

console.log('\n🔍 Finding untouched prospect with CR message...\n');

// Find campaigns with CR messages and pending prospects
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, campaign_name, workspace_id, message_templates')
  .not('message_templates', 'is', null)
  .limit(20);

let selectedProspect = null;
let selectedCampaign = null;

for (const campaign of campaigns) {
  if (!campaign.message_templates?.connection_request) continue;

  // Get untouched prospects from this campaign
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending')
    .is('contacted_at', null)
    .limit(50);

  if (!prospects || prospects.length === 0) continue;

  // Find first prospect not in tested list
  const untouched = prospects.find(p => {
    const fullName = `${p.first_name} ${p.last_name}`;
    return !testedNames.includes(fullName) &&
           !testedNames.includes(p.first_name) &&
           !testedNames.includes(`${p.first_name} ${p.last_name}`);
  });

  if (untouched) {
    selectedProspect = untouched;
    selectedCampaign = campaign;
    break;
  }
}

if (!selectedProspect || !selectedCampaign) {
  console.log('❌ No untouched prospects found with CR messages\n');
  process.exit(1);
}

console.log(`✅ Selected Prospect: ${selectedProspect.first_name} ${selectedProspect.last_name}`);
console.log(`   Campaign: ${selectedCampaign.campaign_name || 'Unnamed'}`);
console.log(`   Company: ${selectedProspect.company_name}`);
console.log(`   LinkedIn: ${selectedProspect.linkedin_url}`);

console.log('\n📝 CR Message Template:');
console.log(selectedCampaign.message_templates.connection_request);

// Personalize the message
const crMessage = selectedCampaign.message_templates.connection_request
  .replace(/{first_name}/g, selectedProspect.first_name)
  .replace(/{last_name}/g, selectedProspect.last_name)
  .replace(/{company_name}/g, selectedProspect.company_name || '')
  .replace(/{title}/g, selectedProspect.title || '');

console.log('\n📝 Personalized Message:');
console.log(crMessage);

// Get workspace account
const { data: account } = await supabase
  .from('workspace_accounts')
  .select('unipile_account_id, account_name')
  .eq('workspace_id', selectedCampaign.workspace_id)
  .eq('account_type', 'linkedin')
  .eq('connection_status', 'connected')
  .single();

if (!account) {
  console.log('\n❌ No connected LinkedIn account found for this workspace\n');
  process.exit(1);
}

console.log(`\n📧 Using LinkedIn Account: ${account.account_name}`);
console.log(`   Unipile ID: ${account.unipile_account_id}`);

// Build payload
const payload = {
  workspaceId: selectedCampaign.workspace_id,
  campaignId: selectedCampaign.id,
  channel: 'linkedin',
  campaignType: 'connector',
  unipileAccountId: account.unipile_account_id,
  prospects: [{
    id: selectedProspect.id,
    first_name: selectedProspect.first_name,
    last_name: selectedProspect.last_name,
    linkedin_url: selectedProspect.linkedin_url,
    company_name: selectedProspect.company_name,
    title: selectedProspect.title,
    send_delay_minutes: 0
  }],
  messages: {
    connection_request: selectedCampaign.message_templates.connection_request,
    cr: selectedCampaign.message_templates.connection_request
  },
  supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  unipile_dsn: process.env.UNIPILE_DSN,
  unipile_api_key: process.env.UNIPILE_API_KEY
};

console.log('\n📤 Sending to N8N workflow...');
console.log('   URL: https://workflows.innovareai.com/webhook/connector-campaign');

const response = await fetch('https://workflows.innovareai.com/webhook/connector-campaign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

console.log(`   Response: ${response.status} ${response.statusText}`);

if (!response.ok) {
  const text = await response.text();
  console.log(`   Error: ${text}`);
}

console.log('\n⏳ Waiting 20 seconds for N8N workflow to complete...');
await new Promise(resolve => setTimeout(resolve, 20000));

// Check database
const { data: updated } = await supabase
  .from('campaign_prospects')
  .select('status, contacted_at')
  .eq('id', selectedProspect.id)
  .single();

console.log('\n📊 Database Status Check:');
console.log(`   Status: ${updated.status}`);
console.log(`   Contacted At: ${updated.contacted_at || 'null'}`);

if (updated.status === 'connection_requested' && updated.contacted_at) {
  console.log('\n🎉 SUCCESS! End-to-end test passed!');
  console.log('   ✅ CR sent to LinkedIn');
  console.log('   ✅ Database tracking updated');
  console.log('   ✅ Timestamp recorded');
  console.log(`\n   Check ${account.account_name} LinkedIn for connection request to:`);
  console.log(`   ${selectedProspect.first_name} ${selectedProspect.last_name} (${selectedProspect.company_name})`);
  console.log(`   Message should read: "${crMessage.substring(0, 100)}..."\n`);
} else {
  console.log('\n❌ TEST FAILED!');
  console.log('   Database was not updated correctly');
  console.log('   Expected: status=connection_requested with contacted_at timestamp');
  console.log(`   Got: status=${updated.status}, contacted_at=${updated.contacted_at}\n`);
  process.exit(1);
}
