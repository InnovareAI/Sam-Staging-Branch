// Script to set a simple password for tl@innovareai.com
import { createClient } from '@supabase/supabase-js';

async function setSimplePassword() {
  try {
    console.log('🔧 Setting simple password for tl@innovareai.com...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the user
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error listing auth users:', authError);
      return;
    }

    const authUser = authUsers.users.find(user => user.email === 'tl@innovareai.com');
    
    if (!authUser) {
      console.error('❌ No user found for tl@innovareai.com');
      return;
    }

    console.log(`✅ Found user: ${authUser.email} (${authUser.id})`);

    // Set a simple password: "password123"
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      authUser.id,
      { password: 'password123' }
    );

    if (updateError) {
      console.error('❌ Error updating password:', updateError);
      return;
    }

    console.log('✅ Password updated successfully!');
    console.log('\n📋 Your direct sign-in credentials:');
    console.log('📧 Email: tl@innovareai.com');
    console.log('🔑 Password: password123');
    console.log('\n🔗 Sign in directly at:');
    console.log('   https://sam.innovareai.com/api/auth/signin');
    console.log('\n💡 After signing in, the LinkedIn integration should show as CONNECTED');
    console.log('   since we already created the database association.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

setSimplePassword();