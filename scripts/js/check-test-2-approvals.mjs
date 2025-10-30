#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function checkApprovals() {
  console.log('🔍 Checking Test 2 Approvals\n');
  console.log('='.repeat(70));

  // Find test 2 approval session
  const { data: session } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('campaign_name', '20251030-IAI-test 2')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!session) {
    console.log('❌ No session found for test 2');
    return;
  }

  console.log('Session found:');
  console.log(`   Name: ${session.campaign_name}`);
  console.log(`   Session ID: ${session.id}`);
  console.log(`   Status: ${session.status}`);
  console.log(`   Created: ${new Date(session.created_at).toLocaleString()}`);

  // Get all prospects in this session
  const { data: prospects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', session.id)
    .order('updated_at', { ascending: false });

  console.log(`\n📊 Total prospects in session: ${prospects?.length || 0}`);

  if (prospects && prospects.length > 0) {
    const approved = prospects.filter(p => p.approval_status === 'approved');
    const pending = prospects.filter(p => p.approval_status === 'pending');
    const rejected = prospects.filter(p => p.approval_status === 'rejected');

    console.log(`\nStatus breakdown:`);
    console.log(`   ✅ Approved: ${approved.length}`);
    console.log(`   ⏳ Pending: ${pending.length}`);
    console.log(`   ❌ Rejected: ${rejected.length}`);

    if (approved.length > 0) {
      console.log(`\n✅ Approved prospects:`);
      approved.forEach((p, i) => {
        const contact = p.contact || {};
        console.log(`\n${i + 1}. ${contact.firstName || 'N/A'} ${contact.lastName || ''}`);
        console.log(`   LinkedIn: ${contact.linkedin_url || contact.linkedinUrl || 'N/A'}`);
        console.log(`   Approved at: ${p.updated_at ? new Date(p.updated_at).toLocaleString() : 'N/A'}`);
        console.log(`   Prospect ID: ${p.prospect_id}`);
      });
    }

    console.log(`\n\n💡 Next step: Check if these prospects were transferred to campaign`);
    
    // Check campaign prospects
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('workspace_id', WORKSPACE_ID)
      .ilike('name', '20251030-IAI-test 2')
      .single();

    if (campaign) {
      const { data: campaignProspects } = await supabase
        .from('campaign_prospects')
        .select('*')
        .eq('campaign_id', campaign.id);

      console.log(`\n📦 Campaign prospects: ${campaignProspects?.length || 0}`);
      
      if (campaignProspects && campaignProspects.length > 0) {
        console.log(`\nTransferred prospects:`);
        campaignProspects.forEach((p, i) => {
          console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
          console.log(`   LinkedIn: ${p.linkedin_url || 'N/A'}`);
        });
      } else {
        console.log(`\n❌ No prospects in campaign yet!`);
        console.log(`   This means the auto-transfer didn't work.`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
}

checkApprovals().catch(console.error);
