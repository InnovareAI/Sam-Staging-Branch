import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const unipileDsn = process.env.UNIPILE_DSN
    const unipileApiKey = process.env.UNIPILE_API_KEY

    if (!unipileDsn || !unipileApiKey) {
      return NextResponse.json({
        success: false,
        accounts: [],
        has_linkedin: false,
        error: 'Unipile API credentials not configured',
        timestamp: new Date().toISOString()
      })
    }

    // Make direct API call to Unipile
    const unipileUrl = `https://${unipileDsn}/api/v1/accounts`
    
    const response = await fetch(unipileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': unipileApiKey,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Unipile API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const accounts = Array.isArray(data) ? data : (data.accounts || [])
    
    // Check if any account has LinkedIn connected (type: LINKEDIN)
    const hasLinkedIn = accounts.some((account: any) => 
      account.type === 'LINKEDIN' && 
      account.sources?.some((source: any) => 
        source.status === 'OK' || source.status === 'CREDENTIALS'
      )
    )
    
    return NextResponse.json({
      success: true,
      accounts: accounts,
      has_linkedin: hasLinkedIn,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Unipile accounts check error:', error)
    return NextResponse.json({
      success: false,
      accounts: [],
      has_linkedin: false,
      error: error instanceof Error ? error.message : 'Unable to check Unipile account status',
      timestamp: new Date().toISOString()
    })
  }
}