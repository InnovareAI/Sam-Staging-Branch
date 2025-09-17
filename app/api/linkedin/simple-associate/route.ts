import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    console.log(`🚀 SIMPLE LinkedIn association for user ${user.email} (${user.id})`)

    // Get user's current workspace
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
    console.log(`👤 User workspace: ${workspaceId}`)

    // Try to create just one account first to test
    const testAccount = { 
      id: '3Zj8ks8aSrKg0ySaLQo_8A', 
      name: 'Irish Cita De Ade' 
    }

    console.log(`🔍 Testing single account creation: ${testAccount.name}`)

    // First check what's already in workspace_accounts
    const { data: existingAccounts, error: checkError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)

    console.log(`📊 Existing accounts in workspace:`, existingAccounts?.length || 0)
    if (checkError) {
      console.error('❌ Error checking existing accounts:', checkError)
    }

    // Try the minimal insert with all required fields
    const now = new Date().toISOString()
    const insertData = {
      workspace_id: workspaceId,
      user_id: user.id,
      account_type: 'linkedin',
      account_identifier: testAccount.name,
      account_name: testAccount.name,
      unipile_account_id: testAccount.id,
      connection_status: 'connected',
      created_at: now,
      updated_at: now,
      metadata: {
        linkedin_experience: 'classic',
        connection_method: 'simple_test',
        test_account: true,
        timestamp: now
      }
    }

    console.log(`📝 Inserting data:`, insertData)

    const { data: newAccount, error: insertError } = await supabase
      .from('workspace_accounts')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error(`❌ Insert failed:`, insertError)
      return NextResponse.json({
        success: false,
        error: `Database insert failed: ${insertError.message || JSON.stringify(insertError)}`,
        details: insertError,
        insert_data: insertData,
        error_code: insertError.code,
        error_hint: insertError.hint
      }, { status: 500 })
    }

    console.log(`✅ Successfully created account:`, newAccount)

    return NextResponse.json({
      success: true,
      message: 'Simple association test successful',
      account_created: newAccount,
      workspace_id: workspaceId,
      user_email: user.email
    })

  } catch (error) {
    console.error('💥 Simple association error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Simple association failed',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}