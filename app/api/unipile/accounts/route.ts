import { NextRequest, NextResponse } from 'next/server'

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
    throw new Error(`Unipile API error: ${response.status} ${response.statusText}`)
  }

  return await response.json()
}

// Helper function to find duplicate LinkedIn accounts
function findDuplicateLinkedInAccounts(accounts: any[]) {
  const linkedInAccounts = accounts.filter(account => account.type === 'LINKEDIN')
  
  // Group by username/identifier to find duplicates
  const accountsByIdentifier = new Map()
  
  linkedInAccounts.forEach(account => {
    const identifier = account.connection_params?.im?.username || 
                      account.connection_params?.im?.publicIdentifier || 
                      account.name
    
    if (!accountsByIdentifier.has(identifier)) {
      accountsByIdentifier.set(identifier, [])
    }
    accountsByIdentifier.get(identifier).push(account)
  })
  
  // Find accounts with duplicates
  const duplicates = []
  for (const [identifier, accounts] of accountsByIdentifier.entries()) {
    if (accounts.length > 1) {
      // Keep the most recent one, mark others as duplicates
      accounts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      duplicates.push(...accounts.slice(1)) // All except the first (most recent)
    }
  }
  
  return duplicates
}

export async function GET(request: NextRequest) {
  try {
    // Get cleanup parameter
    const url = new URL(request.url)
    const cleanup = url.searchParams.get('cleanup') === 'true'
    
    // Fetch accounts using helper function
    const data = await callUnipileAPI('accounts')
    const accounts = Array.isArray(data) ? data : (data.accounts || [])
    
    // Detect duplicate LinkedIn accounts
    const duplicates = findDuplicateLinkedInAccounts(accounts)
    
    // Always automatically cleanup duplicates - no user intervention needed
    if (duplicates.length > 0) {
      console.log(`Found ${duplicates.length} duplicate LinkedIn accounts, cleaning up...`)
      
      const deletionResults = []
      for (const duplicate of duplicates) {
        try {
          await callUnipileAPI(`accounts/${duplicate.id}`, 'DELETE')
          deletionResults.push({ id: duplicate.id, deleted: true })
          console.log(`Deleted duplicate LinkedIn account: ${duplicate.id}`)
        } catch (error) {
          deletionResults.push({ id: duplicate.id, deleted: false, error: error.message })
          console.error(`Failed to delete duplicate account ${duplicate.id}:`, error)
        }
      }
      
      // Fetch updated accounts list after cleanup
      const updatedData = await callUnipileAPI('accounts')
      const updatedAccounts = Array.isArray(updatedData) ? updatedData : (updatedData.accounts || [])
      
      return NextResponse.json({
        success: true,
        accounts: updatedAccounts,
        has_linkedin: updatedAccounts.some((account: any) => 
          account.type === 'LINKEDIN' && 
          account.sources?.some((source: any) => 
            source.status === 'OK' || source.status === 'CREDENTIALS'
          )
        ),
        auto_cleanup_performed: true,
        duplicates_removed: deletionResults,
        message: `Automatically cleaned up ${deletionResults.filter(r => r.deleted).length} duplicate LinkedIn accounts`,
        timestamp: new Date().toISOString()
      })
    }
    
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
      duplicates_detected: 0, // Always 0 since we auto-cleanup
      duplicates: [], // Empty since we auto-cleanup
      auto_cleanup_available: true,
      message: duplicates.length > 0 ? 'LinkedIn connections optimized' : 'All LinkedIn connections are clean',
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

// POST method for account reconnection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, account_id, linkedin_credentials } = body
    
    if (action === 'reconnect' && account_id) {
      // Use Unipile's reconnect functionality for existing accounts
      const result = await callUnipileAPI(`accounts/${account_id}/reconnect`, 'POST', {
        credentials: linkedin_credentials
      })
      
      return NextResponse.json({
        success: true,
        action: 'reconnected',
        account: result,
        timestamp: new Date().toISOString()
      })
    }
    
    if (action === 'create') {
      // First, check for existing LinkedIn accounts
      const existingData = await callUnipileAPI('accounts')
      const existingAccounts = Array.isArray(existingData) ? existingData : (existingData.accounts || [])
      const existingLinkedIn = existingAccounts.filter(account => account.type === 'LINKEDIN')
      
      // If LinkedIn account already exists, suggest reconnect instead
      if (existingLinkedIn.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'LinkedIn account already exists',
          suggestion: 'Use reconnect instead of creating new account',
          existing_accounts: existingLinkedIn.map(acc => ({
            id: acc.id,
            name: acc.name,
            status: acc.sources?.[0]?.status
          })),
          timestamp: new Date().toISOString()
        }, { status: 409 })
      }
      
      // Create new account if none exists
      const result = await callUnipileAPI('accounts', 'POST', {
        type: 'LINKEDIN',
        credentials: linkedin_credentials
      })
      
      // Immediate auto-cleanup: Check for duplicates after creation
      setTimeout(async () => {
        try {
          const updatedData = await callUnipileAPI('accounts')
          const updatedAccounts = Array.isArray(updatedData) ? updatedData : (updatedData.accounts || [])
          const duplicates = findDuplicateLinkedInAccounts(updatedAccounts)
          
          if (duplicates.length > 0) {
            console.log(`Auto-cleanup: Found ${duplicates.length} duplicates after account creation - cleaning immediately`)
            for (const duplicate of duplicates) {
              try {
                await callUnipileAPI(`accounts/${duplicate.id}`, 'DELETE')
                console.log(`Auto-deleted duplicate: ${duplicate.id}`)
              } catch (error) {
                console.error(`Auto-cleanup failed for ${duplicate.id}:`, error)
              }
            }
          }
        } catch (error) {
          console.error('Auto-cleanup error:', error)
        }
      }, 1000) // 1 second delay for immediate auto-cleanup
      
      return NextResponse.json({
        success: true,
        action: 'created',
        account: result,
        auto_cleanup_scheduled: true,
        timestamp: new Date().toISOString()
      })
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use "reconnect" or "create"',
      timestamp: new Date().toISOString()
    }, { status: 400 })
    
  } catch (error) {
    console.error('Unipile account operation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Account operation failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// DELETE method for removing specific accounts
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { account_id } = body
    
    if (!account_id) {
      return NextResponse.json({
        success: false,
        error: 'account_id is required',
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }
    
    // Delete the account using Unipile API
    await callUnipileAPI(`accounts/${account_id}`, 'DELETE')
    
    return NextResponse.json({
      success: true,
      action: 'deleted',
      account_id: account_id,
      note: 'Account deleted - this action is invoiced if deleted directly',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Unipile account deletion error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Account deletion failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}