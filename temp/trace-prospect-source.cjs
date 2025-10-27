#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function traceProspectSource() {
  console.log('🔍 Tracing how the empty prospects were created...\n');

  // Get the empty prospects
  const { data: emptyProspects } = await supabase
    .from('campaign_prospects')
    .select('id, company_name, personalization_data, created_at')
    .in('company_name', ['Stealth Startup', 'Alchemist Accelerator'])
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`Found ${emptyProspects?.length} prospects\n`);

  for (const prospect of emptyProspects || []) {
    console.log(`Prospect: ${prospect.company_name}`);
    console.log(`  Created: ${prospect.created_at}`);
    console.log(`  Source: ${prospect.personalization_data?.source || 'unknown'}`);
    console.log(`  Campaign tag: ${prospect.personalization_data?.campaign_tag || 'none'}`);

    // Try to find the original approval data
    if (prospect.personalization_data?.campaign_tag) {
      const tag = prospect.personalization_data.campaign_tag;

      const { data: session } = await supabase
        .from('prospect_approval_sessions')
        .select('*')
        .eq('campaign_tag', tag)
        .single();

      if (session) {
        console.log(`  Session ID: ${session.id}`);
        console.log(`  Session campaign: ${session.campaign_name}`);

        // Get approval data
        const { data: approvalData } = await supabase
          .from('prospect_approval_data')
          .select('*')
          .eq('session_id', session.id)
          .eq('company->name', prospect.company_name)
          .limit(1)
          .single();

        if (approvalData) {
          console.log(`  Original data found:`);
          console.log(`    Name: ${approvalData.name || 'MISSING'}`);
          console.log(`    LinkedIn URL: ${approvalData.contact?.linkedin_url || 'MISSING'}`);
          console.log(`    Email: ${approvalData.contact?.email || 'MISSING'}`);
          console.log(`    Source: ${approvalData.source}`);
          console.log(`    Full contact data:`, JSON.stringify(approvalData.contact, null, 2));
        } else {
          console.log(`  ❌ No approval data found`);
        }
      }
    }
    console.log('');
  }

  // Check recent LinkedIn imports
  console.log('\n📊 Recent LinkedIn import sessions:');
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  sessions?.forEach((s, i) => {
    console.log(`${i + 1}. ${s.campaign_name}`);
    console.log(`   Created: ${s.created_at}`);
    console.log(`   Total prospects: ${s.total_prospects}`);
    console.log(`   Campaign tag: ${s.campaign_tag}`);
  });
}

traceProspectSource().catch(console.error);
