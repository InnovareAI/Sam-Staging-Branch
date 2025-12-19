import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔍 Checking database constraints and indexes on send_queue\n');

// Try to query the information schema
const query = `
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name 
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'send_queue' 
  AND tc.table_schema = 'public'
  AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY tc.constraint_name, kcu.ordinal_position;
`;

const { data: constraints, error } = await supabase.rpc('exec_sql', {
  sql: query
});

if (error) {
  console.log('Direct query failed, checking indexes another way...\n');
  
  // Alternative: check pg_indexes
  const { data: indexes } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'send_queue'
      ORDER BY indexname;
    `
  });
  
  if (indexes) {
    console.log('Indexes on send_queue:');
    console.log(JSON.stringify(indexes, null, 2));
  }
} else {
  console.log('Constraints on send_queue:');
  console.log(JSON.stringify(constraints, null, 2));
}

console.log('\n✅ Done');
