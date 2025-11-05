// Find Stan's missing CISO prospects by date and keywords
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findMissingProspects() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const cisoSessionId = '5c86a789-a926-4d79-8120-cc3e76939d75';

  console.log('🔍 Searching for Stan\'s missing CISO prospects...\n');

  // 1. Check the specific session again
  console.log('1️⃣ Checking CISO session directly...');
  const { data: cisoProspects, error: cisoError } = await supabase
    .from('prospect_approval_data')
    .select('id, name, title, company, approval_status, created_at')
    .eq('session_id', cisoSessionId);

  console.log('   Session prospects:', cisoProspects?.length || 0);
  if (cisoError) console.error('   Error:', cisoError);

  // 2. Check all prospects created around Oct 21-23, 2025
  console.log('\n2️⃣ Checking all prospects created Oct 21-23, 2025...');
  const { data: dateProspects } = await supabase
    .from('prospect_approval_data')
    .select('id, name, title, company, approval_status, session_id, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', '2024-10-21T00:00:00Z')
    .lte('created_at', '2024-10-23T23:59:59Z')
    .order('created_at', { ascending: false });

  console.log('   Prospects in date range:', dateProspects?.length || 0);

  if (dateProspects && dateProspects.length > 0) {
    console.log('\n   Sample prospects from Oct 21-23:');
    dateProspects.slice(0, 10).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name || 'Unknown'}`);
      console.log(`      Title: ${p.title || 'N/A'}`);
      console.log(`      Status: ${p.approval_status}`);
      console.log(`      Session: ${p.session_id?.substring(0, 8)}`);
    });
  }

  // 3. Search for CISO/security-related prospects
  console.log('\n3️⃣ Searching for CISO/security titles...');
  const { data: cisoTitles } = await supabase
    .from('prospect_approval_data')
    .select('id, name, title, company, approval_status, session_id, created_at')
    .eq('workspace_id', workspaceId)
    .ilike('title', '%ciso%')
    .order('created_at', { ascending: false })
    .limit(50);

  console.log('   Prospects with CISO title:', cisoTitles?.length || 0);

  if (cisoTitles && cisoTitles.length > 0) {
    console.log('\n   Recent CISO prospects:');
    cisoTitles.slice(0, 10).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name || 'Unknown'}`);
      console.log(`      Title: ${p.title || 'N/A'}`);
      console.log(`      Status: ${p.approval_status}`);
      console.log(`      Created: ${new Date(p.created_at).toLocaleDateString()}`);
      console.log(`      Session: ${p.session_id?.substring(0, 8)}`);
    });
  }

  // 4. Check if any prospects reference the CISO session but aren't showing up
  console.log('\n4️⃣ Checking for orphaned prospects...');
  const { data: allWorkspaceProspects } = await supabase
    .from('prospect_approval_data')
    .select('session_id')
    .eq('workspace_id', workspaceId);

  const sessionCounts = {};
  allWorkspaceProspects?.forEach(p => {
    if (p.session_id) {
      sessionCounts[p.session_id] = (sessionCounts[p.session_id] || 0) + 1;
    }
  });

  console.log('   Prospects in CISO session:', sessionCounts[cisoSessionId] || 0);
  console.log('   Total prospects in workspace:', allWorkspaceProspects?.length || 0);

  // 5. Check if they were moved to campaign_prospects
  console.log('\n5️⃣ Checking campaign_prospects table...');
  const { data: campaignProspects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, title, company_name, campaign_id, status, created_at')
    .eq('workspace_id', workspaceId)
    .ilike('title', '%ciso%')
    .order('created_at', { ascending: false })
    .limit(30);

  console.log('   CISO prospects in campaigns:', campaignProspects?.length || 0);

  if (campaignProspects && campaignProspects.length > 0) {
    console.log('\n   CISO prospects in campaigns:');
    campaignProspects.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`      Title: ${p.title || 'N/A'}`);
      console.log(`      Company: ${p.company_name || 'N/A'}`);
      console.log(`      Status: ${p.status}`);
      console.log(`      Created: ${new Date(p.created_at).toLocaleDateString()}`);
      console.log(`      Campaign: ${p.campaign_id?.substring(0, 8)}`);
    });
  }

  console.log('\n📊 SUMMARY:');
  console.log('   Prospects in CISO session:', cisoProspects?.length || 0);
  console.log('   Prospects created Oct 21-23:', dateProspects?.length || 0);
  console.log('   CISO title prospects in workspace:', cisoTitles?.length || 0);
  console.log('   CISO prospects in campaigns:', campaignProspects?.length || 0);
}

findMissingProspects().catch(console.error);
