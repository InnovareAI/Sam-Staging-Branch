#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkProspectCreationSource() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('🔍 Checking how prospects were created...\n');

  // Get the prospects with full personalization_data
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', 'ac81022c-48f4-4f06-87be-1467175f5b61');

  prospects.forEach((p, i) => {
    console.log(`📋 Prospect ${i + 1}:`);
    console.log(`   ID: ${p.id}`);
    console.log(`   First Name: "${p.first_name || ''}"`);
    console.log(`   Last Name: "${p.last_name || ''}"`);
    console.log(`   LinkedIn: ${p.linkedin_url}`);
    console.log(`   Created At: ${p.created_at}`);
    console.log(`   Personalization Data:`, JSON.stringify(p.personalization_data, null, 2));
    console.log('');
  });

  // Check if there are ANY approval sessions for this workspace
  const { data: allSessions } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`\n🗂️  All approval sessions for this workspace (last 10):`);
  if (allSessions && allSessions.length > 0) {
    allSessions.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.id}`);
      console.log(`      Campaign Name: "${s.campaign_name || 'NONE'}"`);
      console.log(`      Tag: "${s.campaign_tag || 'NONE'}"`);
      console.log(`      Created: ${s.created_at}`);
      console.log(`      Status: ${s.status}`);
      console.log('');
    });
  } else {
    console.log('   No approval sessions found!');
  }
}

checkProspectCreationSource().catch(console.error);
