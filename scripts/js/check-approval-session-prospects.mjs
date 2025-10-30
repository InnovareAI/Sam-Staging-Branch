#!/usr/bin/env node
/**
 * Check prospects in the approval session
 */

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

async function checkApprovalSession() {
  console.log('🔍 Checking Approval Session Prospects\n');
  console.log('='.repeat(70));

  // Get the approval session
  const { data: session } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('campaign_name', '20251030-IAI-test 1')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!session) {
    console.log('❌ No approval session found');
    return;
  }

  console.log('Session Details:');
  console.log(`   Name: ${session.campaign_name}`);
  console.log(`   Session ID: ${session.id}`);
  console.log(`   Status: ${session.status}`);
  console.log(`   Created: ${new Date(session.created_at).toLocaleString()}`);

  // Get prospects in this session
  const { data: prospects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', session.id);

  console.log(`\n📊 Found ${prospects?.length || 0} prospects in session\n`);

  if (prospects && prospects.length > 0) {
    // Group by approval status
    const approved = prospects.filter(p => p.approval_status === 'approved');
    const pending = prospects.filter(p => p.approval_status === 'pending');
    const rejected = prospects.filter(p => p.approval_status === 'rejected');

    console.log('Status breakdown:');
    console.log(`   Approved: ${approved.length}`);
    console.log(`   Pending: ${pending.length}`);
    console.log(`   Rejected: ${rejected.length}`);

    console.log('\n👥 Prospects:');
    prospects.slice(0, 10).forEach((p, i) => {
      const contact = p.contact || {};
      console.log(`\n${i + 1}. ${contact.firstName || 'N/A'} ${contact.lastName || 'N/A'}`);
      console.log(`   Status: ${p.approval_status}`);
      console.log(`   LinkedIn: ${contact.linkedin_url || contact.linkedinUrl || '❌ MISSING'}`);
      console.log(`   Company: ${contact.company || 'N/A'}`);
      console.log(`   Title: ${contact.title || 'N/A'}`);
    });

    if (approved.length > 0) {
      console.log('\n\n💡 SOLUTION: Transfer approved prospects to campaign');
      console.log('   These approved prospects need to be moved to the campaign.');
      console.log('   The API endpoint should handle this automatically when you');
      console.log('   click "Start Campaign" in the UI, but it seems that step failed.');
    }
  }

  console.log('\n' + '='.repeat(70));
}

checkApprovalSession().catch(console.error);
