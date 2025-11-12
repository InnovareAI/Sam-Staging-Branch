#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

console.log('🔍 Checking Stan\'s Campaign for Rejected Leads\n');

const WORKSPACE_ID = '014509ba-226e-43ee-ba58-ab5f20d2ed08'; // Blue Label Labs

// Search for the campaign
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, created_at')
  .eq('workspace_id', WORKSPACE_ID)
  .ilike('name', '%BLL-Mid-Market CISOs%');

console.log(`Found ${campaigns?.length || 0} matching campaigns:\n`);

campaigns?.forEach((c, i) => {
  console.log(`${i + 1}. ${c.name}`);
  console.log(`   ID: ${c.id}`);
  console.log(`   Status: ${c.status}`);
  console.log(`   Created: ${new Date(c.created_at).toLocaleDateString()}\n`);
});

if (!campaigns || campaigns.length === 0) {
  console.log('❌ Campaign not found. Searching all campaigns...\n');
  
  const { data: allCampaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, created_at')
    .eq('workspace_id', WORKSPACE_ID)
    .order('created_at', { ascending: false });
  
  console.log('All Stan\'s campaigns:\n');
  allCampaigns?.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name}`);
    console.log(`   ID: ${c.id}`);
    console.log(`   Created: ${new Date(c.created_at).toLocaleDateString()}\n`);
  });
  
  process.exit(0);
}

const campaign = campaigns[0];
const campaignId = campaign.id;

console.log(`Analyzing: ${campaign.name}\n`);
console.log('='.repeat(60));
console.log('');

// Get all prospects in the campaign
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, company_name, status, linkedin_url, created_at')
  .eq('campaign_id', campaignId)
  .order('created_at', { ascending: true });

console.log(`Campaign Prospects: ${prospects.length} total\n`);

const statusCounts = {};
prospects.forEach(p => {
  statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
});

console.log('Status breakdown:');
Object.entries(statusCounts).forEach(([status, count]) => {
  console.log(`  ${status}: ${count}`);
});
console.log('');

// Check prospect_approval_data for this campaign
const { data: approvalData } = await supabase
  .from('prospect_approval_data')
  .select('id, approval_status, contact, created_at')
  .eq('workspace_id', WORKSPACE_ID)
  .order('created_at', { ascending: false });

console.log(`Checking prospect_approval_data...\n`);

const approved = approvalData?.filter(p => p.approval_status === 'approved') || [];
const rejected = approvalData?.filter(p => p.approval_status === 'rejected') || [];
const pending = approvalData?.filter(p => p.approval_status === 'pending') || [];

console.log('Approval Data Summary:');
console.log(`  Approved: ${approved.length}`);
console.log(`  Rejected: ${rejected.length}`);
console.log(`  Pending: ${pending.length}`);
console.log('');

if (rejected.length > 0) {
  console.log('⚠️  REJECTED PROSPECTS:\n');
  rejected.slice(0, 10).forEach((p, i) => {
    const contact = typeof p.contact === 'string' ? JSON.parse(p.contact) : p.contact;
    console.log(`${i + 1}. ${contact.first_name} ${contact.last_name}`);
    console.log(`   Company: ${contact.company_name || 'N/A'}`);
    console.log(`   LinkedIn: ${contact.linkedin_url || 'N/A'}`);
    console.log(`   Date: ${new Date(p.created_at).toLocaleString()}\n`);
  });
  
  if (rejected.length > 10) {
    console.log(`   ... and ${rejected.length - 10} more\n`);
  }
}

// Check if any rejected prospects are in the campaign
console.log('Checking if rejected prospects are in campaign...\n');

const rejectedLinkedIns = rejected.map(p => {
  const contact = typeof p.contact === 'string' ? JSON.parse(p.contact) : p.contact;
  return contact.linkedin_url;
}).filter(Boolean);

const prospectsInCampaign = prospects.filter(p => 
  rejectedLinkedIns.includes(p.linkedin_url)
);

if (prospectsInCampaign.length > 0) {
  console.log(`❌ PROBLEM: ${prospectsInCampaign.length} REJECTED prospects found in campaign!\n`);
  prospectsInCampaign.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name} ${p.last_name} - ${p.company_name}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   LinkedIn: ${p.linkedin_url}\n`);
  });
  
  console.log('🛑 RECOMMENDATION: DO NOT SEND THIS CAMPAIGN');
  console.log('   Stan needs to review and manually remove rejected prospects\n');
} else {
  console.log('✅ No rejected prospects found in campaign');
  console.log(`   Campaign has ${prospects.length} prospects (Stan approved 20-25)\n`);
  
  if (prospects.length > 25) {
    console.log('⚠️  WARNING: Campaign has more prospects than expected');
    console.log(`   Expected: 20-25, Found: ${prospects.length}`);
    console.log('   Stan should review before sending\n');
  }
}
