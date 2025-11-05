import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔍 Checking if function exists in pg_proc...\n');

// Query pg_proc directly to see if function exists
const { data, error } = await supabase
  .from('pg_proc')
  .select('proname, prosrc')
  .eq('proname', 'associate_linkedin_account_atomic')
  .single();

if (error) {
  console.log('❌ Query failed:', error.message);
  console.log('   This might mean the function really does not exist yet.');
} else if (data) {
  console.log('✅ Function EXISTS in database!');
  console.log('   Name:', data.proname);
  console.log('   Source length:', data.prosrc.length, 'characters');
} else {
  console.log('❌ Function NOT FOUND in pg_proc');
}

console.log('\n✅ Check complete!');
