#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkApprovalSessionData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('🔍 Checking approval session data...\n');

  // Get the approval session
  const { data: session } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('id', '0243e1ca-a12d-4385-9a97-bd18a87acd87')
    .single();

  console.log('📋 Approval Session:');
  console.log(`   ID: ${session.id}`);
  console.log(`   Campaign Name: ${session.campaign_name}`);
  console.log(`   Campaign Tag: ${session.campaign_tag}`);
  console.log(`   Status: ${session.status}`);
  console.log(`   Created: ${session.created_at}`);
  console.log('');

  // Get prospects from this session
  const { data: approvalData } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', session.id);

  console.log(`📊 Found ${approvalData?.length || 0} prospects in approval session:\n`);

  if (approvalData && approvalData.length > 0) {
    approvalData.forEach((p, i) => {
      console.log(`${i + 1}. Prospect ID: ${p.prospect_id}`);
      console.log(`   Name: ${p.name || 'MISSING'}`);
      console.log(`   Title: ${p.title || 'MISSING'}`);
      console.log(`   Company: ${p.company?.name || 'MISSING'}`);
      console.log(`   LinkedIn: ${p.contact?.linkedin_url || p.linkedin_url || 'MISSING'}`);
      console.log(`   Approval Status: ${p.approval_status}`);
      console.log(`   Contact Data:`, p.contact ? JSON.stringify(p.contact, null, 2) : 'NONE');
      console.log('');
    });
  }
}

checkApprovalSessionData().catch(console.error);
