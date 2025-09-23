// Set a super simple test password for NY
import { createClient } from '@supabase/supabase-js';

console.log('🔑 Setting test password for NY@3cubed.ai...\n');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setTestPassword() {
  try {
    // Find NY's user
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('❌ Error fetching users:', userError);
      return;
    }
    
    const nyUser = users.users.find(user => user.email === 'ny@3cubed.ai');
    
    if (!nyUser) {
      console.log('❌ NY user not found');
      return;
    }
    
    console.log('✅ Found NY user:', nyUser.id);
    
    // Set simple test password (must be 8+ chars)
    const testPassword = '12345678';
    
    const { data, error } = await supabase.auth.admin.updateUserById(
      nyUser.id,
      {
        password: testPassword,
        email_confirm: true
      }
    );
    
    if (error) {
      console.error('❌ Error setting password:', error);
    } else {
      console.log('✅ Test password set successfully!');
      console.log('\n🔑 NY Test Login:');
      console.log(`   Email: ny@3cubed.ai`);
      console.log(`   Password: ${testPassword}`);
      console.log('\n🚀 Ready to test LinkedIn connection!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

setTestPassword().catch(console.error);