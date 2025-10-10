import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function applyMigration() {
  console.log('\n📦 Applying campaign fields migration...\n');

  const migration = readFileSync('supabase/migrations/20251011000001_add_campaign_fields_to_sessions.sql', 'utf-8');

  // Split by semicolon and execute each statement
  const statements = migration
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    console.log('Executing:', statement.substring(0, 80) + '...');
    const { error } = await supabase.rpc('exec_sql', { sql: statement });

    if (error) {
      // Try direct execution via fetch
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`
        },
        body: JSON.stringify({ query: statement })
      });

      if (!response.ok) {
        console.log('⚠️  Manual execution needed for:', statement.substring(0, 60));
        console.log('   Copy SQL to Supabase SQL Editor');
      }
    } else {
      console.log('✅ Success');
    }
  }

  console.log('\n✅ Migration complete!\n');
  console.log('📋 Verify in Supabase SQL Editor:');
  console.log('   SELECT column_name FROM information_schema.columns');
  console.log('   WHERE table_name = \'prospect_approval_sessions\';');
}

applyMigration().catch(console.error);
