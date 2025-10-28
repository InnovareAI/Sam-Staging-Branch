#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkApprovalSourceData() {
  // Get the most recent approval session for tl@innovareai.com
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('user_id', 'f6885ff3-deef-4781-8721-93011c990b1b')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!sessions || sessions.length === 0) {
    console.log('❌ No approval sessions found');
    return;
  }

  const session = sessions[0];
  console.log('📋 Latest Approval Session:');
  console.log('  Campaign:', session.campaign_name);
  console.log('  Session ID:', session.id);
  console.log('  Created:', new Date(session.created_at).toLocaleString());
  console.log();

  // Get prospects from this session
  const { data: prospects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', session.id)
    .limit(5);

  console.log(`📊 Prospects in session: ${prospects?.length || 0}\n`);

  if (prospects && prospects.length > 0) {
    prospects.forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.name}`);
      console.log(`   Company: ${p.company?.name || 'Unknown'}`);
      console.log(`   LinkedIn URL (contact.linkedin_url): ${p.contact?.linkedin_url || '❌ MISSING'}`);
      console.log(`   LinkedIn URL (direct): ${p.linkedin_url || 'none'}`);
      console.log(`   Status: ${p.approval_status}`);
      console.log(`   Full contact object:`, JSON.stringify(p.contact, null, 2));
      console.log();
    });
  } else {
    console.log('⚠️ No prospects in this session - they may have been removed after campaign creation');
  }
}

checkApprovalSourceData();
