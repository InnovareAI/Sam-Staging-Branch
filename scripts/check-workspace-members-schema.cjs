require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  try {
    console.log('🔍 Checking workspace_members table schema...\n');

    // Get a sample record to see all columns
    const { data, error } = await supabase
      .from('workspace_members')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    if (data && data.length > 0) {
      const record = data[0];
      console.log('✅ Table columns:');
      Object.keys(record).forEach(key => {
        console.log(`   - ${key}: ${typeof record[key]} ${record[key] === null ? '(NULL)' : ''}`);
      });

      console.log('\n📊 Sample record:');
      console.log(JSON.stringify(record, null, 2));
    } else {
      console.log('⚠️  No records found in table');
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

checkSchema();
