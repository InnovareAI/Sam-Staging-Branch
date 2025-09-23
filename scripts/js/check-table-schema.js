import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableSchema() {
  console.log('🔍 Checking user_unipile_accounts table schema...\n');

  // Try to get one record to see the schema
  const { data, error } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error.message);
    
    // Check if table exists
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .ilike('table_name', '%unipile%');
    
    if (tables) {
      console.log('📋 Available tables with "unipile" in name:');
      tables.forEach(table => console.log(`   - ${table.table_name}`));
    }
  } else {
    console.log('✅ Table exists');
    if (data && data.length > 0) {
      console.log('📋 Table columns:', Object.keys(data[0]));
    } else {
      console.log('📋 Table is empty, checking column info...');
      
      // Try to insert a test record to see required fields
      const { error: insertError } = await supabase
        .from('user_unipile_accounts')
        .insert({
          user_id: 'test',
          unipile_account_id: 'test'
        });
      
      if (insertError) {
        console.log('❌ Insert test error:', insertError.message);
        console.log('💡 This reveals required columns');
      }
    }
  }
}

checkTableSchema().catch(console.error);