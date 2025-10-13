#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // InnovareAI

async function checkCampaigns() {
  console.log('=== CAMPAIGNS IN CAMPAIGN HUB ===\n');

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, created_at')
    .eq('workspace_id', WORKSPACE_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!campaigns || campaigns.length === 0) {
    console.log('❌ No campaigns found in Campaign Hub!\n');
  } else {
    campaigns.forEach((c, i) => {
      const age = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 1000 / 60 / 60);
      console.log(`[${i+1}] ${c.name}`);
      console.log(`    Status: ${c.status} | Created: ${age}h ago`);
    });
    console.log(`\nTotal: ${campaigns.length} campaigns\n`);
  }
}

async function checkSessions() {
  console.log('=== APPROVAL SESSIONS (DATA APPROVAL) ===\n');

  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_name, campaign_tag, total_prospects, status, created_at, user_id')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (!sessions || sessions.length === 0) {
    console.log('❌ No approval sessions found!\n');
  } else {
    for (const s of sessions) {
      const age = Math.floor((Date.now() - new Date(s.created_at).getTime()) / 1000 / 60 / 60);

      // Get user email
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const user = users.find(u => u.id === s.user_id);

      console.log(`[${s.id.substring(0, 8)}] ${s.campaign_name || 'Untitled'}`);
      console.log(`    Tag: ${s.campaign_tag || 'none'}`);
      console.log(`    Prospects: ${s.total_prospects} | User: ${user?.email || 'unknown'}`);
      console.log(`    Created: ${age}h ago`);
      console.log('');
    }
    console.log(`Total: ${sessions.length} sessions\n`);
  }
}

async function checkSearchJobs() {
  console.log('=== RECENT SEARCH JOBS ===\n');

  // Get tl@ user ID
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const tlUser = users.find(u => u.email === 'tl@innovareai.com');

  const { data: jobs } = await supabase
    .from('prospect_search_jobs')
    .select('*')
    .eq('user_id', tlUser.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!jobs || jobs.length === 0) {
    console.log('❌ No search jobs found for tl@innovareai.com\n');
  } else {
    jobs.forEach(job => {
      const age = Math.floor((Date.now() - new Date(job.created_at).getTime()) / 1000 / 60);
      console.log(`[${job.id.substring(0, 8)}] Status: ${job.status}`);
      console.log(`    Type: ${job.search_type} | Target: ${job.target_count} | Found: ${job.found_count || 0}`);
      console.log(`    Created: ${age} mins ago`);
      if (job.error_message) console.log(`    Error: ${job.error_message}`);
      console.log('');
    });
  }
}

async function main() {
  await checkCampaigns();
  await checkSessions();
  await checkSearchJobs();
}

main().catch(console.error);
