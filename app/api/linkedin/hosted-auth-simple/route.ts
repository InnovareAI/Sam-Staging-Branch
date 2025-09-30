import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const unipileDsn = process.env.UNIPILE_DSN
    const unipileApiKey = process.env.UNIPILE_API_KEY
    
    if (!unipileDsn || !unipileApiKey) {
      throw new Error('Unipile credentials not configured')
    }
    
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'
    const expirationTime = new Date()
    expirationTime.setHours(expirationTime.getHours() + 1)
    
    const hostedAuthRequest = {
      type: 'create',
      providers: ['LINKEDIN'],
      expiresOn: expirationTime.toISOString(),
      api_url: `https://${unipileDsn}`,
      success_redirect_url: `${siteUrl}/integrations/linkedin?status=success`,
      failure_redirect_url: `${siteUrl}/integrations/linkedin?status=failed`,
      notify_url: `${siteUrl}/api/linkedin/callback`,
      name: 'temp_user_' + Date.now()
    }
    
    const response = await fetch(`https://${unipileDsn}/api/v1/hosted/accounts/link`, {
      method: 'POST',
      headers: {
        'X-API-KEY': unipileApiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(hostedAuthRequest)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Unipile API error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    const authUrl = data.url || data.link || data.auth_url
    
    if (!authUrl) {
      throw new Error('No auth URL in response')
    }
    
    return NextResponse.json({
      success: true,
      auth_url: authUrl,
      action: 'create'
    })
    
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}