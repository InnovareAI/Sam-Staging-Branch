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

    // Check if body exists and has unipile_account_id, otherwise find all LinkedIn accounts
    let unipile_account_id = null
    try {
      const body = await request.json()
      unipile_account_id = body.unipile_account_id
    } catch (e) {
      // No body or invalid JSON, that's fine - we'll find accounts automatically
    }

    console.log(`🔗 Manual association for user ${user.email} (${user.id}) with account ${unipile_account_id}`)

    // Get user's current workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    if (!userProfile?.current_workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'No active workspace found',
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }

    const workspaceId = userProfile.current_workspace_id
    console.log(`👤 User workspace: ${workspaceId}`)

    let linkedinAccounts = []
    
    if (unipile_account_id) {
      // Single account association
      const accountDetails = await callUnipileAPI(`accounts/${unipile_account_id}`)
      
      if (accountDetails.type !== 'LINKEDIN') {
        return NextResponse.json({
          success: false,
          error: 'Account is not a LinkedIn account',
          timestamp: new Date().toISOString()
        }, { status: 400 })
      }
      
      linkedinAccounts = [accountDetails]
    } else {
      // Find all LinkedIn accounts to associate
      console.log('🔍 Searching for all LinkedIn accounts in Unipile...')
      const allAccounts = await callUnipileAPI('accounts')
      linkedinAccounts = allAccounts.items?.filter((account: any) => account.type === 'LINKEDIN') || []
      
      if (linkedinAccounts.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No LinkedIn accounts found in Unipile',
          timestamp: new Date().toISOString()
        }, { status: 404 })
      }
      
      console.log(`📊 Found ${linkedinAccounts.length} LinkedIn accounts to associate`)
    }

    // Process all LinkedIn accounts
    let associationsCreated = 0
    let accountsAlreadyAssociated = 0
    const results = []

    for (const accountDetails of linkedinAccounts) {
      console.log(`📋 Processing account:`, {
        id: accountDetails.id,
        name: accountDetails.name || accountDetails.connection_params?.im?.username,
        status: accountDetails.status
      })

      // Check for existing associations in this workspace
      const { data: existingAssociation } = await supabase
        .from('workspace_accounts')
        .select('id, account_name')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .eq('unipile_account_id', accountDetails.id)
        .single()

      if (existingAssociation) {
        console.log(`✅ Account ${accountDetails.id} already associated`)
        accountsAlreadyAssociated++
        results.push({
          account_id: accountDetails.id,
          status: 'already_associated',
          account_name: existingAssociation.account_name
        })
        continue
      }

      // Determine LinkedIn experience type
      let linkedinExperience = 'classic'
      if (accountDetails.connection_params?.product_type) {
        const productType = accountDetails.connection_params.product_type.toLowerCase()
        if (productType.includes('sales')) {
          linkedinExperience = 'sales_navigator'
        } else if (productType.includes('recruiter')) {
          linkedinExperience = 'recruiter'
        }
      }

      // Create the association
      const accountName = accountDetails.name || accountDetails.connection_params?.im?.username || 'LinkedIn Account'
      const accountIdentifier = accountDetails.connection_params?.im?.email || 
                               accountDetails.connection_params?.im?.public_identifier ||
                               accountName
      
      const { data: newAssociation, error: insertError } = await supabase
        .from('workspace_accounts')
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          account_type: 'linkedin',
          account_identifier: accountIdentifier,
          account_name: accountName,
          unipile_account_id: accountDetails.id,
          connection_status: 'connected',
          metadata: {
            linkedin_experience: linkedinExperience,
            linkedin_public_identifier: accountDetails.connection_params?.im?.public_identifier,
            linkedin_profile_url: accountDetails.connection_params?.im?.profile_url || 
              (accountDetails.connection_params?.im?.public_identifier ? 
                `https://linkedin.com/in/${accountDetails.connection_params.im.public_identifier}` : null),
            account_email: accountDetails.connection_params?.im?.email,
            connection_method: 'manual_association',
            product_type: accountDetails.connection_params?.product_type
          }
        })
        .select()
        .single()

      if (insertError) {
        console.error(`❌ Failed to create association for ${accountDetails.id}:`, insertError)
        results.push({
          account_id: accountDetails.id,
          status: 'failed',
          error: insertError.message,
          account_name: accountName
        })
        continue
      }

      console.log(`✅ Successfully created manual association for ${accountName}`)
      associationsCreated++
      results.push({
        account_id: accountDetails.id,
        status: 'created',
        account_name: accountName,
        linkedin_experience: linkedinExperience
      })
    }

    return NextResponse.json({
      success: true,
      message: `Manual association completed`,
      accounts_found: linkedinAccounts.length,
      associations_created: associationsCreated,
      accounts_already_associated: accountsAlreadyAssociated,
      results: results,
      workspace_id: workspaceId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('💥 Manual association error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Manual association failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}