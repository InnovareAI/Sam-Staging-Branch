import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  const wsId = 'c3100bea-82a6-4365-b159-6581f1be9be3'; // Sebastian Henkel

  // Check prospect_approval_data for Sebastian
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, name, total_prospects, approved_count, status')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: false });

  console.log('=== SEBASTIAN APPROVAL SESSIONS ===');
  if (sessions) {
    sessions.forEach(s => {
      console.log('  -', s.name);
      console.log('    Total:', s.total_prospects, '| Approved:', s.approved_count);
      console.log('    Status:', s.status);
    });
  }

  // Check a sample of approved prospects
  if (sessions && sessions.length > 0) {
    const { data: prospects } = await supabase
      .from('prospect_approval_data')
      .select('id, first_name, last_name, connection_degree, status')
      .eq('session_id', sessions[0].id)
      .eq('status', 'approved')
      .limit(10);

    console.log('\n=== SAMPLE APPROVED PROSPECTS ===');
    if (prospects) {
      prospects.forEach(p => {
        console.log('  -', p.first_name, p.last_name, '| Degree:', p.connection_degree || 'NOT SET');
      });
    }
  }
}

check().catch(console.error);
