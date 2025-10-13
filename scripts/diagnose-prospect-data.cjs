#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // InnovareAI

async function diagnoseProspectData() {
  console.log('=== PROSPECT DATA DIAGNOSIS ===\n');

  const problemSessions = [
    { id: 'd0103aaa-4dde-471d-9b7d-48c4ca5a31cf', name: '20251013-IAI-Startup campaign 1', expectedCount: 50 },
    { id: '3a615a25-e90f-48eb-b7f7-c24c6a5a8c6a', name: '20251010-CLIENT-Session-3a615a25', expectedCount: 20 },
    { id: 'fb9a7f42-2a15-41d5-8e31-4c8c6f9a5c2a', name: '20251010-CLIENT-Session-fb9a7f42', expectedCount: 20 }
  ];

  for (const session of problemSessions) {
    console.log(`\n📋 SESSION: ${session.name} (${session.id.substring(0, 8)})`);
    console.log(`   Expected: ${session.expectedCount} prospects\n`);

    // Check if prospects exist
    const { data: prospects, error, count } = await supabase
      .from('prospect_approval_data')
      .select('prospect_id, name, company, enrichment_score, created_at', { count: 'exact' })
      .eq('session_id', session.id)
      .order('enrichment_score', { ascending: false })
      .limit(5);

    if (error) {
      console.log(`   ❌ ERROR: ${error.message}\n`);
      continue;
    }

    console.log(`   ✅ Found ${count} prospects in database`);

    if (prospects && prospects.length > 0) {
      console.log(`   📊 Sample data (first 5):`);
      prospects.forEach((p, i) => {
        console.log(`      ${i+1}. ${p.name} @ ${p.company} (score: ${p.enrichment_score})`);
        console.log(`         ID: ${p.prospect_id}`);
        console.log(`         Created: ${p.created_at}`);
      });
    } else {
      console.log(`   ⚠️ No prospect data returned despite count = ${count}`);
    }

    // Check if there are any decisions for this session
    const { data: decisions, count: decisionCount } = await supabase
      .from('prospect_approval_decisions')
      .select('prospect_id, decision', { count: 'exact' })
      .eq('session_id', session.id);

    console.log(`   📝 Decisions: ${decisionCount || 0} recorded`);
    if (decisions && decisions.length > 0) {
      const approved = decisions.filter(d => d.decision === 'approved').length;
      const rejected = decisions.filter(d => d.decision === 'rejected').length;
      console.log(`      Approved: ${approved} | Rejected: ${rejected}`);
    }
  }

  console.log('\n\n=== SESSION OWNERSHIP CHECK ===\n');

  // Get user IDs
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const tlUser = users.find(u => u.email === 'tl@innovareai.com');
  const csUser = users.find(u => u.email === 'cs@innovareai.com');

  console.log(`tl@innovareai.com: ${tlUser?.id}`);
  console.log(`cs@innovareai.com: ${csUser?.id}\n`);

  for (const session of problemSessions) {
    const { data: sessionData } = await supabase
      .from('prospect_approval_sessions')
      .select('user_id, workspace_id')
      .eq('id', session.id)
      .single();

    if (sessionData) {
      const ownerEmail = sessionData.user_id === tlUser?.id ? 'tl@innovareai.com' :
                         sessionData.user_id === csUser?.id ? 'cs@innovareai.com' :
                         'unknown';
      console.log(`${session.name.substring(0, 30)}...`);
      console.log(`   Owner: ${ownerEmail}`);
      console.log(`   Workspace: ${sessionData.workspace_id === WORKSPACE_ID ? '✅ InnovareAI' : '❌ Different'}`);
    }
  }
}

diagnoseProspectData().catch(console.error);
