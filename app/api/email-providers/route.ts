import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool, AuthError } from '@/lib/auth'

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
    console.error(`Unipile API error: ${response.status} ${response.statusText}`, errorText)
    throw new Error(`Unipile API error: ${response.status} - ${errorText}`)
  }

  return await response.json()
}

export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/email-providers called')

    // Firebase auth - workspace comes from header
    let authContext;
    try {
      authContext = await verifyAuth(request);
    } catch (error) {
      const authError = error as AuthError;
      console.log('Auth failed - returning', authError.statusCode)
      return NextResponse.json({
        success: false,
        error: authError.message
      }, { status: authError.statusCode });
    }

    const { userId, workspaceId } = authContext;

    console.log('Fetching email providers for user:', userId)
    console.log('Workspace ID:', workspaceId)

    // Get workspace email accounts directly from workspace_accounts
    const { rows: workspaceAccounts } = await pool.query(
      `SELECT * FROM workspace_accounts
       WHERE workspace_id = $1 AND account_type = 'email'`,
      [workspaceId]
    );

    console.log('Found', workspaceAccounts?.length || 0, 'email accounts in workspace')

    const workspaceAccountIds = new Set(workspaceAccounts?.map((a: any) => a.unipile_account_id) || [])
    console.log('Workspace account IDs:', Array.from(workspaceAccountIds))

    // Get all Unipile accounts
    const unipileResponse = await callUnipileAPI('accounts')
    const allAccounts = unipileResponse.items || []
    console.log('Unipile returned', allAccounts.length, 'total accounts')

    // Filter to only show workspace email accounts
    const emailAccounts = allAccounts
      .filter((account: any) => {
        // Check if this account belongs to the workspace
        const belongsToWorkspace = workspaceAccountIds.has(account.id)
        console.log(`Account ${account.id} (${account.type}):`, belongsToWorkspace ? 'belongs to workspace' : 'not in workspace')

        if (!belongsToWorkspace) return false

        // Include GOOGLE, GOOGLE_OAUTH, OUTLOOK, OUTLOOK_OAUTH, MESSAGING, and MAIL (IMAP/SMTP) types
        const accountType = account.type?.toUpperCase() || ''
        const isEmailType = accountType.includes('GOOGLE') || accountType.includes('OUTLOOK') || accountType === 'MESSAGING' || accountType === 'MAIL'
        console.log(`  Type check: ${accountType} ->`, isEmailType ? 'email type' : 'not email')

        return isEmailType
      })
      .map((account: any) => {
        const connectionParams = account.connection_params || {}
        const isConnected = account.sources?.some((source: any) => source.status === 'OK')

        // Determine provider type based on Unipile account type
        let providerType = 'email'
        const accountType = account.type?.toUpperCase() || ''
        if (accountType.includes('GOOGLE')) providerType = 'google'
        else if (accountType.includes('OUTLOOK')) providerType = 'microsoft'
        else if (accountType === 'MAIL') providerType = 'smtp'

        // Extract email from different OAuth formats
        const email = connectionParams.mail?.username ||
                     connectionParams.im?.email ||
                     connectionParams.email ||
                     account.name ||
                     ''

        return {
          id: account.id,
          user_id: userId,
          provider_type: providerType,
          provider_name: account.name || email || 'Email Account',
          email_address: email,
          status: isConnected ? 'connected' : 'disconnected',
          config: account.connection_params,
          last_sync: account.updated_at,
          created_at: account.created_at,
          updated_at: account.updated_at
        }
      })

    console.log('Returning', emailAccounts.length, 'email accounts')

    return NextResponse.json({
      success: true,
      providers: emailAccounts,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to get email providers:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load email providers'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider_type, provider_name, email_address, config } = body

    if (!provider_type || !provider_name || !email_address) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: provider_type, provider_name, email_address'
      }, { status: 400 })
    }

    // Firebase auth - workspace comes from header
    let authContext;
    try {
      authContext = await verifyAuth(request);
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({
        success: false,
        error: authError.message
      }, { status: authError.statusCode });
    }

    const { userId } = authContext;

    // Insert new email provider
    console.log('Creating email provider:', {
      user_id: userId,
      provider_type,
      provider_name,
      email_address
    })

    const { rows } = await pool.query(
      `INSERT INTO email_providers (user_id, provider_type, provider_name, email_address, status, config)
       VALUES ($1, $2, $3, $4, 'disconnected', $5)
       RETURNING *`,
      [userId, provider_type, provider_name, email_address, JSON.stringify(config || {})]
    );

    const provider = rows[0];

    console.log('Created email provider:', provider)

    return NextResponse.json({
      success: true,
      provider,
      message: 'Email provider created successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to create email provider:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
