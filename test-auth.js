// Test script to create a user and verify authentication
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://latxadqrvrrrcvkktrog.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testAuth() {
  console.log('Testing Supabase authentication...');
  
  // Test email and password
  const testEmail = 'test@example.com';
  const testPassword = 'testpassword123';
  
  try {
    // 1. Try to create a test user
    console.log('\n1. Creating test user...');
    const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: 'Test',
        last_name: 'User'
      }
    });
    
    if (signUpError) {
      if (signUpError.message.includes('already registered') || signUpError.code === 'email_exists') {
        console.log('✅ User already exists, continuing...');
      } else {
        console.error('❌ Error creating user:', signUpError);
        return;
      }
    } else {
      console.log('✅ User created successfully:', signUpData.user?.email);
    }
    
    // 2. Test sign in
    console.log('\n2. Testing sign in...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (signInError) {
      console.error('❌ Sign in failed:', signInError);
      return;
    }
    
    console.log('✅ Sign in successful!');
    console.log('User ID:', signInData.user?.id);
    console.log('Email:', signInData.user?.email);
    
    // 3. Test database access
    console.log('\n3. Testing database access...');
    const { data: dbTest, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('email', testEmail)
      .single();
    
    if (dbError && !dbError.message.includes('No rows')) {
      console.error('❌ Database access failed:', dbError);
    } else if (dbTest) {
      console.log('✅ Database access successful');
      console.log('User profile:', dbTest);
    } else {
      console.log('⚠️ No user profile found in database');
    }
    
    // 4. Check workspaces
    console.log('\n4. Checking workspaces...');
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*');
    
    if (workspaceError) {
      console.error('❌ Workspace check failed:', workspaceError);
    } else {
      console.log('✅ Workspaces found:', workspaces?.length || 0);
      if (workspaces && workspaces.length > 0) {
        console.log('Available workspaces:', workspaces.map(w => w.name));
      }
    }
    
    console.log('\n🎉 Authentication test completed successfully!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testAuth();