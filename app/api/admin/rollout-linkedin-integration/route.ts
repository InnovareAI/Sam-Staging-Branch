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
    throw new Error(`Unipile API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return await response.json()
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    // Check if user is super admin
    const userEmail = user.email?.toLowerCase() || ''
    const isSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(userEmail)
    
    if (!isSuperAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Admin access required',
        timestamp: new Date().toISOString()
      }, { status: 403 })
    }

    console.log(`🚀 LinkedIn Integration Rollout initiated by ${user.email}`)

    const body = await request.json()
    const { action = 'rollout_all', target_users = [], force_rollout = false } = body

    // Step 1: Ensure database schema is correct
    console.log('📊 Step 1: Verifying database schema...')
    
    // Check current table schema
    const { data: schemaCheck, error: schemaError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'user_unipile_accounts' 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `
    })

    if (schemaError && !schemaError.message.includes('exec_sql')) {
      return NextResponse.json({
        success: false,
        error: `Schema check failed: ${schemaError.message}`,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    // Step 2: Get all Unipile LinkedIn accounts
    console.log('🔍 Step 2: Fetching all Unipile LinkedIn accounts...')
    const unipileData = await callUnipileAPI('accounts')
    const allAccounts = Array.isArray(unipileData) ? unipileData : (unipileData.items || unipileData.accounts || [])
    const linkedInAccounts = allAccounts.filter((account: any) => account.type === 'LINKEDIN')

    console.log(`📈 Found ${linkedInAccounts.length} LinkedIn accounts in Unipile`)

    // Step 3: Get all SAM AI users
    console.log('👥 Step 3: Fetching all SAM AI users...')
    const { data: allUsers, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch users: ${usersError.message}`,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    console.log(`👥 Found ${allUsers.users.length} total SAM AI users`)

    // Step 4: Check existing associations
    console.log('🔗 Step 4: Checking existing associations...')
    const { data: existingAssociations } = await supabase
      .from('user_unipile_accounts')
      .select('user_id, unipile_account_id, account_email')

    const existingAssociationMap = new Map()
    existingAssociations?.forEach(assoc => {
      existingAssociationMap.set(assoc.unipile_account_id, assoc.user_id)
    })

    console.log(`🔗 Found ${existingAssociations?.length || 0} existing associations`)

    // Step 5: Auto-associate accounts for all users
    console.log('🤖 Step 5: Starting auto-association process...')
    
    const rolloutResults = []
    const usersToProcess = target_users.length > 0 ? 
      allUsers.users.filter(u => target_users.includes(u.email)) : 
      allUsers.users

    for (const samUser of usersToProcess) {
      const userEmail = samUser.email?.toLowerCase()
      if (!userEmail) continue

      console.log(`🔍 Processing user: ${userEmail}`)

      // Find matching LinkedIn accounts by email
      const matchingAccounts = linkedInAccounts.filter((account: any) => {
        const accountData = account.connection_params?.im || {}
        const possibleEmails = [
          accountData.username?.toLowerCase(),
          accountData.email?.toLowerCase(),
          account.connection_params?.email?.toLowerCase(),
          account.metadata?.user_email?.toLowerCase()
        ].filter(Boolean)

        return possibleEmails.includes(userEmail)
      })

      console.log(`📧 User ${userEmail}: Found ${matchingAccounts.length} matching accounts`)

      for (const matchingAccount of matchingAccounts) {
        // Skip if already associated
        if (existingAssociationMap.has(matchingAccount.id) && !force_rollout) {
          console.log(`⏭️ Account ${matchingAccount.id} already associated, skipping`)
          rolloutResults.push({
            user_email: userEmail,
            user_id: samUser.id,
            unipile_account_id: matchingAccount.id,
            account_name: matchingAccount.name,
            status: 'already_associated',
            message: 'Account already associated'
          })
          continue
        }

        // Create the association
        try {
          const { data: associationResult, error: associationError } = await supabase.rpc('create_user_association', {
            p_user_id: samUser.id,
            p_unipile_account_id: matchingAccount.id,
            p_platform: 'LINKEDIN',
            p_account_name: matchingAccount.name,
            p_account_email: userEmail,
            p_linkedin_public_identifier: matchingAccount.connection_params?.im?.publicIdentifier,
            p_linkedin_profile_url: matchingAccount.connection_params?.im?.publicIdentifier ? 
              `https://www.linkedin.com/in/${matchingAccount.connection_params.im.publicIdentifier}` : null,
            p_connection_status: 'active'
          })

          if (associationError) {
            console.error(`❌ Failed to associate ${matchingAccount.id} with ${userEmail}:`, associationError)
            rolloutResults.push({
              user_email: userEmail,
              user_id: samUser.id,
              unipile_account_id: matchingAccount.id,
              account_name: matchingAccount.name,
              status: 'error',
              message: associationError.message
            })
          } else {
            console.log(`✅ Successfully associated ${matchingAccount.id} with ${userEmail}`)
            rolloutResults.push({
              user_email: userEmail,
              user_id: samUser.id,
              unipile_account_id: matchingAccount.id,
              account_name: matchingAccount.name,
              status: 'success',
              message: 'Association created successfully'
            })
          }
        } catch (error) {
          console.error(`💥 Exception associating ${matchingAccount.id} with ${userEmail}:`, error)
          rolloutResults.push({
            user_email: userEmail,
            user_id: samUser.id,
            unipile_account_id: matchingAccount.id,
            account_name: matchingAccount.name,
            status: 'exception',
            message: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      if (matchingAccounts.length === 0) {
        rolloutResults.push({
          user_email: userEmail,
          user_id: samUser.id,
          unipile_account_id: null,
          account_name: null,
          status: 'no_match',
          message: 'No matching LinkedIn accounts found'
        })
      }
    }

    // Step 6: Generate summary
    const summary = {
      total_users_processed: usersToProcess.length,
      total_linkedin_accounts: linkedInAccounts.length,
      existing_associations: existingAssociations?.length || 0,
      new_associations: rolloutResults.filter(r => r.status === 'success').length,
      already_associated: rolloutResults.filter(r => r.status === 'already_associated').length,
      errors: rolloutResults.filter(r => r.status === 'error' || r.status === 'exception').length,
      no_matches: rolloutResults.filter(r => r.status === 'no_match').length
    }

    console.log(`📊 Rollout complete:`, summary)

    return NextResponse.json({
      success: true,
      message: 'LinkedIn integration rollout completed',
      summary,
      detailed_results: rolloutResults,
      schema_check: schemaCheck || 'Schema check not available',
      recommendations: [
        summary.errors > 0 ? 'Some associations failed - check error details' : null,
        summary.no_matches > 0 ? 'Some users have no matching LinkedIn accounts' : null,
        'All users should now have auto-association enabled'
      ].filter(Boolean),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('💥 LinkedIn rollout error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Rollout failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    // Check if user is super admin
    const userEmail = user.email?.toLowerCase() || ''
    const isSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(userEmail)
    
    if (!isSuperAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Admin access required',
        timestamp: new Date().toISOString()
      }, { status: 403 })
    }

    console.log(`📊 LinkedIn Integration Status Check by ${user.email}`)

    // Get current rollout status
    const { data: allUsers, error: usersError } = await supabase.auth.admin.listUsers()
    const { data: associations } = await supabase
      .from('user_unipile_accounts')
      .select('user_id, unipile_account_id, account_email, account_name, created_at')

    const unipileData = await callUnipileAPI('accounts')
    const allAccounts = Array.isArray(unipileData) ? unipileData : (unipileData.items || unipileData.accounts || [])
    const linkedInAccounts = allAccounts.filter((account: any) => account.type === 'LINKEDIN')

    const userAssociationMap = new Map()
    associations?.forEach(assoc => {
      if (!userAssociationMap.has(assoc.user_id)) {
        userAssociationMap.set(assoc.user_id, [])
      }
      userAssociationMap.get(assoc.user_id).push(assoc)
    })

    const statusReport = {
      total_users: allUsers?.users.length || 0,
      total_linkedin_accounts: linkedInAccounts.length,
      total_associations: associations?.length || 0,
      users_with_linkedin: userAssociationMap.size,
      users_without_linkedin: (allUsers?.users.length || 0) - userAssociationMap.size,
      rollout_percentage: allUsers?.users.length ? 
        Math.round((userAssociationMap.size / allUsers.users.length) * 100) : 0
    }

    return NextResponse.json({
      success: true,
      status_report: statusReport,
      environment_check: {
        has_unipile_dsn: !!process.env.UNIPILE_DSN,
        has_unipile_api_key: !!process.env.UNIPILE_API_KEY,
        environment: process.env.NODE_ENV || 'unknown'
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('💥 Status check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}