#!/usr/bin/env node
/**
 * Test uploading prospects with LinkedIn URLs to diagnose the issue
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUpload() {
  console.log('🧪 Testing prospect upload with LinkedIn URLs...\n');

  // Get the latest campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!campaign) {
    console.log('❌ No campaign found');
    return;
  }

  console.log('📋 Target Campaign:');
  console.log('  Name:', campaign.name);
  console.log('  ID:', campaign.id);
  console.log();

  // Get the latest approval session data
  const { data: session } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('user_id', 'f6885ff3-deef-4781-8721-93011c990b1b')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const { data: approvalProspects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', session.id);

  console.log(`📊 Found ${approvalProspects?.length || 0} prospects in approval session\n`);

  // Prepare prospects exactly as CampaignHub does (line 3655-3667)
  const mappedProspects = approvalProspects.map((prospect) => {
    const nameParts = (prospect.name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      first_name: firstName,
      last_name: lastName,
      name: prospect.name,
      email: prospect.contact?.email || '',
      company: prospect.company?.name || '',
      company_name: prospect.company?.name || '',
      title: prospect.title || '',
      linkedin_url: prospect.linkedin_url || prospect.contact?.linkedin_url || '',
      contact: prospect.contact, // Include the full contact object
      connection_degree: prospect.connection_degree,
      sessionId: session.id
    };
  });

  console.log('🔍 Mapped Prospects (what frontend should send):\n');
  mappedProspects.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.name}`);
    console.log(`   linkedin_url (direct): ${p.linkedin_url}`);
    console.log(`   contact.linkedin_url: ${p.contact?.linkedin_url}`);
    console.log();
  });

  // Now insert directly to test
  console.log('💾 Directly inserting into campaign_prospects...\n');

  for (const prospect of mappedProspects) {
    const prospectData = {
      campaign_id: campaign.id,
      workspace_id: 'babdcab8-1a78-4b2f-913e-6e9fd9821009',
      first_name: prospect.first_name,
      last_name: prospect.last_name,
      email: prospect.email || null,
      company_name: prospect.company,
      title: prospect.title,
      linkedin_url: prospect.linkedin_url || prospect.contact?.linkedin_url || null,
      status: 'approved', // Using approved status
      location: '',
      industry: null,
      personalization_data: {}
    };

    console.log(`Inserting: ${prospect.name}`);
    console.log(`  LinkedIn URL to store: ${prospectData.linkedin_url}`);

    const { error } = await supabase
      .from('campaign_prospects')
      .insert(prospectData);

    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
    } else {
      console.log(`  ✅ Inserted successfully`);
    }
  }

  console.log('\n🔍 Verifying in database...\n');

  const { data: storedProspects } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, linkedin_url, status')
    .eq('campaign_id', campaign.id);

  storedProspects?.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.first_name} ${p.last_name}`);
    console.log(`   LinkedIn URL: ${p.linkedin_url || '❌ MISSING'}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   Executable: ${p.status === 'approved' && p.linkedin_url ? '✅ YES' : '❌ NO'}`);
    console.log();
  });
}

testUpload();
