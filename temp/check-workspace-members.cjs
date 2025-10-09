require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkMemberships() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  console.log('🔍 Checking workspace_members for workspace:', WORKSPACE_ID);
  console.log('');

  // Query workspace_members without join
  const { data: members, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID);

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  if (!members || members.length === 0) {
    console.log('⚠️  NO WORKSPACE MEMBERS FOUND!');
    console.log('   The restore point deleted workspace memberships.');
    console.log('');
    console.log('📋 Expected members:');
    console.log('   - tl@innovareai.com (Thorsten Linz)');
    console.log('   - cl@innovareai.com (Charissa)');
    console.log('   - mg@innovareai.com (Michelle Gestuveo)');
    console.log('   - im@innovareai.com (Irish Maguad)');
    console.log('   - jh@sendingcell.com (Jim Heim - Sendingcell)');
    return;
  }

  console.log('✅ Workspace Members Found:', members.length);
  console.log('');

  // Get email for each member
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', member.user_id)
      .single();

    console.log(`${i + 1}. ${user?.email || 'Unknown'} - Role: ${member.role}`);
  }
  console.log('');

  // Also check the users table for all InnovareAI team emails
  console.log('🔍 Checking for all InnovareAI team emails in users table...');
  console.log('');
  const emails = [
    'tl@innovareai.com',
    'cl@innovareai.com',
    'mg@innovareai.com',
    'im@innovareai.com'
  ];

  for (const email of emails) {
    const { data: user } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
      .eq('email', email)
      .single();

    if (user) {
      const isMember = members.some(m => m.user_id === user.id);
      console.log(`   ✅ ${email} - User exists, Member: ${isMember ? 'YES' : 'NO'}`);
    } else {
      console.log(`   ❌ ${email} - User NOT FOUND`);
    }
  }
}

checkMemberships().then(() => process.exit(0));
