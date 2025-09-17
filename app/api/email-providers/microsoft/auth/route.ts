import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { EmailIntegrationService } from '@/lib/services/email-integration'

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const emailService = new EmailIntegrationService()
    const authUrl = emailService.getMicrosoftAuthURL(user.id)

    return NextResponse.json({
      success: true,
      authUrl,
      message: 'Redirect user to this URL to authorize Microsoft access',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to generate Microsoft auth URL:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}