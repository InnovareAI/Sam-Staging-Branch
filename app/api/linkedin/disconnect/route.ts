import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

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

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    console.log(`🔌 Disconnecting LinkedIn accounts for user ${user.email} (${user.id})`)

    // Get user's workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    if (!userProfile?.current_workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'No active workspace found'
      }, { status: 400 })
    }

    const workspaceId = userProfile.current_workspace_id
    console.log(`🏢 User workspace: ${workspaceId}`)

    // First, get all LinkedIn accounts to delete from Unipile
    const { data: accountsToDelete, error: fetchError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'linkedin')

    if (fetchError) {
      console.error('❌ Error fetching accounts to delete:', fetchError)
      return NextResponse.json({
        success: false,
        error: `Failed to fetch accounts: ${fetchError.message}`
      }, { status: 500 })
    }

    console.log(`📋 Found ${accountsToDelete?.length || 0} LinkedIn accounts to disconnect`)

    // Delete from Unipile first
    let unipileDeletedCount = 0
    let unipileErrors = []

    for (const account of accountsToDelete || []) {
      if (account.unipile_account_id) {
        try {
          console.log(`🗑️  Deleting Unipile account ${account.unipile_account_id} (${account.account_name})`)
          await callUnipileAPI(`accounts/${account.unipile_account_id}`, 'DELETE')
          unipileDeletedCount++
          console.log(`✅ Deleted from Unipile: ${account.account_name}`)
        } catch (error) {
          console.error(`⚠️  Failed to delete from Unipile: ${account.account_name}`, error)
          unipileErrors.push({
            account_name: account.account_name,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }

    // Remove all LinkedIn accounts from workspace_accounts database
    const { data: deletedAccounts, error: deleteError } = await supabase
      .from('workspace_accounts')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'linkedin')
      .select()

    if (deleteError) {
      console.error('❌ Error deleting workspace accounts from database:', deleteError)
      return NextResponse.json({
        success: false,
        error: `Failed to disconnect from database: ${deleteError.message}`
      }, { status: 500 })
    }

    console.log(`✅ Successfully disconnected ${deletedAccounts?.length || 0} LinkedIn accounts from workspace`)
    console.log(`✅ Deleted ${unipileDeletedCount} accounts from Unipile`)

    return NextResponse.json({
      success: true,
      message: 'LinkedIn accounts disconnected successfully',
      disconnected_accounts: deletedAccounts?.length || 0,
      unipile_deleted_count: unipileDeletedCount,
      unipile_errors: unipileErrors.length > 0 ? unipileErrors : undefined,
      workspace_id: workspaceId,
      user_email: user.email
    })

  } catch (error) {
    console.error('💥 Disconnect error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Disconnect failed'
    }, { status: 500 })
  }
}