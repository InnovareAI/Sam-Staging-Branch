import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function emergencyPasswordReset() {
  const email = 'tl@3cubed.ai';
  const newPassword = 'TempPass2024!'; // TEMPORARY PASSWORD - CHANGE IMMEDIATELY

  console.log('🚨 EMERGENCY PASSWORD RESET');
  console.log('Email:', email);
  console.log('Temp Password:', newPassword);
  console.log('');

  try {
    // Find user by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Error listing users:', listError);
      process.exit(1);
    }

    const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      console.error('❌ User not found:', email);
      process.exit(1);
    }

    console.log('✅ Found user:', user.id);

    // Reset password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        password: newPassword,
        email_confirm: true // Ensure email is confirmed
      }
    );

    if (updateError) {
      console.error('❌ Password update error:', updateError);
      process.exit(1);
    }

    console.log('');
    console.log('✅ ✅ ✅ PASSWORD RESET SUCCESSFUL ✅ ✅ ✅');
    console.log('');
    console.log('Sign in at: https://app.meet-sam.com/signin');
    console.log('Email:', email);
    console.log('Password:', newPassword);
    console.log('');
    console.log('⚠️  CHANGE THIS PASSWORD IMMEDIATELY AFTER SIGNING IN');
    console.log('');

  } catch (error) {
    console.error('❌ Emergency reset failed:', error);
    process.exit(1);
  }
}

emergencyPasswordReset();
