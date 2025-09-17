import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Auto-associate existing Unipile LinkedIn accounts with SAM AI workspaces
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

    console.log(`🔗 Auto-association request from user: ${user.email}`)

    // Get user's current workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    if (!userProfile?.current_workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'No active workspace - please switch to a workspace first',
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }

    const workspaceId = userProfile.current_workspace_id

    // Get Unipile configuration
    const unipileDsn = process.env.UNIPILE_DSN
    const unipileApiKey = process.env.UNIPILE_API_KEY

    if (!unipileDsn || !unipileApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Unipile configuration missing',
        timestamp: new Date().toISOString()
      }, { status: 503 })
    }

    // Fetch all Unipile accounts
    const unipileResponse = await fetch(`https://${unipileDsn}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': unipileApiKey
      }
    })

    if (!unipileResponse.ok) {
      throw new Error(`Unipile API error: ${unipileResponse.status}`)
    }

    const unipileData = await unipileResponse.json()
    const linkedinAccounts = unipileData.items?.filter((account: any) => account.type === 'LINKEDIN') || []

    console.log(`📋 Found ${linkedinAccounts.length} LinkedIn accounts in Unipile`)

    // Check existing associations in this workspace
    const { data: existingAssociations } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin')

    const existingAccountIds = new Set(existingAssociations?.map(a => a.unipile_account_id) || [])

    let associatedCount = 0
    const newAssociations = []

    // Process each LinkedIn account for potential association
    for (const account of linkedinAccounts) {
      // Skip if already associated
      if (existingAccountIds.has(account.id)) {
        console.log(`⏭️  Skipping ${account.name} - already associated`)
        continue
      }

      // Get user's email domain for matching
      const userEmailDomain = user.email?.split('@')[1]?.toLowerCase()
      
      // Check if account has InnovareAI organization (primary matching criteria)
      const hasInnovareOrg = account.connection_params?.im?.organizations?.some((org: any) => 
        org.name?.toLowerCase().includes('innovareai') || 
        org.name?.toLowerCase().includes('innovare')
      )

      // Additional matching criteria
      const accountEmail = account.connection_params?.im?.username || account.name
      const accountEmailDomain = accountEmail?.includes('@') ? accountEmail.split('@')[1]?.toLowerCase() : null
      const emailDomainMatch = accountEmailDomain && userEmailDomain && accountEmailDomain === userEmailDomain

      // Match logic: InnovareAI organization OR email domain match
      if (hasInnovareOrg || emailDomainMatch) {
        const association = {
          workspace_id: workspaceId,
          user_id: user.id,
          unipile_account_id: account.id,
          account_type: 'linkedin',
          account_name: account.name,
          account_identifier: account.connection_params?.im?.publicIdentifier || account.name,
          connection_status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        newAssociations.push(association)
        associatedCount++

        console.log(`✅ Will associate ${account.name} (${account.id})`)
        console.log(`   - InnovareAI org: ${hasInnovareOrg}`)
        console.log(`   - Email domain match: ${emailDomainMatch}`)
      } else {
        console.log(`❌ No match for ${account.name} - skipping`)
      }
    }

    // Insert new associations if any found
    if (newAssociations.length > 0) {
      const { error: insertError } = await supabase
        .from('workspace_accounts')
        .insert(newAssociations)

      if (insertError) {
        console.error('Error inserting associations:', insertError)
        return NextResponse.json({
          success: false,
          error: `Failed to create associations: ${insertError.message}`,
          timestamp: new Date().toISOString()
        }, { status: 500 })
      }

      console.log(`✅ Successfully associated ${associatedCount} LinkedIn accounts`)
    }

    return NextResponse.json({
      success: true,
      message: `Auto-association complete`,
      total_unipile_accounts: linkedinAccounts.length,
      existing_associations: existingAssociations?.length || 0,
      new_associations: associatedCount,
      workspace_id: workspaceId,
      user_email: user.email,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in auto-association:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// GET method to preview potential associations without creating them
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

    // Get Unipile configuration
    const unipileDsn = process.env.UNIPILE_DSN
    const unipileApiKey = process.env.UNIPILE_API_KEY

    if (!unipileDsn || !unipileApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Unipile configuration missing',
        timestamp: new Date().toISOString()
      }, { status: 503 })
    }

    // Fetch all Unipile accounts
    const unipileResponse = await fetch(`https://${unipileDsn}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': unipileApiKey
      }
    })

    if (!unipileResponse.ok) {
      throw new Error(`Unipile API error: ${unipileResponse.status}`)
    }

    const unipileData = await unipileResponse.json()
    const linkedinAccounts = unipileData.items?.filter((account: any) => account.type === 'LINKEDIN') || []

    // Get user's email domain for matching
    const userEmailDomain = user.email?.split('@')[1]?.toLowerCase()
    
    const potentialMatches = linkedinAccounts.map((account: any) => {
      const hasInnovareOrg = account.connection_params?.im?.organizations?.some((org: any) => 
        org.name?.toLowerCase().includes('innovareai') || 
        org.name?.toLowerCase().includes('innovare')
      )

      const accountEmail = account.connection_params?.im?.username || account.name
      const accountEmailDomain = accountEmail?.includes('@') ? accountEmail.split('@')[1]?.toLowerCase() : null
      const emailDomainMatch = accountEmailDomain && userEmailDomain && accountEmailDomain === userEmailDomain

      return {
        account_id: account.id,
        account_name: account.name,
        account_identifier: account.connection_params?.im?.publicIdentifier,
        status: account.sources?.[0]?.status,
        match_criteria: {
          innovare_org: hasInnovareOrg,
          email_domain_match: emailDomainMatch,
          would_associate: hasInnovareOrg || emailDomainMatch
        },
        organizations: account.connection_params?.im?.organizations?.map((org: any) => org.name) || []
      }
    })

    return NextResponse.json({
      success: true,
      user_email: user.email,
      user_domain: userEmailDomain,
      total_accounts: linkedinAccounts.length,
      potential_matches: potentialMatches,
      associable_count: potentialMatches.filter(m => m.match_criteria.would_associate).length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error previewing associations:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}