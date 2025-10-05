import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/auth/magic-link/verify
 *
 * Verifies one-time magic link token and logs in the user
 * Body: { token }
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    // Fetch magic link token
    const { data: tokenData, error: tokenError } = await supabase
      .from('magic_link_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json({ error: 'Invalid magic link' }, { status: 404 })
    }

    // Check if already used
    if (tokenData.used) {
      return NextResponse.json({ error: 'Magic link has already been used' }, { status: 400 })
    }

    // Check if expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Magic link has expired' }, { status: 400 })
    }

    // Get user
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(tokenData.user_id)

    if (userError || !userData.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Generate session for user
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email!,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com'}/auth/setup-password`
      }
    })

    if (sessionError || !sessionData) {
      console.error('Session generation error:', sessionError)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    // Mark token as used
    const { error: updateError } = await supabase
      .from('magic_link_tokens')
      .update({
        used: true,
        used_at: new Date().toISOString()
      })
      .eq('id', tokenData.id)

    if (updateError) {
      console.error('Failed to mark token as used:', updateError)
    }

    // Set auth cookies (Supabase session)
    const cookieStore = await cookies()

    // Extract tokens from the hashed_token URL
    const url = new URL(sessionData.properties.hashed_token)
    const accessToken = url.searchParams.get('access_token')
    const refreshToken = url.searchParams.get('refresh_token')

    if (accessToken && refreshToken) {
      // Create Supabase client session
      const userSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      await userSupabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      })

      // Set cookies for session persistence
      cookieStore.set({
        name: `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0]}-auth-token`,
        value: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Magic link verified successfully'
    })

  } catch (error) {
    console.error('Magic link verification error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify magic link' },
      { status: 500 }
    )
  }
}
