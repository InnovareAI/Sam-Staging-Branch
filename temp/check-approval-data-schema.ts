import { createClient } from '@supabase/supabase-js';

async function check() {
  console.log('\n🔍 Checking prospect_approval_data schema...\n');

  const { data, error } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
  } else if (data && data.length > 0) {
    console.log('✅ Columns:', Object.keys(data[0]).join(', '));
    console.log('\n📊 Sample row:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('⚠️  Table is empty');
  }
}

check();
