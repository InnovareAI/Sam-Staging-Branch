#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://latxadqrvrrrcvkktrog.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateErrors() {
  console.log('=== INVESTIGATING SEND QUEUE ERRORS ===\n');

  // Query 1: Recent failed sends with "fetch failed"
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: fetchFailedErrors, error: error1 } = await supabase
    .from('send_queue')
    .select('*')
    .eq('status', 'failed')
    .ilike('error_message', '%fetch failed%')
    .gte('updated_at', fifteenMinutesAgo)
    .order('updated_at', { ascending: false })
    .limit(50);

  console.log('1. FETCH FAILED ERRORS (Last 15 minutes):');
  console.log(`   Count: ${fetchFailedErrors?.length || 0}`);
  if (fetchFailedErrors && fetchFailedErrors.length > 0) {
    console.log('   Sample errors:');
    fetchFailedErrors.slice(0, 5).forEach((item, i) => {
      console.log(`   ${i + 1}. ID: ${item.id}`);
      console.log(`      Campaign: ${item.campaign_id}`);
      console.log(`      Prospect: ${item.campaign_prospect_id}`);
      console.log(`      LinkedIn User ID: ${item.linkedin_user_id}`);
      console.log(`      Error: ${item.error_message}`);
      console.log(`      Updated: ${item.updated_at}`);
      console.log(`      Attempt: ${item.attempt_count}/${item.max_retries || 3}`);
      console.log('');
    });
  }

  // Query 2: LinkedIn profile errors
  const { data: profileErrors, error: error2 } = await supabase
    .from('send_queue')
    .select('*')
    .eq('status', 'failed')
    .ilike('error_message', '%LinkedIn profile not found or locked%')
    .gte('updated_at', fifteenMinutesAgo)
    .order('updated_at', { ascending: false })
    .limit(50);

  console.log('2. LINKEDIN PROFILE NOT FOUND ERRORS (Last 15 minutes):');
  console.log(`   Count: ${profileErrors?.length || 0}`);
  if (profileErrors && profileErrors.length > 0) {
    console.log('   Sample errors:');
    profileErrors.slice(0, 5).forEach((item, i) => {
      console.log(`   ${i + 1}. ID: ${item.id}`);
      console.log(`      Campaign: ${item.campaign_id}`);
      console.log(`      Prospect: ${item.campaign_prospect_id}`);
      console.log(`      LinkedIn User ID: ${item.linkedin_user_id}`);
      console.log(`      Error: ${item.error_message}`);
      console.log(`      Updated: ${item.updated_at}`);
      console.log('');
    });
  }

  // Query 3: All failed in last 15 minutes grouped by error
  const { data: allFailed, error: error3 } = await supabase
    .from('send_queue')
    .select('error_message, status, updated_at')
    .eq('status', 'failed')
    .gte('updated_at', fifteenMinutesAgo)
    .order('updated_at', { ascending: false });

  console.log('3. ALL FAILED SENDS (Last 15 minutes):');
  console.log(`   Total count: ${allFailed?.length || 0}`);

  if (allFailed && allFailed.length > 0) {
    // Group by error message
    const errorGroups = {};
    allFailed.forEach(item => {
      const errorKey = item.error_message || 'Unknown error';
      errorGroups[errorKey] = (errorGroups[errorKey] || 0) + 1;
    });

    console.log('   Error breakdown:');
    Object.entries(errorGroups)
      .sort((a, b) => b[1] - a[1])
      .forEach(([error, count]) => {
        console.log(`   - ${count}x: ${error.substring(0, 100)}${error.length > 100 ? '...' : ''}`);
      });
  }

  // Query 4: Check for any stuck in processing
  const { data: stuckItems, error: error4 } = await supabase
    .from('send_queue')
    .select('*')
    .eq('status', 'processing')
    .lt('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .limit(10);

  console.log('\n4. STUCK IN PROCESSING (>5 minutes):');
  console.log(`   Count: ${stuckItems?.length || 0}`);
  if (stuckItems && stuckItems.length > 0) {
    stuckItems.forEach((item, i) => {
      console.log(`   ${i + 1}. ID: ${item.id}, Updated: ${item.updated_at}`);
    });
  }

  // Query 5: Check specific campaign IDs to see if it's campaign-specific
  if (fetchFailedErrors && fetchFailedErrors.length > 0) {
    const campaignIds = [...new Set(fetchFailedErrors.map(e => e.campaign_id))];
    console.log('\n5. AFFECTED CAMPAIGNS (fetch failed):');
    console.log(`   Unique campaign IDs: ${campaignIds.length}`);
    console.log(`   Campaign IDs: ${campaignIds.join(', ')}`);
  }

  // Query 6: Look at the linkedin_user_id patterns in failed items
  console.log('\n6. LINKEDIN USER ID ANALYSIS:');
  if (fetchFailedErrors && fetchFailedErrors.length > 0) {
    console.log('   "fetch failed" errors:');
    const idsWithFetchFailed = fetchFailedErrors.map(e => e.linkedin_user_id).filter(Boolean);
    console.log(`   Sample IDs (first 10):`);
    idsWithFetchFailed.slice(0, 10).forEach(id => {
      console.log(`   - ${id} (format: ${id.startsWith('ACo') ? 'provider_id' : id.startsWith('ACw') ? 'provider_id' : id.includes('/') ? 'URL' : 'vanity'})`);
    });
  }

  if (profileErrors && profileErrors.length > 0) {
    console.log('\n   "profile not found" errors:');
    const idsWithProfileError = profileErrors.map(e => e.linkedin_user_id).filter(Boolean);
    console.log(`   Sample IDs (first 10):`);
    idsWithProfileError.slice(0, 10).forEach(id => {
      console.log(`   - ${id} (format: ${id.startsWith('ACo') ? 'provider_id' : id.startsWith('ACw') ? 'provider_id' : id.includes('/') ? 'URL' : 'vanity'})`);
    });
  }
}

investigateErrors().catch(console.error);
