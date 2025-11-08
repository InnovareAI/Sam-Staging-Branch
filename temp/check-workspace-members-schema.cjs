require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('🔍 Checking workspace_members table schema...\n');

  // Try to get a sample row to see the structure
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error querying workspace_members:', error.message);
  }

  console.log('Sample data (if any):', data);

  // Try inserting with minimal fields
  console.log('\n🧪 Testing insert with minimal fields...\n');

  const testInsert = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: 'babdcab8-1a78-4b2f-913e-6e9fd9821009',
      user_id: 'f6885ff3-deef-4781-8721-93011c990b1b',
      role: 'admin'
    })
    .select();

  if (testInsert.error) {
    console.log('❌ Error:', testInsert.error.message);
    console.log('Details:', testInsert.error);
  } else {
    console.log('✅ Success! Row created:', testInsert.data);
  }
}

checkSchema().catch(console.error);
