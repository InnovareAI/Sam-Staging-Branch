import { NextRequest, NextResponse } from 'next/server'

/**
 * Simplified LinkedIn status check
 * Bypasses Supabase authentication and checks Unipile directly
 */
export async function GET(request: NextRequest) {
  try {
    // Get Unipile configuration
    const unipileDsn = process.env.UNIPILE_DSN
    const unipileApiKey = process.env.UNIPILE_API_KEY

    if (!unipileDsn || !unipileApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Unipile not configured',
        has_linkedin: false,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    // Check Unipile accounts
    try {
      const unipileUrl = `https://${unipileDsn}/api/v1/accounts`
      const response = await fetch(unipileUrl, {
        headers: {
          'X-API-KEY': unipileApiKey,
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        return NextResponse.json({
          success: false,
          error: `Unipile API error: ${response.status}`,
          has_linkedin: false,
          timestamp: new Date().toISOString()
        }, { status: response.status })
      }

      const data = await response.json()
      const allLinkedinAccounts = data.items?.filter((acc: any) => acc.type === 'LINKEDIN') || []
      const activeLinkedinAccounts = allLinkedinAccounts.filter((acc: any) => acc.sources?.[0]?.status === 'OK')

      const hasLinkedIn = allLinkedinAccounts.length > 0

      return NextResponse.json({
        success: true,
        has_linkedin: hasLinkedIn,
        connection_status: {
          overall: hasLinkedIn ? 'connected' : 'disconnected',
          total_accounts: allLinkedinAccounts.length,
          active_accounts: activeLinkedinAccounts.length
        },
        accounts: activeLinkedinAccounts.map((acc: any) => ({
          id: acc.id,
          name: acc.name,
          status: acc.sources?.[0]?.status || 'unknown',
          email: acc.connection_params?.im?.email || acc.connection_params?.im?.username,
          created_at: acc.created_at
        })),
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      console.error('Unipile API error:', error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        has_linkedin: false,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

  } catch (error) {
    console.error('LinkedIn status check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      has_linkedin: false,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}