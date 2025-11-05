import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔧 Applying LinkedIn Reconnection Fix...\n');

// Read the migration file
const migrationSQL = readFileSync('supabase/migrations/20251022_create_atomic_account_association.sql', 'utf8');

console.log('📄 Migration SQL:');
console.log('─'.repeat(80));
console.log(migrationSQL.substring(0, 500) + '...');
console.log('─'.repeat(80));
console.log('');

// Execute the migration
console.log('🚀 Executing migration...\n');

const { data, error } = await supabase.rpc('exec_sql', {
  sql: migrationSQL
}).catch(async (err) => {
  // If exec_sql doesn't exist, try direct query (less safe but works)
  console.log('⚠️  exec_sql function not found, using direct query...');
  return await supabase.from('_dummy').select('*').then(() => {
    // This won't work, but shows we need to use Supabase dashboard
    throw new Error('Direct SQL execution not available via client SDK');
  });
});

if (error) {
  console.error('❌ Migration failed:', error);
  console.log('\n📋 MANUAL FIX REQUIRED:');
  console.log('');
  console.log('1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new');
  console.log('2. Copy and paste the migration SQL from:');
  console.log('   supabase/migrations/20251022_create_atomic_account_association.sql');
  console.log('3. Click "Run"');
  console.log('');
  console.log('OR use the Supabase CLI:');
  console.log('   supabase db push --db-url "postgresql://postgres.latxadqrvrrrcvkktrog:[password]@db.latxadqrvrrrcvkktrog.supabase.co:5432/postgres"');
} else {
  console.log('✅ Migration applied successfully!');
  console.log('   Result:', data);
}

console.log('\n✅ Done!');
