#!/usr/bin/env node
/**
 * Diagnose the complete prospect flow from search to approval
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

async function diagnoseFlow() {
  console.log('🔍 DIAGNOSING PROSPECT FLOW FROM SEARCH TO APPROVAL\n');
  console.log('='.repeat(70));
  
  // Step 1: Check recent search jobs
  console.log('\n📋 STEP 1: Recent LinkedIn Search Jobs');
  console.log('-'.repeat(70));
  
  const { data: jobs } = await supabase
    .from('prospect_search_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log(`Found ${jobs?.length || 0} recent search jobs\n`);
  
  if (jobs && jobs.length > 0) {
    jobs.forEach((job, i) => {
      console.log(`${i + 1}. Job ID: ${job.id}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Total results: ${job.total_results || 0}`);
      console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
    });
    
    // Check results for the most recent job
    const latestJob = jobs[0];
    const { data: results } = await supabase
      .from('prospect_search_results')
      .select('*')
      .eq('job_id', latestJob.id)
      .limit(3);
    
    console.log(`\n📊 Sample results from latest job (${latestJob.id}):`);
    console.log(`   Total results stored: ${results?.length || 0}`);
    
    if (results && results.length > 0) {
      results.slice(0, 1).forEach((r, i) => {
        console.log(`\n   Result ${i + 1}:`);
        console.log(`      Name: ${r.prospect_data?.name || 'N/A'}`);
        console.log(`      LinkedIn: ${r.prospect_data?.linkedinUrl || 'N/A'}`);
        console.log(`      Title: ${r.prospect_data?.title || 'N/A'}`);
      });
    }
  }
  
  // Step 2: Check prospect approval sessions
  console.log('\n\n📋 STEP 2: Prospect Approval Sessions');
  console.log('-'.repeat(70));
  
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log(`Found ${sessions?.length || 0} approval sessions\n`);
  
  if (sessions && sessions.length > 0) {
    for (const session of sessions) {
      console.log(`Session: ${session.campaign_name}`);
      console.log(`   ID: ${session.id}`);
      console.log(`   Status: ${session.session_status}`);
      console.log(`   Total prospects: ${session.total_prospects}`);
      console.log(`   Created: ${new Date(session.created_at).toLocaleString()}`);
      
      // Check approval data for this session
      const { data: approvalData } = await supabase
        .from('prospect_approval_data')
        .select('*')
        .eq('session_id', session.id);
      
      console.log(`   Approval data records: ${approvalData?.length || 0}`);
      
      if (approvalData && approvalData.length > 0) {
        const approved = approvalData.filter(d => d.approval_status === 'approved').length;
        console.log(`      Approved: ${approved}`);
        console.log(`      Pending: ${approvalData.filter(d => d.approval_status === 'pending').length}`);
      }
      console.log('');
    }
  }
  
  // Step 3: Check if there's a link between search jobs and approval sessions
  console.log('\n📋 STEP 3: Connection Between Search and Approval');
  console.log('-'.repeat(70));
  
  console.log('\nChecking if LinkedIn search results are saved to approval sessions...');
  
  if (jobs && jobs.length > 0 && sessions && sessions.length > 0) {
    const latestJob = jobs[0];
    const latestSession = sessions[0];
    
    console.log(`\nLatest search job: ${latestJob.id}`);
    console.log(`   Created: ${new Date(latestJob.created_at).toLocaleString()}`);
    console.log(`   Results: ${latestJob.total_results}`);
    
    console.log(`\nLatest approval session: ${latestSession.campaign_name}`);
    console.log(`   ID: ${latestSession.id}`);
    console.log(`   Created: ${new Date(latestSession.created_at).toLocaleString()}`);
    console.log(`   Total prospects: ${latestSession.total_prospects}`);
    
    // Check prospect_approval_data for prospect_source or other linking fields
    const { data: approvalData } = await supabase
      .from('prospect_approval_data')
      .select('source, prospect_id, contact')
      .eq('session_id', latestSession.id)
      .limit(3);
    
    if (approvalData && approvalData.length > 0) {
      console.log(`\nSample approval data records:`);
      approvalData.forEach((d, i) => {
        console.log(`   ${i + 1}. Source: ${d.source}`);
        console.log(`      Prospect ID: ${d.prospect_id}`);
        console.log(`      Has LinkedIn URL: ${d.contact?.linkedin_url ? 'Yes' : 'No'}`);
      });
    } else {
      console.log(`\n⚠️  NO APPROVAL DATA found for latest session!`);
      console.log(`   This means prospects from search aren't being saved to approval data.`);
    }
  }
  
  // Step 4: Identify the problem
  console.log('\n\n' + '='.repeat(70));
  console.log('🔴 PROBLEM IDENTIFIED');
  console.log('='.repeat(70));
  
  if (jobs && jobs.length > 0) {
    const latestJob = jobs[0];
    const { count: searchResults } = await supabase
      .from('prospect_search_results')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', latestJob.id);
    
    console.log(`\n✅ LinkedIn search is working:`);
    console.log(`   ${searchResults} prospects found in search results table`);
  }
  
  if (sessions && sessions.length > 0) {
    const latestSession = sessions[0];
    const { count: approvalData } = await supabase
      .from('prospect_approval_data')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', latestSession.id);
    
    if (approvalData === 0) {
      console.log(`\n❌ MISSING STEP: Search results → Approval data`);
      console.log(`   - Approval session exists: "${latestSession.campaign_name}"`);
      console.log(`   - But has 0 prospects in prospect_approval_data table`);
      console.log(`   - Frontend probably calls /api/prospect-approval/upload-prospects`);
      console.log(`   - Check if this endpoint is being called after search completes`);
    } else {
      console.log(`\n✅ Approval data exists:`);
      console.log(`   ${approvalData} prospects in approval data table`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
}

diagnoseFlow().catch(console.error);
