import { supabase } from '@/app/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Create a test user for development using regular signup
    const testEmail = 'test@samia.com';
    const testPassword = 'testpassword123';
    
    console.log('Creating test user...');
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          first_name: 'Test',
          last_name: 'User'
        }
      }
    });

    if (error) {
      console.error('Error creating test user:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log('Test user created successfully:', data.user?.id);
    
    return NextResponse.json({ 
      message: 'Test user created successfully (may need email verification)',
      email: testEmail,
      password: testPassword,
      userId: data.user?.id,
      note: 'If email verification is required, check the Supabase Auth settings'
    });
  } catch (error) {
    console.error('Server error creating test user:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}