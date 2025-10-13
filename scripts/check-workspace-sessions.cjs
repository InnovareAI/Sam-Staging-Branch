#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkWorkspaceSessions() {
  // Get all approval sessions with workspace info
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, workspace_id, user_id, campaign_name, campaign_tag, status, total_prospects, pending_count, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  console.log('\n=== ACTIVE APPROVAL SESSIONS BY WORKSPACE ===\n');

  if (sessions && sessions.length > 0) {
    // Get workspace names
    const workspaceIds = [...new Set(sessions.map(s => s.workspace_id))];
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name, tenant')
      .in('id', workspaceIds);

    const workspaceMap = {};
    workspaces?.forEach(w => {
      workspaceMap[w.id] = w;
    });

    // Get user emails
    const userIds = [...new Set(sessions.map(s => s.user_id))];
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('id', userIds);

    const userMap = {};
    users?.forEach(u => {
      userMap[u.id] = u.email;
    });

    // Group by workspace
    const byWorkspace = {};
    sessions.forEach(session => {
      const wsId = session.workspace_id;
      if (!byWorkspace[wsId]) {
        byWorkspace[wsId] = [];
      }
      byWorkspace[wsId].push(session);
    });

    // Display
    Object.entries(byWorkspace).forEach(([wsId, wsSessions]) => {
      const workspace = workspaceMap[wsId];
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`WORKSPACE: ${workspace?.name || 'Unknown'}`);
      console.log(`Tenant: ${workspace?.tenant || 'N/A'}`);
      console.log(`ID: ${wsId.substring(0, 8)}...`);
      console.log(`Sessions: ${wsSessions.length}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');

      wsSessions.forEach((session, idx) => {
        console.log(`  [${idx + 1}] Campaign: ${session.campaign_name || 'N/A'}`);
        console.log(`      Tag: ${session.campaign_tag || 'N/A'}`);
        console.log(`      User: ${userMap[session.user_id] || 'Unknown'}`);
        console.log(`      Prospects: ${session.total_prospects} total, ${session.pending_count} pending`);
        console.log(`      Created: ${new Date(session.created_at).toLocaleString()}`);
        console.log(`      Session ID: ${session.id.substring(0, 8)}...`);
        console.log('');
      });
    });

    console.log(`\n📊 TOTAL: ${sessions.length} active sessions across ${Object.keys(byWorkspace).length} workspaces`);
  } else {
    console.log('No active sessions found');
  }
}

checkWorkspaceSessions().catch(console.error);
