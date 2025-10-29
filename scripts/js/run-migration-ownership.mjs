#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🔄 Running prospect ownership migration...\n');

  const sql = readFileSync('./supabase/migrations/20251029_add_prospect_ownership.sql', 'utf8');

  try {
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

    if (error) {
      console.error('❌ Migration failed:', error);

      // Try executing statements one by one
      console.log('\n⚠️ Attempting to execute statements individually...\n');

      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('DO $$'));

      for (const stmt of statements) {
        console.log('Executing:', stmt.substring(0, 60) + '...');
        const { error: stmtError } = await supabase.rpc('exec_sql', { sql_string: stmt });
        if (stmtError) {
          console.error('  ❌ Failed:', stmtError.message);
        } else {
          console.log('  ✅ Success');
        }
      }
    } else {
      console.log('✅ Migration executed successfully!\n');
    }

    // Verify the migration
    console.log('📊 Verification:\n');

    const { data: wpCount } = await supabase
      .from('workspace_prospects')
      .select('added_by', { count: 'exact', head: true })
      .not('added_by', 'is', null);

    const { data: cpCount } = await supabase
      .from('campaign_prospects')
      .select('added_by', { count: 'exact', head: true })
      .not('added_by', 'is', null);

    console.log('workspace_prospects with added_by:', wpCount?.length || 0);
    console.log('campaign_prospects with added_by:', cpCount?.length || 0);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

runMigration().catch(console.error);
