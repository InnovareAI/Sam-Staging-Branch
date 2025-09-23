// Set a simple password for NY's account so you can log in
import { createClient } from '@supabase/supabase-js';

console.log('🔑 Setting simple password for NY@3cubed.ai...\n');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setNYPassword() {
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
    
    // Set a simple password
    const simplePassword = 'ny3cubed2025';
    
    const { data, error } = await supabase.auth.admin.updateUserById(
      nyUser.id,
      {
        password: simplePassword,
        email_confirm: true
      }
    );
    
    if (error) {
      console.error('❌ Error setting password:', error);
    } else {
      console.log('✅ Password set successfully!');
      console.log('\n🔑 NY Login Credentials:');
      console.log(`   Email: ny@3cubed.ai`);
      console.log(`   Password: ${simplePassword}`);
      console.log('\nNow you can log in as NY and connect her LinkedIn!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

setNYPassword().catch(console.error);