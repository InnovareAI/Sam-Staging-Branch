import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// Manual LinkedIn account linking for troubleshooting
export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseAdmin()
    const body = await request.json()
    
    const { email, unipile_account_id } = body
    
    console.log(`🔧 Manual LinkedIn linking requested:`, { email, unipile_account_id })

    if (!email || !unipile_account_id) {
      return NextResponse.json({
        success: false,
        error: 'Email and unipile_account_id required'
      }, { status: 400 })
    }

    // Find user by email
    const { data: user, error: userError } = await supabase.auth.admin.listUsers()
    const targetUser = user?.users?.find((u: any) => u.email === email)
    
    if (!targetUser) {
      return NextResponse.json({
        success: false,
        error: `User not found with email: ${email}`
      }, { status: 404 })
    }

    console.log(`👤 Found user: ${targetUser.id} (${targetUser.email})`)

    // Get user's current workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', targetUser.id)
      .single()

    if (!userProfile?.current_workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'User has no active workspace'
      }, { status: 400 })
    }

    const workspaceId = userProfile.current_workspace_id
    console.log(`🏢 User workspace: ${workspaceId}`)

    // Get account details from Unipile
    const unipileDsn = process.env.UNIPILE_DSN
    const unipileApiKey = process.env.UNIPILE_API_KEY

    if (!unipileDsn || !unipileApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Unipile configuration missing'
      }, { status: 503 })
    }

    const baseUrl = `https://${unipileDsn}/api/v1`
    const response = await fetch(`${baseUrl}/accounts/${unipile_account_id}`, {
      headers: { 'X-API-KEY': unipileApiKey }
    })
    
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `Unipile account not found: ${response.status}`
      }, { status: 404 })
    }
    
    const accountDetails = await response.json()
    console.log(`📋 Unipile account details:`, {
      id: accountDetails.id,
      name: accountDetails.name,
      status: accountDetails.sources?.[0]?.status
    })

    // Check for existing LinkedIn integrations
    const { data: existingIntegrations } = await supabase
      .from('integrations')
      .select('id, credentials')
      .eq('user_id', targetUser.id)
      .eq('provider', 'linkedin')

    if (existingIntegrations?.some(integration => 
      integration.credentials?.unipile_account_id === unipile_account_id)) {
      return NextResponse.json({
        success: false,
        error: 'LinkedIn account already linked'
      }, { status: 409 })
    }

    // Create integrations entry for LinkedIn account
    const accountName = accountDetails.name || accountDetails.connection_params?.im?.username || 'LinkedIn Account'
    const accountIdentifier = accountDetails.connection_params?.im?.email || 
                             accountDetails.connection_params?.im?.public_identifier ||
                             accountName
    
    const { data: newAccount, error: insertError } = await supabase
      .from('integrations')
      .insert({
        user_id: targetUser.id,
        provider: 'linkedin',
        type: 'social',
        status: 'active',
        credentials: {
          unipile_account_id: unipile_account_id,
          account_name: accountName,
          linkedin_public_identifier: accountDetails.connection_params?.im?.public_identifier,
          account_email: accountDetails.connection_params?.im?.email
        },
        settings: {
          workspace_id: workspaceId,
          linkedin_experience: 'classic',
          linkedin_profile_url: accountDetails.connection_params?.im?.public_identifier ? 
            `https://linkedin.com/in/${accountDetails.connection_params.im.public_identifier}` : null,
          connection_method: 'manual_link',
          manual_link_timestamp: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Failed to create workspace account:', insertError)
      return NextResponse.json({
        success: false,
        error: `Database error: ${insertError.message}`
      }, { status: 500 })
    }

    console.log(`✅ Successfully linked LinkedIn account to workspace ${workspaceId}`)

    return NextResponse.json({
      success: true,
      message: 'LinkedIn account successfully linked',
      account: {
        id: newAccount.id,
        name: accountName,
        identifier: accountIdentifier,
        workspace_id: workspaceId,
        unipile_account_id: unipile_account_id
      }
    })

  } catch (error) {
    console.error('❌ Error in manual LinkedIn linking:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}