import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Test LinkedIn account functionality by trying to fetch messages
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    // In development mode, bypass auth for testing
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    if (!isDevelopment && (authError || !session?.user)) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        functional: false
      }, { status: 401 })
    }

    // For development testing, return simulated LinkedIn status based on our known accounts
    if (isDevelopment) {
      // We know we have 6 LinkedIn accounts from our MCP testing
      const simulatedLinkedInAccounts = [
        { id: 'NLsTJRfCSg-WZAXCBo8w7A', name: 'Thorsten Linz', status: 'OK' },
        { id: 'osKDIRFtTtqzmfULiWGTEg', name: 'Noriko Yokoi', status: 'STOPPED' },
        { id: 'he3RXnROSLuhONxgNle7dw', name: 'Charissa Saniel', status: 'OK' },
        { id: '3Zj8ks8aSrKg0ySaLQo_8A', name: 'Irish Cita De Ade', status: 'OK' },
        { id: 'MlV8PYD1SXG783XbJRraLQ', name: 'Martin Schechtner', status: 'OK' },
        { id: 'eCvuVstGTfCedKsrzAKvZA', name: 'Peter Noble', status: 'OK' }
      ]
      
      const linkedinAccounts = simulatedLinkedInAccounts
      console.log('Development mode: Using simulated LinkedIn accounts:', linkedinAccounts.length)
    } else {
      // Production mode - use actual MCP call (would need server-side MCP integration)
      return NextResponse.json({
        success: false,
        error: 'Production MCP integration not implemented yet',
        functional: false,
        accounts: []
      })
    }
    
    const linkedinAccounts = isDevelopment ? [
      { id: 'NLsTJRfCSg-WZAXCBo8w7A', name: 'Thorsten Linz', sources: [{ status: 'OK' }] },
      { id: 'osKDIRFtTtqzmfULiWGTEg', name: 'Noriko Yokoi', sources: [{ status: 'STOPPED' }] },
      { id: 'he3RXnROSLuhONxgNle7dw', name: 'Charissa Saniel', sources: [{ status: 'OK' }] },
      { id: '3Zj8ks8aSrKg0ySaLQo_8A', name: 'Irish Cita De Ade', sources: [{ status: 'OK' }] },
      { id: 'MlV8PYD1SXG783XbJRraLQ', name: 'Martin Schechtner', sources: [{ status: 'OK' }] },
      { id: 'eCvuVstGTfCedKsrzAKvZA', name: 'Peter Noble', sources: [{ status: 'OK' }] }
    ] : []

    // Test each LinkedIn account functionality
    const accountStatus = []
    let anyFunctional = false

    for (const account of linkedinAccounts) {
      const status = {
        account_id: account.id,
        name: account.name,
        raw_status: account.sources?.[0]?.status || 'UNKNOWN',
        functional: false,
        last_test: new Date().toISOString(),
        error: null
      }

      try {
        // Test actual functionality by trying to fetch recent messages
        const messagesResponse = await fetch(`https://${unipileDsn}/api/v1/chats`, {
          method: 'POST',
          headers: {
            'X-API-KEY': unipileApiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            account_id: account.sources?.[0]?.id,
            limit: 1 // Just test with 1 message to minimize load
          })
        })

        if (messagesResponse.ok) {
          status.functional = true
          anyFunctional = true
        } else {
          const errorText = await messagesResponse.text()
          status.error = `API Error: ${messagesResponse.status} - ${errorText}`
          
          // Check for specific error types
          if (errorText.includes('credentials') || errorText.includes('auth') || messagesResponse.status === 401) {
            status.error = 'Authentication required - please reconnect account'
          } else if (messagesResponse.status === 429) {
            status.error = 'Rate limited - account is functional but temporarily restricted'
            // Rate limiting means the account is actually working, just throttled
            status.functional = true
            anyFunctional = true
          }
        }
      } catch (testError) {
        status.error = `Connection failed: ${testError instanceof Error ? testError.message : 'Unknown error'}`
      }

      accountStatus.push(status)
    }

    // Determine overall status
    let overallStatus = 'disconnected'
    if (linkedinAccounts.length === 0) {
      overallStatus = 'no_accounts'
    } else if (anyFunctional) {
      overallStatus = accountStatus.every(acc => acc.functional) ? 'fully_functional' : 'partially_functional'
    } else {
      overallStatus = 'all_non_functional'
    }

    return NextResponse.json({
      success: true,
      functional: anyFunctional,
      overall_status: overallStatus,
      account_count: linkedinAccounts.length,
      functional_count: accountStatus.filter(acc => acc.functional).length,
      accounts: accountStatus,
      summary: {
        total_accounts: linkedinAccounts.length,
        functional_accounts: accountStatus.filter(acc => acc.functional).length,
        credential_issues: accountStatus.filter(acc => acc.error?.includes('auth')).length,
        rate_limited: accountStatus.filter(acc => acc.error?.includes('rate')).length
      },
      last_checked: new Date().toISOString()
    })

  } catch (error) {
    console.error('LinkedIn connection test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'LinkedIn connection test failed',
      functional: false,
      debug_error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}