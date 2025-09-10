import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for server-side auth
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName } = await request.json();

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    console.log('Creating user with Supabase Auth:', { email, firstName, lastName });

    // Create user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
        // Configure email confirmation redirect
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
      }
    });

    if (error) {
      console.error('Supabase signup error:', error);
      
      // Handle specific error types
      if (error.message.includes('User already registered')) {
        return NextResponse.json(
          { error: 'User already exists with this email address' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Check if user was created and needs email verification
    if (data.user && !data.session) {
      return NextResponse.json({
        message: 'Registration successful! Please check your email to verify your account.',
        requiresVerification: true,
        email: email
      });
    }

    // If session exists, user is automatically logged in (email verification disabled)
    if (data.session && data.user) {
      console.log('User created successfully:', data.user.id);
      
      // Create user profile in our database
      try {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error: profileError } = await supabaseAdmin
          .from('users')
          .insert({
            id: data.user.id,
            clerk_id: data.user.id, // Use Supabase user ID as clerk_id for compatibility
            email: data.user.email,
            first_name: firstName,
            last_name: lastName,
            created_at: new Date().toISOString()
          });

        if (profileError && !profileError.message.includes('duplicate key')) {
          console.error('Profile creation error:', profileError);
        }

      } catch (profileErr) {
        console.error('Error creating user profile:', profileErr);
      }

      return NextResponse.json({
        message: 'Registration successful! You are now logged in.',
        user: {
          id: data.user.id,
          email: data.user.email,
          firstName: firstName,
          lastName: lastName
        }
      });
    }

    return NextResponse.json({
      message: 'Registration initiated. Please complete the verification process.',
      requiresVerification: true
    });

  } catch (error) {
    console.error('Signup API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during registration' },
      { status: 500 }
    );
  }
}