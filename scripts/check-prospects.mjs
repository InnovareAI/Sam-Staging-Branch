// Check for existing prospects
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProspects() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08'; // Blue Label Labs

  // Check approval sessions
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, created_at, session_status')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('📋 Recent approval sessions:', sessions?.length || 0);
  sessions?.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.id} - ${s.session_status} (${s.created_at})`);
  });

  // Check approved prospects
  const { data: approved } = await supabase
    .from('prospect_approval_data')
    .select('id, contact, company, approval_status')
    .eq('workspace_id', workspaceId)
    .eq('approval_status', 'approved')
    .limit(10);

  console.log('\n✅ Approved prospects:', approved?.length || 0);
  if (approved && approved.length > 0) {
    approved.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.contact?.firstName || 'Unknown'} ${p.contact?.lastName || ''} at ${p.company?.name || 'Unknown'}`);
    });
  }

  // Check campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, campaign_type, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n📊 Recent campaigns:', campaigns?.length || 0);
  campaigns?.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.name}`);
    console.log(`      Status: ${c.status}, Type: ${c.campaign_type || 'messenger'}`);
    console.log(`      ID: ${c.id}`);
  });
}

checkProspects().catch(console.error);
