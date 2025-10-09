require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkAuthUsers() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log('🔍 Checking auth.users vs public.users');
  console.log('='.repeat(60));
  console.log('');

  // Check if Jennifer exists in auth.users
  console.log('1️⃣ Checking Jennifer Fleming...');
  const { data: jfPublic } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', 'jf@innovareai.com')
    .single();

  console.log('   public.users:', jfPublic ? '✅ EXISTS' : '❌ NOT FOUND');
  if (jfPublic) {
    console.log('      ID:', jfPublic.id);
  }

  // Try to use auth admin API to check auth.users
  const { data: jfAuth, error: jfAuthError } = await supabase.auth.admin.listUsers();

  const jfAuthUser = jfAuth?.users?.find(u => u.email === 'jf@innovareai.com');
  console.log('   auth.users:', jfAuthUser ? '✅ EXISTS' : '❌ NOT FOUND');
  if (jfAuthUser) {
    console.log('      ID:', jfAuthUser.id);
  }
  console.log('');

  // Check if Irish exists
  console.log('2️⃣ Checking Irish Maguad...');
  const { data: imPublic } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', 'im@innovareai.com')
    .single();

  console.log('   public.users:', imPublic ? '✅ EXISTS' : '❌ NOT FOUND');
  if (imPublic) {
    console.log('      ID:', imPublic.id);
  }

  const imAuthUser = jfAuth?.users?.find(u => u.email === 'im@innovareai.com');
  console.log('   auth.users:', imAuthUser ? '✅ EXISTS' : '❌ NOT FOUND');
  if (imAuthUser) {
    console.log('      ID:', imAuthUser.id);
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('💡 SOLUTION:');
  console.log('');
  console.log('The workspace_accounts table has a foreign key constraint');
  console.log('that references auth.users, not public.users.');
  console.log('');
  console.log('To fix this, we need to:');
  console.log('1. Create auth accounts using Supabase Auth Admin API');
  console.log('2. Then link those auth users to public.users');
  console.log('3. Then associate with workspace_accounts');
  console.log('');
}

checkAuthUsers().then(() => process.exit(0));
