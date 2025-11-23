#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMexicoProspects() {
  const workspaceId = '96c03b38-a2f4-40de-9e16-43098599e1d4';
  
  console.log('\n🇲🇽 CHECKING MEXICO MARKETING PROSPECTS\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get most recent approval sessions
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (sessions && sessions.length > 0) {
    const latestSession = sessions[0];
    console.log(`Latest Approval Session: ${latestSession.id}`);
    console.log(`   ├─ Status: ${latestSession.status}`);
    console.log(`   ├─ Created: ${new Date(latestSession.created_at).toLocaleString()}`);
    console.log('');

    // Get prospects from this session
    const { data: prospects } = await supabase
      .from('prospect_approval_data')
      .select('*')
      .eq('session_id', latestSession.id)
      .order('created_at', { ascending: false })
      .limit(10);

    console.log(`Found ${prospects?.length || 0} prospects in approval session:\n`);

    if (prospects && prospects.length > 0) {
      prospects.forEach((p, i) => {
        console.log(`${i + 1}. ${p.name}`);
        console.log(`   ├─ Title: ${p.title || 'N/A'}`);
        console.log(`   ├─ Company: ${p.company?.name || 'N/A'}`);
        console.log(`   ├─ LinkedIn URL: ${p.linkedin_url ? '✅' : '❌'}`);
        console.log(`   └─ Created: ${new Date(p.created_at).toLocaleString()}\n`);
      });

      // Check if any decisions made
      const { data: decisions } = await supabase
        .from('prospect_approval_decisions')
        .select('*')
        .eq('session_id', latestSession.id);

      if (decisions && decisions.length > 0) {
        const approved = decisions.filter(d => d.decision === 'approved').length;
        const rejected = decisions.filter(d => d.decision === 'rejected').length;
        console.log(`Decisions Made:`);
        console.log(`   ├─ Approved: ${approved} ✅`);
        console.log(`   └─ Rejected: ${rejected}\n`);
      }
    }
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

checkMexicoProspects();
