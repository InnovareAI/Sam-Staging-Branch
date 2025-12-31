import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

// Helper function to make Unipile API calls
async function callUnipileAPI(endpoint: string, method: string = 'GET', body?: any) {
  const unipileDsn = process.env.UNIPILE_DSN
  const unipileApiKey = process.env.UNIPILE_API_KEY

  if (!unipileDsn || !unipileApiKey) {
    throw new Error('Unipile API credentials not configured')
  }

  const url = `https://${unipileDsn}/api/v1/${endpoint}`
  const options: RequestInit = {
    method,
    headers: {
      'X-API-KEY': unipileApiKey,
      'Accept': 'application/json',
      ...(body && { 'Content-Type': 'application/json' })
    },
    ...(body && { body: JSON.stringify(body) })
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Unipile API error: ${response.status} ${response.statusText}`, {
      url,
      method,
      body: body ? JSON.stringify(body, null, 2) : undefined,
      errorResponse: errorText
    })
    throw new Error(`Unipile API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return await response.json()
}

// POST - Reconnect existing LinkedIn account (recommended by Unipile support)
export async function POST(request: NextRequest) {
  try {
    // Authenticate user using Firebase/Cloud SQL
    const { userId, userEmail } = await verifyAuth(request)

    console.log(`🔄 User ${userEmail} (${userId}) attempting LinkedIn reconnect`)

    const body = await request.json()
    const { account_id, linkedin_credentials } = body

    if (!account_id) {
      return NextResponse.json({
        success: false,
        error: 'account_id is required for reconnection',
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }

    if (!linkedin_credentials || !linkedin_credentials.username || !linkedin_credentials.password) {
      return NextResponse.json({
        success: false,
        error: 'LinkedIn credentials (username and password) are required for reconnection',
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }

    console.log('🔄 Reconnecting LinkedIn account:', {
      account_id,
      username: linkedin_credentials.username,
      hasPassword: !!linkedin_credentials.password,
      has2FA: !!linkedin_credentials.twoFaCode
    })

    // Use Unipile's reconnect endpoint (recommended over create for existing accounts)
    const result = await callUnipileAPI(`accounts/${account_id}/reconnect`, 'POST', {
      credentials: {
        username: linkedin_credentials.username,
        password: linkedin_credentials.password,
        // Include 2FA code if provided
        ...(linkedin_credentials.twoFaCode && { twoFaCode: linkedin_credentials.twoFaCode }),
        // Include CAPTCHA response if provided
        ...(linkedin_credentials.captchaResponse && { captcha_response: linkedin_credentials.captchaResponse })
      }
    })

    console.log('✅ Reconnect response:', {
      hasAccount: !!result,
      status: result?.status,
      account_id: result?.id || account_id
    })

    // Check for checkpoint requirements (CAPTCHA, 2FA, etc.)
    if (result?.object === 'Checkpoint') {
      const checkpointType = result.checkpoint?.type
      console.log('LinkedIn checkpoint detected during reconnect:', {
        type: checkpointType,
        account_id: result.account_id || account_id
      })

      if (checkpointType === 'CAPTCHA') {
        return NextResponse.json({
          success: false,
          error: 'LinkedIn requires CAPTCHA verification. Please complete the verification.',
          requires_captcha: true,
          checkpoint_type: checkpointType,
          account_id: result.account_id || account_id,
          captcha_data: {
            public_key: result.checkpoint.public_key,
            data: result.checkpoint.data
          },
          timestamp: new Date().toISOString()
        }, { status: 422 })
      } else if (checkpointType === '2FA' || checkpointType === 'two_factor' || checkpointType === 'IN_APP_VALIDATION') {
        return NextResponse.json({
          success: false,
          error: 'LinkedIn requires 2-factor authentication. Please complete the verification.',
          requires_2fa: true,
          checkpoint_type: checkpointType,
          account_id: result.account_id || account_id,
          timestamp: new Date().toISOString()
        }, { status: 422 })
      } else {
        return NextResponse.json({
          success: false,
          error: `LinkedIn requires additional verification: ${checkpointType}. Please contact support.`,
          requires_verification: true,
          checkpoint_type: checkpointType,
          account_id: result.account_id || account_id,
          timestamp: new Date().toISOString()
        }, { status: 422 })
      }
    }

    // Update the association status in our database
    try {
      await pool.query(
        `UPDATE user_unipile_accounts
         SET connection_status = 'active', updated_at = NOW()
         WHERE unipile_account_id = $1 AND user_id = $2`,
        [account_id, userId]
      )
      console.log(`✅ Updated association status for account ${account_id}`)
    } catch (updateError: any) {
      console.log(`⚠️ Failed to update association status:`, updateError.message)
      // Don't fail the whole operation for this
    }

    return NextResponse.json({
      success: true,
      action: 'reconnected',
      account: result,
      account_id: result?.id || account_id,
      message: 'LinkedIn account reconnected successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    // Handle auth errors
    if (error?.code === 'UNAUTHORIZED' || error?.code === 'FORBIDDEN') {
      return NextResponse.json({
        success: false,
        error: 'Authentication required to reconnect LinkedIn account',
        timestamp: new Date().toISOString()
      }, { status: error.statusCode || 401 })
    }

    console.error('LinkedIn reconnect error:', error)

    // Check if error indicates 2FA is required
    const errorMessage = error instanceof Error ? error.message : 'Reconnection failed'
    let statusCode = 500
    let requires2FA = false
    let requiresCaptcha = false

    // Detect specific error types
    if (errorMessage.includes('2FA') ||
        errorMessage.includes('two-factor') ||
        errorMessage.includes('verification') ||
        errorMessage.includes('challenge') ||
        errorMessage.includes('authenticate')) {
      statusCode = 422 // Unprocessable Entity - indicates 2FA needed
      requires2FA = true
    } else if (errorMessage.includes('captcha') || errorMessage.includes('CAPTCHA')) {
      statusCode = 422
      requiresCaptcha = true
    } else if (errorMessage.includes('credentials not configured') ||
               errorMessage.includes('401') ||
               errorMessage.includes('403')) {
      statusCode = 503 // Service Unavailable - configuration issue
    }

    return NextResponse.json({
      success: false,
      error: statusCode === 503 ?
        'Unipile integration not configured. Please check environment variables.' :
        errorMessage,
      requires_2fa: requires2FA,
      requires_captcha: requiresCaptcha,
      debug_info: {
        error_message: errorMessage,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        has_dsn: !!process.env.UNIPILE_DSN,
        has_api_key: !!process.env.UNIPILE_API_KEY,
        environment: process.env.NODE_ENV || 'unknown'
      },
      timestamp: new Date().toISOString()
    }, { status: statusCode })
  }
}
