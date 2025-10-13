#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkSessionExists() {
  // Get all sessions
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_name, total_prospects')
    .order('created_at', { ascending: false });

  console.log('ALL SESSIONS IN DATABASE:\n');
  for (const s of sessions || []) {
    console.log(`${s.id}`);
    console.log(`  Name: ${s.campaign_name}`);
    console.log(`  Claims: ${s.total_prospects} prospects`);

    // Check actual count
    const { count } = await supabase
      .from('prospect_approval_data')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', s.id);

    console.log(`  Actual: ${count} prospects`);

    if (count === 0 && s.total_prospects > 0) {
      console.log(`  ⚠️ MISSING ${s.total_prospects} PROSPECTS!`);
    }
    console.log('');
  }
}

checkSessionExists().catch(console.error);
