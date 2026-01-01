import { createClient } from '@supabase/supabase-js';

async function check() {
  console.log('\n🔍 Checking prospect_approval_sessions schema...\n');

  // Try to get any row to see columns
  const { data, error } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
  } else if (data && data.length > 0) {
    console.log('✅ Column names in prospect_approval_sessions:');
    console.log(Object.keys(data[0]).join(', '));
    console.log('\n📊 Sample row:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('⚠️ Table is empty, trying to query schema directly...');

    // Query information_schema
    const { data: schema, error: schemaError } = await supabase
      .rpc('get_table_columns', { table_name: 'prospect_approval_sessions' })
      .select('*');

    if (schemaError) {
      console.error('Schema query error:', schemaError);
    }
  }

  // Also check for count
  const { count } = await supabase
    .from('prospect_approval_sessions')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📈 Total rows in prospect_approval_sessions: ${count}`);
}

check();
