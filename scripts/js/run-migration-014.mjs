#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🚀 Running migration 014: Add timezone and auto-approval to commenting monitors\n');

  try {
    // Run the ALTER TABLE command
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE linkedin_post_monitors
        ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'America/New_York',
        ADD COLUMN IF NOT EXISTS daily_start_time TIME DEFAULT '09:00:00',
        ADD COLUMN IF NOT EXISTS auto_approve_enabled BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS auto_approve_start_time TIME DEFAULT '09:00:00',
        ADD COLUMN IF NOT EXISTS auto_approve_end_time TIME DEFAULT '17:00:00';
      `
    });

    if (alterError) {
      // Supabase doesn't have exec_sql RPC by default, so we'll use the REST API directly
      console.log('⚠️  Cannot run migration via RPC, using direct SQL query...\n');

      // Alternative: Just show the SQL to run manually
      console.log('📋 Please run this SQL in Supabase SQL Editor:\n');
      console.log('─'.repeat(80));
      const migrationSQL = readFileSync('sql/migrations/014-add-timezone-to-commenting-monitors.sql', 'utf8');
      console.log(migrationSQL);
      console.log('─'.repeat(80));
      console.log('\n✅ Copy the SQL above and run it in Supabase SQL Editor');
      console.log('   URL: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new\n');
      return;
    }

    console.log('✅ Migration completed successfully!\n');

    // Verify the columns were added
    const { data, error } = await supabase
      .from('linkedin_post_monitors')
      .select('timezone, daily_start_time, auto_approve_enabled, auto_approve_start_time, auto_approve_end_time')
      .limit(1);

    if (error) {
      console.error('⚠️  Verification failed:', error.message);
      console.log('\nPlease verify manually that the columns exist.');
    } else {
      console.log('✅ Verified: New columns are accessible via Supabase API\n');
      console.log('   Columns added:');
      console.log('   - timezone');
      console.log('   - daily_start_time');
      console.log('   - auto_approve_enabled');
      console.log('   - auto_approve_start_time');
      console.log('   - auto_approve_end_time');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

runMigration();
