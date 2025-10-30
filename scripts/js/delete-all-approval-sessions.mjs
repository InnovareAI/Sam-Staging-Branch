#!/usr/bin/env node
/**
 * Delete ALL approval sessions (campaign drafts)
 * This will clean up all the "Saved" campaign drafts in the UI
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

const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // InnovareAI Workspace

async function deleteAllApprovalSessions() {
  console.log('🗑️  DELETING ALL APPROVAL SESSIONS (Campaign Drafts)\n');
  console.log('=' .repeat(70));

  // Get all approval sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .order('created_at', { ascending: false });

  if (sessionsError) {
    console.error('❌ Error fetching sessions:', sessionsError);
    return;
  }

  console.log(`\n📊 Found ${sessions.length} approval sessions to delete\n`);

  let deletedSessions = 0;
  let deletedProspects = 0;

  for (const session of sessions) {
    console.log(`\n🗑️  Deleting: ${session.campaign_name || 'Unnamed Session'}`);
    console.log(`   Session ID: ${session.id}`);
    console.log(`   Created: ${new Date(session.created_at).toLocaleDateString()}`);
    console.log(`   Status: ${session.status}`);

    // First, delete all prospects in this session from prospect_approval_data
    const { data: prospects, error: prospectsError } = await supabase
      .from('prospect_approval_data')
      .delete()
      .eq('session_id', session.id)
      .select();

    if (prospectsError) {
      console.error(`   ❌ Error deleting prospects: ${prospectsError.message}`);
      continue;
    }

    const prospectCount = prospects?.length || 0;
    deletedProspects += prospectCount;
    console.log(`   ✅ Deleted ${prospectCount} prospects`);

    // Then delete the session
    const { error: sessionError } = await supabase
      .from('prospect_approval_sessions')
      .delete()
      .eq('id', session.id);

    if (sessionError) {
      console.error(`   ❌ Error deleting session: ${sessionError.message}`);
      continue;
    }

    console.log(`   ✅ Session deleted`);
    deletedSessions++;
  }

  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('✅ CLEANUP COMPLETE');
  console.log('='.repeat(70));
  console.log(`\n   Approval sessions deleted: ${deletedSessions} / ${sessions.length}`);
  console.log(`   Prospects deleted: ${deletedProspects}`);
  console.log('\n   🎉 All campaign drafts have been removed!');
  console.log('\n' + '='.repeat(70));
}

deleteAllApprovalSessions().catch(console.error);
