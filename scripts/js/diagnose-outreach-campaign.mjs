#!/usr/bin/env node
/**
 * Diagnose the Outreach Campaign issue
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

async function diagnose() {
  console.log('🔍 DIAGNOSING OUTREACH CAMPAIGN ISSUE\n');
  console.log('='.repeat(70));

  // Find the campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('name', '20251030-IAI-Outreach Campaign')
    .single();

  if (!campaign) {
    console.log('\n❌ Campaign not found');
    return;
  }

  console.log('\n📋 CAMPAIGN INFO');
  console.log('-'.repeat(70));
  console.log(`   Name: ${campaign.name}`);
  console.log(`   ID: ${campaign.id}`);
  console.log(`   Session ID: ${campaign.session_id || 'NONE (this is the problem!)'}`);
  console.log(`   Status: ${campaign.status}`);
  console.log(`   Created: ${new Date(campaign.created_at).toLocaleString()}`);

  // Check prospects
  const { count: prospectCount } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id);

  console.log(`   Prospects: ${prospectCount || 0}`);

  // Find approval sessions
  console.log('\n📊 RECENT APPROVAL SESSIONS');
  console.log('-'.repeat(70));

  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  if (sessions && sessions.length > 0) {
    for (const session of sessions) {
      const { count: approvedCount } = await supabase
        .from('prospect_approval_data')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .eq('approval_status', 'approved');

      const { count: totalCount } = await supabase
        .from('prospect_approval_data')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id);

      console.log(`\n   Session: ${session.campaign_name || 'Unnamed'}`);
      console.log(`   ID: ${session.id}`);
      console.log(`   Created: ${new Date(session.created_at).toLocaleString()}`);
      console.log(`   Total prospects: ${totalCount || 0}`);
      console.log(`   Approved: ${approvedCount || 0}`);
    }
  } else {
    console.log('\n   No approval sessions found');
  }

  console.log('\n' + '='.repeat(70));
  console.log('💡 NEXT STEPS');
  console.log('='.repeat(70));

  if (!campaign.session_id) {
    console.log('\n   The campaign was created WITHOUT a session_id parameter.');
    console.log('   This means the frontend fix has NOT taken effect yet.');
    console.log('\n   Solutions:');
    console.log('   1. Hard refresh the browser (Cmd+Shift+R)');
    console.log('   2. Manually transfer prospects using the session ID from above');
    console.log('   3. Delete this campaign and create a new one after refreshing');
  }

  console.log('\n' + '='.repeat(70));
}

diagnose().catch(console.error);
