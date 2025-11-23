#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSession() {
  const campaignId = '1d3428f8-454d-4ffb-8337-4273f781adfb';
  
  console.log('\n🔍 CHECKING APPROVAL SESSION DATA\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get the campaign to find session_id
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  console.log('Campaign Details:');
  console.log(`   ├─ Name: ${campaign.name}`);
  console.log(`   ├─ Campaign ID: ${campaign.id}`);
  console.log(`   └─ Created: ${campaign.created_at}\n`);

  // Check if there's prospect approval data for this workspace recently
  const { data: sessions, error: sessionsError } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', campaign.workspace_id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (sessionsError) {
    console.error('❌ Error fetching sessions:', sessionsError.message);
    return;
  }

  console.log(`Found ${sessions?.length || 0} recent approval sessions:\n`);
  
  sessions?.forEach((session, i) => {
    console.log(`${i + 1}. Session ID: ${session.id}`);
    console.log(`   ├─ Status: ${session.status}`);
    console.log(`   ├─ Created: ${new Date(session.created_at).toLocaleString()}`);
    console.log(`   └─ Campaign Type: ${session.campaign_type}\n`);
  });

  // Check approval data for most recent session
  if (sessions && sessions.length > 0) {
    const latestSession = sessions[0];
    
    const { data: approvalData, count } = await supabase
      .from('prospect_approval_data')
      .select('*', { count: 'exact' })
      .eq('session_id', latestSession.id);

    console.log(`\n📊 Latest Session (${latestSession.id}):`);
    console.log(`   └─ Prospects in approval data: ${count || 0}\n`);

    if (approvalData && approvalData.length > 0) {
      console.log('Sample prospects:');
      approvalData.slice(0, 3).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name}`);
        console.log(`      ├─ LinkedIn URL: ${p.linkedin_url || p.contact?.linkedin_url || 'Missing'}`);
        console.log(`      ├─ Company: ${p.company?.name || 'Unknown'}`);
        console.log(`      └─ Title: ${p.title || 'Unknown'}\n`);
      });
    }

    // Check decisions
    const { data: decisions, count: decisionCount } = await supabase
      .from('prospect_approval_decisions')
      .select('*', { count: 'exact' })
      .eq('session_id', latestSession.id);

    console.log(`\n📋 Decisions for session ${latestSession.id}:`);
    console.log(`   └─ Total decisions: ${decisionCount || 0}`);
    
    if (decisions && decisions.length > 0) {
      const approved = decisions.filter(d => d.decision === 'approved').length;
      const rejected = decisions.filter(d => d.decision === 'rejected').length;
      console.log(`   ├─ Approved: ${approved}`);
      console.log(`   └─ Rejected: ${rejected}\n`);
    }
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

checkSession();
