// Verify test session and prospects
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifySession() {
  const sessionId = '270be91d-ec66-48d1-9efd-df2b540c466b';
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('🔍 Verifying test session...\n');

  // Check session
  const { data: session, error: sessionError } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError) {
    console.error('❌ Session error:', sessionError);
  } else {
    console.log('✅ Session found:', {
      id: session.id,
      status: session.status,
      campaign_name: session.campaign_name,
      total_prospects: session.total_prospects,
      created_at: session.created_at
    });
  }

  // Check prospects
  const { data: prospects, error: prospectsError } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', sessionId);

  if (prospectsError) {
    console.error('❌ Prospects error:', prospectsError);
  } else {
    console.log('\n✅ Prospects found:', prospects?.length || 0);
    prospects?.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} - ${p.title} at ${p.company?.name || 'Unknown'}`);
      console.log(`      Status: ${p.approval_status}`);
      console.log(`      LinkedIn: ${p.contact?.linkedin_url || 'N/A'}`);
    });
  }

  // Check all recent sessions (any status)
  console.log('\n📋 All recent sessions:');
  const { data: allSessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, status, campaign_name, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(10);

  allSessions?.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.campaign_name} - ${s.status} (${s.id})`);
  });
}

verifySession().catch(console.error);
