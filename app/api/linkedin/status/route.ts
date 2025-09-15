import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Simple LinkedIn connection status check
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        has_linkedin: false
      }, { status: 401 })
    }

    // Check Unipile for LinkedIn accounts
    const unipileDsn = process.env.UNIPILE_DSN
    const unipileApiKey = process.env.UNIPILE_API_KEY

    if (!unipileDsn || !unipileApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Unipile not configured',
        has_linkedin: false
      }, { status: 503 })
    }

    // Call Unipile API
    const unipileUrl = `https://${unipileDsn}/api/v1/accounts`
    const response = await fetch(unipileUrl, {
      headers: {
        'X-API-KEY': unipileApiKey,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('Unipile API error:', response.status, response.statusText)
      return NextResponse.json({
        success: false,
        error: 'Failed to check LinkedIn connection',
        has_linkedin: false
      }, { status: 500 })
    }

    const accounts = await response.json()
    
    // Filter for LinkedIn accounts
    const linkedinAccounts = accounts.filter((account: any) => 
      account.type === 'LINKEDIN' && 
      account.status === 'OK'
    )

    console.log(`✅ LinkedIn check for ${user.email}: ${linkedinAccounts.length} accounts found`)

    return NextResponse.json({
      success: true,
      has_linkedin: linkedinAccounts.length > 0,
      account_count: linkedinAccounts.length,
      accounts: linkedinAccounts.map((acc: any) => ({
        id: acc.id,
        name: acc.connection_params?.im?.username || 'LinkedIn Account',
        status: acc.status
      }))
    })

  } catch (error) {
    console.error('LinkedIn status check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      has_linkedin: false
    }, { status: 500 })
  }
}