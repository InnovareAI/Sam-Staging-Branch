// Quick password reset for Thorsten
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://latxadqrvrrrcvkktrog.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetPassword() {
  const email = 'tl@innovareai.com';
  const newPassword = 'thorsten123'; // Change this to whatever you want
  
  console.log(`🔐 Resetting password for ${email}...`);
  
  try {
    // Update password directly via admin API
    const { data, error } = await supabase.auth.admin.updateUserById(
      'a948a612-9a42-41aa-84a9-d368d9090054', // Your user ID
      {
        password: newPassword
      }
    );
    
    if (error) {
      console.error('❌ Error resetting password:', error);
    } else {
      console.log('✅ Password reset successful!');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 New Password: ${newPassword}`);
      console.log('\n🔗 You can now login at:');
      console.log('- Staging: https://staging--sam-new-sep-7.netlify.app/api/auth/signin');
      console.log('- Local: http://localhost:3000/api/auth/signin');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

resetPassword();