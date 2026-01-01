import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { token, email, password } = await request.json();

    if (!token || !email || !password) {
      return NextResponse.json(
        { error: 'Token, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Validate token from database
    const { data: tokenData, error: queryError } = await pool
      .from('password_reset_tokens')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('token', token)
      .single();

    if (queryError || !tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Check if token is expired
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      // Delete expired token
      await pool
        .from('password_reset_tokens')
        .delete()
        .eq('email', email.toLowerCase());

      return NextResponse.json(
        { error: 'Reset link has expired - please request a new one' },
        { status: 400 }
      );
    }

    // Find the user by email and update their password
    const { data: users, error: listError } = await pool.auth.admin.listUsers();

    if (listError) {
      console.error('Error listing users:', listError);
      return NextResponse.json(
        { error: 'Failed to find user' },
        { status: 500 }
      );
    }

    const user = users.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json(
        { error: 'User account not found' },
        { status: 404 }
      );
    }

    // Update the user's password using admin API
    const { error: updateError } = await pool.auth.admin.updateUserById(
      user.id,
      { password: password }
    );

    if (updateError) {
      console.error('Password update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    // Delete used token
    await pool
      .from('password_reset_tokens')
      .delete()
      .eq('email', email.toLowerCase());

    console.log('✅ Password updated successfully for:', email);

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Reset password confirm error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}