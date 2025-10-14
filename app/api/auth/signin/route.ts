import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      }
    );

    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    console.log('Signing in user with Supabase Auth:', { email });

    // Sign in with Supabase Auth (this will set the session cookies)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Supabase signin error:', error);

      // Handle specific error types
      if (error.message.includes('Invalid login credentials')) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      if (error.message.includes('Email not confirmed')) {
        return NextResponse.json(
          { error: 'Please verify your email address before signing in' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Successful sign-in
    if (data.session && data.user) {
      console.log('User signed in successfully:', data.user.id);

      // Create response with user data
      const response = NextResponse.json({
        message: 'Sign-in successful!',
        user: {
          id: data.user.id,
          email: data.user.email,
          firstName: data.user.user_metadata?.first_name,
          lastName: data.user.user_metadata?.last_name
        }
      });

      // Ensure cookies are set in the response
      return response;
    }

    return NextResponse.json(
      { error: 'Sign-in failed - no session created' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Signin API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during sign-in' },
      { status: 500 }
    );
  }
}

// Handle GET requests - redirect to signin page
export async function GET(request: NextRequest) {
  // Get redirect URL from query params
  const { searchParams } = new URL(request.url);
  const error = searchParams.get('error');

  // Build redirect URL with query params
  const signinUrl = new URL('/signin', request.url);
  if (error) {
    signinUrl.searchParams.set('error', error);
  }

  // Redirect to the Next.js signin page
  return NextResponse.redirect(signinUrl);
}