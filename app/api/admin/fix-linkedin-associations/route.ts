import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Admin tool to fix LinkedIn associations for all affected users
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies })
    
    // Check if user is super admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    const isSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(user.email?.toLowerCase() || '')
    if (!isSuperAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Super admin access required',
        timestamp: new Date().toISOString()
      }, { status: 403 })
    }

    console.log(`🔧 LinkedIn association fix initiated by admin: ${user.email}`)

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

    // Fetch all Unipile LinkedIn accounts
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

    // Get all SAM AI users with InnovareAI workspace
    const { data: allUsers } = await supabase
      .from('users')
      .select(`
        id, 
        email, 
        current_workspace_id,
        workspaces!current_workspace_id (
          id,
          name
        )
      `)

    if (!allUsers || allUsers.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No users found',
        timestamp: new Date().toISOString()
      }, { status: 404 })
    }

    console.log(`👥 Found ${allUsers.length} SAM AI users`)

    // Get existing associations to avoid duplicates
    const { data: existingAssociations } = await supabase
      .from('workspace_accounts')
      .select('user_id, unipile_account_id, workspace_id')
      .eq('account_type', 'linkedin')

    const existingSet = new Set(
      (existingAssociations || []).map(a => `${a.user_id}:${a.unipile_account_id}:${a.workspace_id}`)
    )

    const results = {
      total_unipile_accounts: linkedinAccounts.length,
      total_sam_users: allUsers.length,
      existing_associations: existingAssociations?.length || 0,
      new_associations: 0,
      associations_created: [] as any[],
      users_processed: 0,
      errors: [] as string[]
    }

    // Process each user
    for (const samUser of allUsers) {
      if (!samUser.current_workspace_id) {
        console.log(`⏭️  Skipping ${samUser.email} - no workspace`)
        continue
      }

      results.users_processed++
      const userEmailDomain = samUser.email?.split('@')[1]?.toLowerCase()

      // Find matching LinkedIn accounts for this user
      for (const linkedinAccount of linkedinAccounts) {
        const associationKey = `${samUser.id}:${linkedinAccount.id}:${samUser.current_workspace_id}`
        
        // Skip if association already exists
        if (existingSet.has(associationKey)) {
          continue
        }

        // Check if account has InnovareAI organization
        const hasInnovareOrg = linkedinAccount.connection_params?.im?.organizations?.some((org: any) => 
          org.name?.toLowerCase().includes('innovareai') || 
          org.name?.toLowerCase().includes('innovare')
        )

        // Check email domain match
        const accountEmail = linkedinAccount.connection_params?.im?.username || linkedinAccount.name
        const accountEmailDomain = accountEmail?.includes('@') ? accountEmail.split('@')[1]?.toLowerCase() : null
        const emailDomainMatch = accountEmailDomain && userEmailDomain && accountEmailDomain === userEmailDomain

        // Match logic: InnovareAI organization OR email domain match
        if (hasInnovareOrg || emailDomainMatch) {
          try {
            const association = {
              workspace_id: samUser.current_workspace_id,
              user_id: samUser.id,
              unipile_account_id: linkedinAccount.id,
              account_type: 'linkedin',
              account_name: linkedinAccount.name,
              account_identifier: linkedinAccount.connection_params?.im?.publicIdentifier || linkedinAccount.name,
              connection_status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }

            const { error: insertError } = await supabase
              .from('workspace_accounts')
              .insert([association])

            if (insertError) {
              console.error(`❌ Error associating ${linkedinAccount.name} to ${samUser.email}:`, insertError)
              results.errors.push(`${samUser.email}: ${insertError.message}`)
            } else {
              results.new_associations++
              results.associations_created.push({
                user_email: samUser.email,
                linkedin_account: linkedinAccount.name,
                account_id: linkedinAccount.id,
                workspace_id: samUser.current_workspace_id,
                match_reason: hasInnovareOrg ? 'InnovareAI organization' : 'Email domain match'
              })
              
              console.log(`✅ Associated ${linkedinAccount.name} to ${samUser.email} (${hasInnovareOrg ? 'org' : 'email'} match)`)
            }
          } catch (error) {
            console.error(`❌ Exception associating ${linkedinAccount.name} to ${samUser.email}:`, error)
            results.errors.push(`${samUser.email}: ${error}`)
          }
        }
      }
    }

    console.log(`✅ LinkedIn association fix completed`)
    console.log(`   - Processed ${results.users_processed} users`)
    console.log(`   - Created ${results.new_associations} new associations`)
    console.log(`   - Errors: ${results.errors.length}`)

    return NextResponse.json({
      success: true,
      message: 'LinkedIn association fix completed',
      ...results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in LinkedIn association fix:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// GET method to preview what would be fixed without making changes
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies })
    
    // Check if user is super admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    const isSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(user.email?.toLowerCase() || '')
    if (!isSuperAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Super admin access required',
        timestamp: new Date().toISOString()
      }, { status: 403 })
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

    // Fetch all Unipile LinkedIn accounts
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

    // Get all SAM AI users
    const { data: allUsers } = await supabase
      .from('users')
      .select(`
        id, 
        email, 
        current_workspace_id,
        workspaces!current_workspace_id (
          id,
          name
        )
      `)

    // Get existing associations
    const { data: existingAssociations } = await supabase
      .from('workspace_accounts')
      .select('user_id, unipile_account_id, workspace_id, account_name')
      .eq('account_type', 'linkedin')

    const existingSet = new Set(
      (existingAssociations || []).map(a => `${a.user_id}:${a.unipile_account_id}:${a.workspace_id}`)
    )

    const potentialMatches = []

    // Analyze potential matches
    for (const samUser of allUsers || []) {
      if (!samUser.current_workspace_id) continue

      const userEmailDomain = samUser.email?.split('@')[1]?.toLowerCase()

      for (const linkedinAccount of linkedinAccounts) {
        const associationKey = `${samUser.id}:${linkedinAccount.id}:${samUser.current_workspace_id}`
        
        if (existingSet.has(associationKey)) continue

        const hasInnovareOrg = linkedinAccount.connection_params?.im?.organizations?.some((org: any) => 
          org.name?.toLowerCase().includes('innovareai') || 
          org.name?.toLowerCase().includes('innovare')
        )

        const accountEmail = linkedinAccount.connection_params?.im?.username || linkedinAccount.name
        const accountEmailDomain = accountEmail?.includes('@') ? accountEmail.split('@')[1]?.toLowerCase() : null
        const emailDomainMatch = accountEmailDomain && userEmailDomain && accountEmailDomain === userEmailDomain

        if (hasInnovareOrg || emailDomainMatch) {
          potentialMatches.push({
            user_email: samUser.email,
            user_id: samUser.id,
            workspace_id: samUser.current_workspace_id,
            linkedin_account: linkedinAccount.name,
            linkedin_account_id: linkedinAccount.id,
            linkedin_identifier: linkedinAccount.connection_params?.im?.publicIdentifier,
            match_reason: hasInnovareOrg ? 'InnovareAI organization' : 'Email domain match',
            organizations: linkedinAccount.connection_params?.im?.organizations?.map((org: any) => org.name) || []
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      preview: true,
      total_unipile_accounts: linkedinAccounts.length,
      total_sam_users: allUsers?.length || 0,
      existing_associations: existingAssociations?.length || 0,
      potential_new_associations: potentialMatches.length,
      potential_matches: potentialMatches,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error previewing LinkedIn association fix:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}