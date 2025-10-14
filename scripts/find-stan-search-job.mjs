import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STAN_USER_ID = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';
const BLUE_LABEL_WORKSPACE_ID = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

async function findSearchJob() {
  console.log('🔍 Searching for Stan\'s LinkedIn Search Jobs...\n');

  // Check prospect_search_jobs table
  const { data: jobs, error } = await supabase
    .from('prospect_search_jobs')
    .select('*')
    .eq('workspace_id', BLUE_LABEL_WORKSPACE_ID)
    .order('created_at', { ascending: false });

  console.log(`📊 Found ${jobs?.length || 0} search jobs for Blue Label Labs\n`);

  if (!jobs || jobs.length === 0) {
    console.log('❌ No search jobs found.');
    console.log('');
    console.log('This means the search never created a job record.');
    console.log('The 49 prospects number might have been a:');
    console.log('   - Manual CSV upload');
    console.log('   - Copy/paste data');
    console.log('   - LinkedIn URL import');
    console.log('');
    return;
  }

  console.log('✅ Search Jobs Found:\n');

  jobs.forEach((job, index) => {
    console.log(`━━━ Job ${index + 1} ━━━`);
    console.log(`   ID: ${job.id}`);
    console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
    console.log(`   Search Type: ${job.search_type || 'Unknown'}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Target Count: ${job.target_count || 0}`);
    console.log(`   Found Count: ${job.found_count || 0}`);

    if (job.search_criteria) {
      console.log(`   Search Criteria:`);
      console.log(JSON.stringify(job.search_criteria, null, 4));
    }

    if (job.error_message) {
      console.log(`   ❌ Error: ${job.error_message}`);
    }

    console.log('');
  });

  // Look for jobs created around October 10-11
  console.log('🔍 Looking for jobs around October 10-11, 2025...\n');

  const targetDate = new Date('2025-10-10');
  const recentJobs = jobs.filter(job => {
    const jobDate = new Date(job.created_at);
    const diffDays = Math.abs((jobDate - targetDate) / (1000 * 60 * 60 * 24));
    return diffDays <= 2; // Within 2 days
  });

  if (recentJobs.length > 0) {
    console.log(`✅ Found ${recentJobs.length} job(s) around that date:`);
    recentJobs.forEach(job => {
      console.log(`   - ${job.id} (${job.status}) - ${new Date(job.created_at).toLocaleString()}`);
      if (job.search_criteria) {
        console.log(`     Criteria: ${JSON.stringify(job.search_criteria)}`);
      }
    });
  } else {
    console.log('❌ No jobs found around October 10-11');
  }
}

findSearchJob();
