import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  const wsId = 'c3100bea-82a6-4365-b159-6581f1be9be3'; // Sebastian Henkel

  // Check prospect_approval_sessions
  const { data: sessions, error: sessErr } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', wsId);

  console.log('Sessions error:', sessErr);
  console.log('Sessions count:', sessions?.length || 0);

  // Check campaign_prospects for Sebastian's campaign
  const { data: camp } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('workspace_id', wsId)
    .single();

  console.log('\nCampaign:', camp?.name);

  if (camp) {
    const { data: prospects, count } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, connection_degree, status', { count: 'exact' })
      .eq('campaign_id', camp.id)
      .limit(10);

    console.log('Total prospects:', count);
    console.log('\nSample prospects:');
    if (prospects) {
      prospects.forEach(p => {
        console.log('  -', p.first_name, p.last_name, '| Degree:', p.connection_degree || 'NOT SET', '| Status:', p.status);
      });
    }

    // Count by connection degree
    const { data: degreeStats } = await supabase
      .from('campaign_prospects')
      .select('connection_degree')
      .eq('campaign_id', camp.id);

    const degreeCounts = {};
    degreeStats?.forEach(p => {
      const d = p.connection_degree || 'NOT SET';
      degreeCounts[d] = (degreeCounts[d] || 0) + 1;
    });

    console.log('\nDegree breakdown:');
    Object.entries(degreeCounts).forEach(([d, c]) => {
      console.log('  ', d, ':', c);
    });
  }
}

check().catch(console.error);
