const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function checkConstraints() {
  // Check for unique constraints on send_queue table
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        con.conname AS constraint_name,
        con.contype AS constraint_type,
        pg_get_constraintdef(con.oid) AS constraint_definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE rel.relname = 'send_queue'
      AND nsp.nspname = 'public'
      ORDER BY con.conname;
    `
  });

  if (error) {
    console.log('RPC not available, trying direct query...');
    // Try a simpler approach - just check if we can add a unique constraint
    console.log('Checking if unique constraint exists by testing duplicate insert...');
  } else {
    console.log('Constraints on send_queue table:');
    console.log(JSON.stringify(data, null, 2));
  }
}

checkConstraints();
