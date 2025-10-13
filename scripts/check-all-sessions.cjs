#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkAllSessions() {
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_name, campaign_tag, total_prospects, created_at')
    .order('created_at', { ascending: false });

  console.log('ALL SESSIONS:\n');
  console.log(`Total: ${sessions?.length || 0}\n`);

  const uniqueTags = new Set();

  for (const s of sessions || []) {
    console.log(`${s.id.slice(0, 8)}... | Campaign: ${s.campaign_name || 'NULL'} | Tag: ${s.campaign_tag || 'NULL'} | Prospects: ${s.total_prospects}`);
    if (s.campaign_tag) {
      uniqueTags.add(s.campaign_tag);
    }
  }

  console.log(`\n\nUNIQUE CAMPAIGN TAGS: ${uniqueTags.size}`);
  uniqueTags.forEach(tag => console.log(`  - ${tag}`));
}

checkAllSessions().catch(console.error);
