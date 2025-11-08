const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function showSessions() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                 ALL APPROVAL SESSIONS FOR BLL                         ');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Get all approval sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: false });

  if (sessionsError) {
    console.log(`❌ Error: ${sessionsError.message}\n`);
    return;
  }

  if (!sessions || sessions.length === 0) {
    console.log('⚠️  No approval sessions found\n');
    return;
  }

  console.log(`Total sessions: ${sessions.length}\n`);

  for (const session of sessions) {
    console.log(`Session: ${session.session_name || 'Unnamed'}`);
    console.log(`  ID: ${session.id}`);
    console.log(`  Status: ${session.status}`);
    console.log(`  Created: ${new Date(session.created_at).toLocaleString()}`);
    console.log(`  Campaign ID: ${session.campaign_id || 'None'}`);

    // Count prospects in this session
    const { data: prospects, error: prospectsError } = await supabase
      .from('prospect_approval_data')
      .select('id, status, prospect_data')
      .eq('session_id', session.id);

    if (!prospectsError && prospects) {
      const statusCounts = {};
      prospects.forEach(p => {
        const status = p.status || 'pending';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      console.log(`  Prospects: ${prospects.length} total`);
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`    - ${status}: ${count}`);
      });

      // Show sample prospects
      if (prospects.length > 0) {
        console.log(`  Sample prospects:`);
        prospects.slice(0, 3).forEach((p, idx) => {
          const data = p.prospect_data || {};
          const name = `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unknown';
          console.log(`    ${idx + 1}. ${name} (${p.status || 'pending'})`);
        });
      }
    }

    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

showSessions().catch(console.error);
