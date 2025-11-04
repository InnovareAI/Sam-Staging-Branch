const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

(async () => {
  console.log('🔍 CHECKING ALL RECENT PROSPECTS\n');

  const { data: prospects } = await supabase
    .from('prospect_approval_data')
    .select('id, session_id, approval_status, contact, created_at')
    .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
    .gte('created_at', '2025-11-05T00:00:00')
    .order('created_at', { ascending: false });

  console.log('Total prospects from Nov 4+:', prospects.length);
  console.log('');

  // Group by session
  const sessions = {};
  prospects.forEach(p => {
    const contact = typeof p.contact === 'string' ? JSON.parse(p.contact) : p.contact;
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'NO NAME';

    if (!sessions[p.session_id]) {
      sessions[p.session_id] = [];
    }
    sessions[p.session_id].push({
      name,
      status: p.approval_status,
      linkedin: contact.linkedInUrl || contact.linkedin_url || 'NO URL',
      created: p.created_at
    });
  });

  console.log('📊 PROSPECTS BY SESSION:\n');
  Object.entries(sessions)
    .sort((a, b) => new Date(b[1][0].created) - new Date(a[1][0].created))
    .forEach(([sessionId, prospectsInSession]) => {
      console.log(`Session: ${sessionId}`);
      console.log(`  Created: ${new Date(prospectsInSession[0].created).toLocaleString()}`);
      console.log(`  Count: ${prospectsInSession.length}`);
      console.log(`  Status breakdown:`);
      const statusCount = {};
      prospectsInSession.forEach(p => {
        statusCount[p.status] = (statusCount[p.status] || 0) + 1;
      });
      Object.entries(statusCount).forEach(([status, count]) => {
        console.log(`    ${status}: ${count}`);
      });
      console.log('  Names:');
      prospectsInSession.forEach((p, i) => {
        console.log(`    ${i+1}. ${p.name} (${p.status})`);
      });
      console.log('');
    });
})();
