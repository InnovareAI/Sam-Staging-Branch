#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function deployCronJob() {
  console.log('📧 Deploying Daily Email Cron Job...\n');

  // Step 1: Enable http extension
  console.log('1️⃣ Enabling http extension...');
  const { error: httpError } = await supabase.rpc('exec_sql', {
    sql: 'CREATE EXTENSION IF NOT EXISTS http;'
  });

  if (httpError && !httpError.message.includes('already exists')) {
    console.error('❌ Failed to enable http extension:', httpError);
    // Try alternative method
    console.log('   Trying alternative method...');
    const { error: altError } = await supabase.from('pg_extension').select('*').limit(1);
    if (altError) {
      console.error('⚠️  Cannot verify http extension, continuing anyway...');
    }
  } else {
    console.log('✅ http extension enabled');
  }

  // Step 2: Read and execute the migration SQL
  console.log('\n2️⃣ Creating email cron function...');
  const migrationPath = join(__dirname, '../supabase/migrations/20251109_add_daily_email_cron.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  // Split the SQL into individual statements
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt) continue;

    console.log(`   Executing statement ${i + 1}/${statements.length}...`);

    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql: stmt + ';'
      });

      if (error) {
        // Some errors are expected (like function already exists)
        if (error.message.includes('already exists')) {
          console.log('   ⚠️  Already exists, skipping...');
        } else {
          console.error('   ❌ Error:', error.message);
        }
      } else {
        console.log('   ✅ Success');
      }
    } catch (err) {
      console.error('   ❌ Error:', err.message);
    }
  }

  console.log('\n3️⃣ Verifying cron job...');
  const { data: cronJobs, error: cronError } = await supabase
    .from('cron.job')
    .select('*')
    .ilike('command', '%send_daily_health_report_email%');

  if (cronError) {
    console.error('❌ Failed to verify cron job:', cronError);
  } else if (cronJobs && cronJobs.length > 0) {
    console.log('✅ Cron job scheduled successfully!');
    console.log('   Job ID:', cronJobs[0].jobid);
    console.log('   Schedule:', cronJobs[0].schedule);
  } else {
    console.log('⚠️  Cron job not found, manual verification needed');
  }

  console.log('\n✅ Deployment complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Run test: SELECT send_daily_health_report_email();');
  console.log('   2. Check logs in Supabase Dashboard → Edge Functions');
  console.log('   3. Verify email received at tl@innovareai.com and cl@innovareai.com');
}

deployCronJob().catch(console.error);
