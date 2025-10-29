#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 MANUALLY ADDING PROSPECTS TO CAMPAIGN\n');

// Get latest campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

console.log(`Campaign: ${campaign.name}`);
console.log(`ID: ${campaign.id}`);
console.log(`Workspace: ${campaign.workspace_id}\n`);

// Get test prospects
const { data: testProspects } = await supabase
  .from('prospect_approval_data')
  .select(`
    *,
    prospect_approval_sessions(
      workspace_id,
      campaign_name
    )
  `)
  .eq('approval_status', 'approved')
  .ilike('name', '%Test Prospect%')
  .limit(2);

console.log(`Found ${testProspects?.length || 0} test prospects\n`);

if (!testProspects || testProspects.length === 0) {
  console.log('❌ No test prospects found');
  process.exit(0);
}

// Transform to campaign_prospects format
const campaignProspects = testProspects.map(p => {
  const nameParts = (p.name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // CRITICAL: Extract LinkedIn URL from BOTH locations
  const linkedinUrl = p.contact?.linkedin_url || p.linkedin_url || null;

  console.log(`📊 ${p.name}:`);
  console.log(`   prospect_id: ${p.prospect_id}`);
  console.log(`   contact.linkedin_url: ${p.contact?.linkedin_url}`);
  console.log(`   linkedin_url: ${p.linkedin_url}`);
  console.log(`   EXTRACTED: ${linkedinUrl}\n`);

  return {
    campaign_id: campaign.id,
    workspace_id: campaign.workspace_id,
    first_name: firstName,
    last_name: lastName,
    email: p.contact?.email || null,
    company_name: p.company?.name || '',
    linkedin_url: linkedinUrl,  // CRITICAL FIX
    title: p.title || '',
    location: p.location || null,
    industry: p.company?.industry?.[0] || 'Not specified',
    status: 'approved',
    notes: 'Manually added for testing',
    personalization_data: {
      source: 'manual_test',
      prospect_id: p.prospect_id
    }
  };
});

// Insert
console.log('💾 Inserting into campaign_prospects...\n');
const { data: inserted, error } = await supabase
  .from('campaign_prospects')
  .insert(campaignProspects)
  .select();

if (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

console.log(`✅ Added ${inserted.length} prospects to campaign!\n`);
inserted.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
  console.log(`   LinkedIn: ${p.linkedin_url ? '✅ ' + p.linkedin_url : '❌ MISSING'}\n`);
});

console.log('\n💡 Now try executing the campaign!');
