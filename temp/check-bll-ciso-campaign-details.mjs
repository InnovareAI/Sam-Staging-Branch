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

console.log('🔍 Analyzing: 20251106-BLL-CISO Outreach - Mid Market\n');

const CAMPAIGN_ID = '0a56408b-be39-4144-870f-2b0dce45b620';
const WORKSPACE_ID = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

// Get all prospects in the campaign
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, company_name, title, status, linkedin_url')
  .eq('campaign_id', CAMPAIGN_ID)
  .order('last_name', { ascending: true });

console.log(`Campaign Prospects: ${prospects.length} total\n`);
console.log('='.repeat(60));
console.log('');

prospects.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
  console.log(`   Company: ${p.company_name || 'N/A'}`);
  console.log(`   Title: ${p.title || 'N/A'}`);
  console.log(`   Status: ${p.status}`);
  console.log('');
});

console.log('='.repeat(60));
console.log(`TOTAL: ${prospects.length} prospects in campaign`);
console.log('='.repeat(60));
console.log('');

// Check approval data for these specific prospects
console.log('Checking prospect_approval_data for matches...\n');

const linkedinUrls = prospects.map(p => p.linkedin_url).filter(Boolean);

const { data: approvalRecords } = await supabase
  .from('prospect_approval_data')
  .select('approval_status, contact, created_at')
  .eq('workspace_id', WORKSPACE_ID);

// Match by LinkedIn URL
const rejectedMatches = [];
const approvedMatches = [];

approvalRecords?.forEach(record => {
  const contact = typeof record.contact === 'string' ? JSON.parse(record.contact) : record.contact;
  const linkedinUrl = contact.linkedin_url;
  
  if (linkedinUrls.includes(linkedinUrl)) {
    if (record.approval_status === 'rejected') {
      rejectedMatches.push({ ...contact, approval_date: record.created_at });
    } else if (record.approval_status === 'approved') {
      approvedMatches.push({ ...contact, approval_date: record.created_at });
    }
  }
});

console.log(`Approved in campaign: ${approvedMatches.length}`);
console.log(`Rejected but still in campaign: ${rejectedMatches.length}\n`);

if (rejectedMatches.length > 0) {
  console.log('🛑 REJECTED PROSPECTS FOUND IN CAMPAIGN:\n');
  rejectedMatches.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name} ${p.last_name} - ${p.company_name}`);
    console.log(`   Rejected on: ${new Date(p.approval_date).toLocaleString()}\n`);
  });
  console.log('❌ DO NOT SEND - Stan needs to review and remove these prospects\n');
} else {
  console.log('✅ No rejected prospects found in campaign');
  console.log(`   All ${prospects.length} prospects appear to be approved\n`);
  
  if (prospects.length !== approvedMatches.length) {
    console.log(`⚠️  Note: ${prospects.length} in campaign but only ${approvedMatches.length} approval records found`);
    console.log('   Some prospects may not have approval records\n');
  }
}
