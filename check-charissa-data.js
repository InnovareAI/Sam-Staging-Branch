#!/usr/bin/env node

/**
 * Check Charissa's (tl@innovareai.com) prospect approval sessions
 * to diagnose why data isn't showing in Data Approval screen
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCharissaData() {
  console.log('🔍 Checking data for tl@innovareai.com...\n');

  // 1. Get user info
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, current_workspace_id')
    .eq('email', 'tl@innovareai.com')
    .single();

  if (userError || !user) {
    console.error('❌ User not found:', userError?.message);
    return;
  }

  console.log('✅ User found:');
  console.log('   ID:', user.id);
  console.log('   Email:', user.email);
  console.log('   Current Workspace:', user.current_workspace_id || 'NONE');
  console.log('');

  // 2. Check workspace memberships
  const { data: workspaces, error: wsError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name)')
    .eq('user_id', user.id);

  if (wsError) {
    console.error('❌ Workspace query error:', wsError.message);
  } else {
    console.log('📂 Workspaces:');
    workspaces.forEach(ws => {
      console.log(`   - ${ws.workspaces?.name} (${ws.workspace_id}) - ${ws.role}`);
    });
    console.log('');
  }

  // 3. Check recent approval sessions
  const { data: sessions, error: sessError } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_name, workspace_id, total_prospects, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (sessError) {
    console.error('❌ Sessions query error:', sessError.message);
  } else {
    console.log('📋 Recent Approval Sessions:');
    if (sessions.length === 0) {
      console.log('   ⚠️  NO SESSIONS FOUND');
    } else {
      sessions.forEach(s => {
        console.log(`   - ${s.campaign_name}`);
        console.log(`     ID: ${s.id}`);
        console.log(`     Workspace: ${s.workspace_id}`);
        console.log(`     Prospects: ${s.total_prospects}`);
        console.log(`     Status: ${s.status}`);
        console.log(`     Created: ${new Date(s.created_at).toLocaleString()}`);
        console.log('');
      });
    }
  }

  // 4. Check if any sessions exist in her current workspace
  if (user.current_workspace_id) {
    const { data: wsSessions, error: wsSessionError } = await supabase
      .from('prospect_approval_sessions')
      .select('id, campaign_name, user_id, created_at')
      .eq('workspace_id', user.current_workspace_id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (wsSessionError) {
      console.error('❌ Workspace sessions error:', wsSessionError.message);
    } else {
      console.log(`📊 Recent sessions in workspace ${user.current_workspace_id}:`);
      if (wsSessions.length === 0) {
        console.log('   ⚠️  NO SESSIONS IN THIS WORKSPACE');
      } else {
        wsSessions.forEach(s => {
          console.log(`   - ${s.campaign_name} (by user: ${s.user_id})`);
        });
      }
      console.log('');
    }
  }

  // 5. Check SAM conversation threads
  const { data: threads, error: threadError } = await supabase
    .from('sam_conversation_threads')
    .select('id, title, workspace_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (threadError) {
    console.error('❌ Threads query error:', threadError.message);
  } else {
    console.log('💬 Recent SAM Conversations:');
    if (threads.length === 0) {
      console.log('   ⚠️  NO THREADS FOUND');
    } else {
      threads.forEach(t => {
        console.log(`   - ${t.title}`);
        console.log(`     Workspace: ${t.workspace_id}`);
        console.log(`     Created: ${new Date(t.created_at).toLocaleString()}`);
      });
    }
  }
}

checkCharissaData().catch(console.error);
