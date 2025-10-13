#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function diagnose() {
  console.log('=== LINKEDIN SEARCH PIPELINE DIAGNOSIS ===\n');

  // Check search jobs
  const { data: jobs, count: jobCount } = await supabase
    .from('prospect_search_jobs')
    .select('id, status, search_type, created_at, target_count, found_count, error_message', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`📊 SEARCH JOBS: ${jobCount} total\n`);

  if (jobs && jobs.length > 0) {
    for (const job of jobs) {
      const age = Math.floor((Date.now() - new Date(job.created_at).getTime()) / 1000 / 60 / 60);
      console.log(`[${job.id.substring(0, 8)}] ${job.status}`);
      console.log(`   Created: ${age}h ago | Target: ${job.target_count || 'N/A'} | Found: ${job.found_count || 0}`);
      if (job.error_message) console.log(`   Error: ${job.error_message}`);
      console.log('');
    }
  }

  // Check search results
  const { count: resultsCount } = await supabase
    .from('prospect_search_results')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📦 SEARCH RESULTS: ${resultsCount || 0} total prospects in database\n`);

  if (resultsCount && resultsCount > 0) {
    // Get results by job
    const { data: resultsByJob } = await supabase
      .from('prospect_search_results')
      .select('job_id')
      .order('created_at', { ascending: false })
      .limit(1000);

    const jobCounts = {};
    resultsByJob?.forEach(r => {
      jobCounts[r.job_id] = (jobCounts[r.job_id] || 0) + 1;
    });

    console.log('Results by job:');
    Object.entries(jobCounts).forEach(([jobId, count]) => {
      console.log(`   ${jobId.substring(0, 8)}: ${count} prospects`);
    });
  } else {
    console.log('❌ No search results found! Search jobs are not fetching data.\n');
  }

  // Check approval sessions
  const { count: sessionCount } = await supabase
    .from('prospect_approval_sessions')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📋 APPROVAL SESSIONS: ${sessionCount || 0} total`);

  // Check approval data
  const { count: approvalDataCount } = await supabase
    .from('prospect_approval_data')
    .select('*', { count: 'exact', head: true });

  console.log(`📥 APPROVAL DATA: ${approvalDataCount || 0} prospects\n`);

  if (approvalDataCount === 0 && sessionCount > 0) {
    console.log('⚠️  MISMATCH: Sessions exist but NO prospect data!');
    console.log('⚠️  The bridge between search_results → approval_data is missing!\n');
  }

  // Check if there's a bridge function or API
  console.log('=== DIAGNOSIS ===\n');
  console.log('System A (Search): prospect_search_jobs → prospect_search_results');
  console.log(`   Jobs: ${jobCount}`);
  console.log(`   Results: ${resultsCount || 0}`);
  console.log('');
  console.log('System B (Approval): prospect_approval_sessions → prospect_approval_data');
  console.log(`   Sessions: ${sessionCount}`);
  console.log(`   Data: ${approvalDataCount || 0}`);
  console.log('');

  if (resultsCount > 0 && approvalDataCount === 0) {
    console.log('✅ Solution: Need to transfer prospect_search_results → prospect_approval_data');
  } else if (resultsCount === 0) {
    console.log('❌ Problem: Search jobs are not running! Check Netlify function deployment.');
  }
}

diagnose().catch(console.error);
