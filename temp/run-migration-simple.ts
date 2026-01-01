import { createClient } from '@supabase/supabase-js';

async function runMigration() {
  console.log('\n📦 Adding campaign fields to prospect_approval_sessions...\n');

  // We'll use the Supabase SQL through the API
  // Note: This requires manual execution in Supabase SQL Editor if RPC fails

  const sql = `
    ALTER TABLE prospect_approval_sessions
    ADD COLUMN IF NOT EXISTS campaign_name TEXT,
    ADD COLUMN IF NOT EXISTS campaign_tag TEXT;

    CREATE INDEX IF NOT EXISTS idx_prospect_approval_sessions_campaign_name
      ON prospect_approval_sessions(campaign_name);

    CREATE INDEX IF NOT EXISTS idx_prospect_approval_sessions_campaign_tag
      ON prospect_approval_sessions(campaign_tag);
  `;

  console.log('SQL to execute:');
  console.log(sql);
  console.log('\n📋 Please copy the above SQL and run it in Supabase SQL Editor:');
  console.log('   https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new\n');
}

runMigration();
