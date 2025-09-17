import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { EmailIntegrationService } from '@/lib/services/email-integration'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // This contains the user ID
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/inbox?error=google_auth_failed&message=${error}`)
    }

    if (!code || !state) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/inbox?error=google_auth_failed&message=missing_code_or_state`)
    }

    const supabase = supabaseAdmin()
    
    // Verify the user from state parameter
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || user.id !== state) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/inbox?error=google_auth_failed&message=invalid_user`)
    }

    const emailService = new EmailIntegrationService()

    // Exchange code for tokens
    const tokens = await emailService.exchangeGoogleCode(code)

    // Store the email provider in database
    const { data: provider, error: insertError } = await supabase
      .from('email_providers')
      .upsert({
        user_id: user.id,
        provider_type: 'google',
        provider_name: 'Google Workspace',
        email_address: tokens.email,
        status: 'connected',
        oauth_access_token: tokens.access_token, // Note: Should be encrypted in production
        oauth_refresh_token: tokens.refresh_token,
        oauth_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        oauth_scopes: emailService.getSupportedProviders().find(p => p.type === 'google')?.description?.split(' '),
        last_sync: new Date().toISOString(),
        config: {
          connected_at: new Date().toISOString(),
          email: tokens.email
        }
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Failed to store Google provider:', insertError)
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/inbox?error=google_auth_failed&message=database_error`)
    }

    console.log(`✅ Google account connected: ${tokens.email}`)

    // Redirect back to inbox with success message
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/inbox?success=google_connected&email=${encodeURIComponent(tokens.email)}`)

  } catch (error) {
    console.error('❌ Google OAuth callback failed:', error)
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/inbox?error=google_auth_failed&message=callback_error`)
  }
}