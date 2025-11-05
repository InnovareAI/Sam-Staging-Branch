#!/usr/bin/env node

/**
 * Monitor Enrichment Job in Real-Time
 *
 * Polls the database every 2 seconds to show enrichment progress
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('📊 Monitoring Latest Enrichment Job');
console.log('===================================\n');
console.log('Press Ctrl+C to stop monitoring\n');

let lastStatus = null;
let startTime = Date.now();

async function checkJob() {
  try {
    // Get latest enrichment job
    const { data: jobs, error } = await supabase
      .from('enrichment_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!jobs || jobs.length === 0) {
      console.log('⏳ Waiting for enrichment job to be created...');
      return;
    }

    const job = jobs[0];
    const elapsed = Math.round((Date.now() - new Date(job.created_at).getTime()) / 1000);

    // Only log when status changes or every 5 seconds
    const shouldLog = lastStatus !== job.status || elapsed % 5 === 0;

    if (shouldLog) {
      console.log(`\n[${new Date().toLocaleTimeString()}] Job ${job.id.substring(0, 8)}...`);
      console.log(`Status: ${getStatusEmoji(job.status)} ${job.status.toUpperCase()}`);
      console.log(`Progress: ${job.processed_count}/${job.total_prospects} prospects`);
      console.log(`Failed: ${job.failed_count}`);
      console.log(`Elapsed: ${elapsed}s`);

      if (job.current_prospect_url) {
        console.log(`Current: ${job.current_prospect_url}`);
      }
    }

    lastStatus = job.status;

    // If completed or failed, show final results
    if (job.status === 'completed' || job.status === 'failed') {
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('📋 ENRICHMENT COMPLETE');
      console.log('═══════════════════════════════════════════════════════\n');

      console.log(`Final Status: ${getStatusEmoji(job.status)} ${job.status.toUpperCase()}`);
      console.log(`Total Prospects: ${job.total_prospects}`);
      console.log(`Successfully Processed: ${job.processed_count}`);
      console.log(`Failed: ${job.failed_count}`);
      console.log(`Total Time: ${elapsed}s`);

      if (job.error_message) {
        console.log(`\n❌ Error: ${job.error_message}`);
      }

      if (job.enrichment_results && job.enrichment_results.length > 0) {
        console.log('\n📊 Results:');
        console.log(JSON.stringify(job.enrichment_results, null, 2));
      }

      // Show enriched prospect data
      console.log('\n🔍 Checking enriched prospect data...');

      for (const prospectId of job.prospect_ids) {
        const { data: prospect } = await supabase
          .from('prospect_approval_data')
          .select('prospect_id, name, contact')
          .eq('prospect_id', prospectId)
          .single();

        if (prospect) {
          console.log(`\n${prospect.name} (${prospect.prospect_id}):`);
          console.log(`  LinkedIn: ${prospect.contact?.linkedin_url || '(none)'}`);
          console.log(`  Email: ${prospect.contact?.email || '(none)'}`);
          console.log(`  Phone: ${prospect.contact?.phone || '(none)'}`);
        }
      }

      console.log('\n✅ Monitoring complete!');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Error checking job:', error.message);
  }
}

function getStatusEmoji(status) {
  switch (status) {
    case 'pending': return '⏳';
    case 'processing': return '⚙️';
    case 'completed': return '✅';
    case 'failed': return '❌';
    case 'cancelled': return '🚫';
    default: return '❓';
  }
}

// Check immediately, then every 2 seconds
checkJob();
const interval = setInterval(checkJob, 2000);

// Clean up on exit
process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('\n\n👋 Monitoring stopped');
  process.exit(0);
});
