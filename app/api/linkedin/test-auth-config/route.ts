import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get the current URL configuration
    const host = request.headers.get('host')
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    const currentUrl = `${protocol}://${host}`
    
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'
    
    // Check if URLs match
    const urlsMatch = currentUrl === configuredSiteUrl
    
    // Generate the URLs that would be used for Unipile auth
    const expectedCallbackUrl = `${configuredSiteUrl}/api/linkedin/callback`
    const expectedSuccessUrl = `${configuredSiteUrl}/integrations/linkedin?status=success`
    const expectedFailureUrl = `${configuredSiteUrl}/integrations/linkedin?status=failed`
    
    const actualCallbackUrl = `${currentUrl}/api/linkedin/callback`
    const actualSuccessUrl = `${currentUrl}/integrations/linkedin?status=success`
    const actualFailureUrl = `${currentUrl}/integrations/linkedin?status=failed`
    
    return NextResponse.json({
      success: true,
      environment_analysis: {
        current_host: host,
        current_protocol: protocol,
        current_full_url: currentUrl,
        configured_site_url: configuredSiteUrl,
        urls_match: urlsMatch,
        url_mismatch_issue: !urlsMatch ? 'The NEXT_PUBLIC_SITE_URL does not match the current deployment URL' : null
      },
      unipile_auth_urls: {
        configured: {
          callback_url: expectedCallbackUrl,
          success_redirect_url: expectedSuccessUrl,
          failure_redirect_url: expectedFailureUrl
        },
        actual_deployment: {
          callback_url: actualCallbackUrl,
          success_redirect_url: actualSuccessUrl,
          failure_redirect_url: actualFailureUrl
        }
      },
      recommendations: urlsMatch ? 
        ['Configuration looks correct'] : 
        [
          `Update NEXT_PUBLIC_SITE_URL to: ${currentUrl}`,
          'Ensure Unipile hosted auth is configured with the correct redirect URLs',
          'Test the auth flow after updating the configuration'
        ],
      unipile_config_check: {
        has_dsn: !!process.env.UNIPILE_DSN,
        has_api_key: !!process.env.UNIPILE_API_KEY,
        dsn_value: process.env.UNIPILE_DSN ? `${process.env.UNIPILE_DSN.substring(0, 10)}...` : null
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}