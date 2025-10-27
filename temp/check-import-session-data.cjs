#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkImportSessionData() {
  console.log('🔍 Checking most recent import session data...\n');

  // Get most recent import session
  const { data: session } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  console.log(`Session: ${session.campaign_name}`);
  console.log(`  ID: ${session.id}`);
  console.log(`  Created: ${session.created_at}`);
  console.log(`  Total prospects: ${session.total_prospects}`);
  console.log(`  Campaign tag: ${session.campaign_tag}\n`);

  // Get prospects from this session
  const { data: prospects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', session.id);

  console.log(`Found ${prospects?.length} prospects in approval data:\n`);

  prospects?.forEach((p, i) => {
    console.log(`Prospect ${i + 1}:`);
    console.log(`  Name: ${p.name || 'MISSING'}`);
    console.log(`  Title: ${p.title || 'MISSING'}`);
    console.log(`  Company: ${p.company?.name || 'MISSING'}`);
    console.log(`  LinkedIn URL: ${p.contact?.linkedin_url || 'MISSING'}`);
    console.log(`  Email: ${p.contact?.email || 'MISSING'}`);
    console.log(`  Source: ${p.source}`);
    console.log(`  Approval status: ${p.approval_status}`);
    console.log(`  Full contact JSONB:`, JSON.stringify(p.contact, null, 2));
    console.log('');
  });
}

checkImportSessionData().catch(console.error);
