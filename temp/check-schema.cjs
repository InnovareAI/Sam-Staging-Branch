require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkSchema() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log('🔍 Checking schema...');
  console.log('');

  // Get a sample user to see the structure
  console.log('1️⃣ Sample user record:');
  const { data: sampleUser } = await supabase
    .from('users')
    .select('*')
    .limit(1)
    .single();

  if (sampleUser) {
    console.log('   Columns:', Object.keys(sampleUser).join(', '));
    console.log('   Sample:', JSON.stringify(sampleUser, null, 2));
  }
  console.log('');

  // Get a sample workspace_member
  console.log('2️⃣ Sample workspace_members record:');
  const { data: sampleMember } = await supabase
    .from('workspace_members')
    .select('*')
    .limit(1)
    .single();

  if (sampleMember) {
    console.log('   Columns:', Object.keys(sampleMember).join(', '));
    console.log('   Sample:', JSON.stringify(sampleMember, null, 2));
  }
  console.log('');

  // Get a sample workspace_account
  console.log('3️⃣ Sample workspace_accounts record:');
  const { data: sampleAccount } = await supabase
    .from('workspace_accounts')
    .select('*')
    .limit(1)
    .single();

  if (sampleAccount) {
    console.log('   Columns:', Object.keys(sampleAccount).join(', '));
    console.log('   Sample:', JSON.stringify(sampleAccount, null, 2));
  }
}

checkSchema().then(() => process.exit(0));
