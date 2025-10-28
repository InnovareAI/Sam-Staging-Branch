#!/usr/bin/env node
/**
 * Delete prospect approval data for a specific user only
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteMyProspectData() {
  const userEmail = process.argv[2];

  if (!userEmail) {
    console.error('❌ Please provide your email address:');
    console.error('   node delete-my-prospect-data.mjs your@email.com');
    process.exit(1);
  }

  console.log(`🔍 Finding prospect data for: ${userEmail}\n`);

  // Get all approval sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('prospect_approval_sessions')
    .select('*');

  if (sessionsError) {
    console.error('❌ Error fetching sessions:', sessionsError);
    process.exit(1);
  }

  // Get all users
  const { data: users } = await supabase
    .from('users')
    .select('id, email');

  const userMap = {};
  users?.forEach(u => {
    userMap[u.id] = u.email;
  });

  console.log('📊 All Prospect Approval Sessions by User:\n');

  const sessionsByUser = {};
  sessions?.forEach(s => {
    const email = userMap[s.user_id] || 'unknown';
    if (!sessionsByUser[email]) {
      sessionsByUser[email] = {
        sessions: [],
        sessionIds: []
      };
    }
    sessionsByUser[email].sessions.push({
      id: s.id,
      campaign_name: s.campaign_name
    });
    sessionsByUser[email].sessionIds.push(s.id);
  });

  // Show all users and their prospect counts
  for (const [email, data] of Object.entries(sessionsByUser)) {
    const { count } = await supabase
      .from('prospect_approval_data')
      .select('*', { count: 'exact', head: true })
      .in('session_id', data.sessionIds);

    console.log(`   ${email}:`);
    console.log(`      Sessions: ${data.sessions.length}`);
    console.log(`      Prospects: ${count || 0}`);
    if (email === userEmail) {
      console.log(`      👉 THIS IS YOU`);
    }
    console.log();
  }

  // Find user's sessions
  const userSessions = sessionsByUser[userEmail];

  if (!userSessions || userSessions.sessionIds.length === 0) {
    console.log(`✅ No prospect data found for ${userEmail}`);
    console.log('   Nothing to delete!');
    return;
  }

  console.log(`\n🗑️  Will delete prospect data from your ${userSessions.sessions.length} sessions:\n`);
  userSessions.sessions.forEach((s, idx) => {
    console.log(`   ${idx + 1}. ${s.campaign_name || 'Unnamed'} (${s.id})`);
  });
  console.log();

  // Get count before deletion
  const { count: beforeCount } = await supabase
    .from('prospect_approval_data')
    .select('*', { count: 'exact', head: true })
    .in('session_id', userSessions.sessionIds);

  console.log(`📊 Total prospects to delete: ${beforeCount || 0}\n`);

  // Delete prospect_approval_data for user's sessions
  console.log('🗑️  Deleting prospect approval data...');
  const { error: deleteError } = await supabase
    .from('prospect_approval_data')
    .delete()
    .in('session_id', userSessions.sessionIds);

  if (deleteError) {
    console.error('❌ Error deleting prospect data:', deleteError);
    process.exit(1);
  }

  console.log(`✅ Deleted ${beforeCount || 0} prospects\n`);

  // Now delete the sessions themselves
  console.log('🗑️  Deleting approval sessions...');
  const { error: sessionDeleteError } = await supabase
    .from('prospect_approval_sessions')
    .delete()
    .in('id', userSessions.sessionIds);

  if (sessionDeleteError) {
    console.error('❌ Error deleting sessions:', sessionDeleteError);
    process.exit(1);
  }

  console.log(`✅ Deleted ${userSessions.sessions.length} sessions\n`);

  // Verify final counts
  const { count: remainingProspects } = await supabase
    .from('prospect_approval_data')
    .select('*', { count: 'exact', head: true });

  const { count: remainingSessions } = await supabase
    .from('prospect_approval_sessions')
    .select('*', { count: 'exact', head: true });

  console.log('✅ CLEANUP COMPLETE!\n');
  console.log('📊 Remaining in Database:');
  console.log(`   Approval Sessions: ${remainingSessions || 0}`);
  console.log(`   Prospect Approval Data: ${remainingProspects || 0}`);
  console.log('\n🎉 Your prospect data has been removed!\n');
}

deleteMyProspectData();
