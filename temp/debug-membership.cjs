require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function debugMembership() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
  const USER_ID = 'f6885ff3-deef-4781-8721-93011c990b1b';

  console.log('🔍 Debugging workspace membership...');
  console.log('   Workspace ID:', WORKSPACE_ID);
  console.log('   User ID:', USER_ID);
  console.log('');

  // Try with single()
  console.log('1️⃣ Trying with .single():');
  const { data: single, error: singleError } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', USER_ID)
    .single();

  if (singleError) {
    console.log('   ❌ Error:', singleError.message);
    console.log('   Code:', singleError.code);
  } else {
    console.log('   ✅ Found:', single);
  }
  console.log('');

  // Try without single()
  console.log('2️⃣ Trying without .single():');
  const { data: multiple, error: multipleError } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', USER_ID);

  if (multipleError) {
    console.log('   ❌ Error:', multipleError.message);
  } else {
    console.log('   ✅ Found', multiple?.length || 0, 'record(s)');
    if (multiple && multiple.length > 0) {
      multiple.forEach((m, i) => {
        console.log(`   ${i + 1}.`, m);
      });
    }
  }
  console.log('');

  // Check ALL workspace members
  console.log('3️⃣ All workspace members:');
  const { data: all } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', WORKSPACE_ID);

  console.log('   Total members:', all?.length || 0);
  if (all) {
    all.forEach((m, i) => {
      const isTargetUser = m.user_id === USER_ID;
      console.log(`   ${i + 1}. ${m.user_id} (${m.role})${isTargetUser ? ' <-- THIS IS TL' : ''}`);
    });
  }
}

debugMembership().then(() => process.exit(0));
