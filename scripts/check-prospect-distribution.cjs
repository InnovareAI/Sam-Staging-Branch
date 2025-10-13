#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkProspectDistribution() {
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_tag')
    .order('created_at', { ascending: false });

  console.log('PROSPECT DISTRIBUTION BY SESSION:\n');

  let totalProspects = 0;

  for (const session of sessions || []) {
    const { data: prospects } = await supabase
      .from('prospect_approval_data')
      .select('name, session_id')
      .eq('session_id', session.id)
      .limit(3);

    const { count } = await supabase
      .from('prospect_approval_data')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);

    console.log(`Session: ${session.id.slice(0, 8)}...`);
    console.log(`  Tag: ${session.campaign_tag}`);
    console.log(`  Prospects: ${count}`);
    if (prospects && prospects.length > 0) {
      console.log(`  Sample names:`);
      prospects.forEach(p => console.log(`    - ${p.name}`));
    }
    console.log('');

    totalProspects += count || 0;
  }

  console.log(`TOTAL PROSPECTS: ${totalProspects}`);
}

checkProspectDistribution().catch(console.error);
