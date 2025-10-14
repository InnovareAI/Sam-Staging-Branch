import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { token, email } = await request.json();

    if (!token || !email) {
      return NextResponse.json(
        { error: 'Token and email are required', valid: false },
        { status: 400 }
      );
    }

    // Query token from database
    const { data: tokenData, error: queryError } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('token', token)
      .single();

    if (queryError || !tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token', valid: false },
        { status: 400 }
      );
    }

    // Check if token is expired
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      // Delete expired token
      await supabaseAdmin
        .from('password_reset_tokens')
        .delete()
        .eq('email', email.toLowerCase());

      return NextResponse.json(
        { error: 'Reset link has expired - please request a new one', valid: false },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      message: 'Token is valid'
    });

  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      { error: 'Failed to validate token', valid: false },
      { status: 500 }
    );
  }
}