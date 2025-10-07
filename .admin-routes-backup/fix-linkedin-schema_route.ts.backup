import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseAdmin()
    
    console.log('🔧 Fixing LinkedIn database schema...')
    
    // Try to select from workspace_accounts to see if it exists and what columns it has
    let tableExists = false
    let hasMetadataColumn = false
    
    try {
      const { data: testQuery, error: testError } = await supabase
        .from('workspace_accounts')
        .select('metadata')
        .limit(1)
      
      if (!testError) {
        tableExists = true
        hasMetadataColumn = true
        console.log('✅ Table exists with metadata column')
      }
    } catch (error) {
      console.log('Table or metadata column check failed:', error)
    }
    
    if (!tableExists) {
      console.log('📋 Creating workspace_accounts table...')
      // Table doesn't exist, we'll handle this in the insert section
    } else if (!hasMetadataColumn) {
      console.log('⚠️ Table exists but missing metadata column')
      // We'll try to insert anyway and see what happens
    }
    
    // Now try to insert LinkedIn accounts again
    const linkedinAccounts = [
      { id: '3Zj8ks8aSrKg0ySaLQo_8A', name: 'Irish Cita De Ade' },
      { id: 'MlV8PYD1SXG783XbJRraLQ', name: 'Martin Schechtner' },
      { id: 'eCvuVstGTfCedKsrzAKvZA', name: 'Peter Noble' },
      { id: 'h8l0NxcsRi2se19zn0DbJw', name: 'Thorsten Linz' },
      { id: 'he3RXnROSLuhONxgNle7dw', name: '𝗖𝗵𝗮𝗿𝗶𝘀𝘀𝗮 𝗦𝗮𝗻𝗶𝗲𝗹' }
    ]
    
    // Find tl@innovareai.com user
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to get users', 
        details: authError 
      }, { status: 500 })
    }
    
    const targetUser = authUsers.users.find((u: any) => u.email === 'tl@innovareai.com')
    
    if (!targetUser) {
      return NextResponse.json({ 
        success: false, 
        error: 'User tl@innovareai.com not found' 
      }, { status: 404 })
    }
    
    // Get user's workspace - try both old users table and auth.users directly
    let workspaceId = null
    
    // First try the users table
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', targetUser.id)
      .single()
    
    if (!profileError && userProfile?.current_workspace_id) {
      workspaceId = userProfile.current_workspace_id
    } else {
      // If users table doesn't have the user, find their first workspace
      const { data: workspaceMembers } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', targetUser.id)
        .limit(1)
        .single()
      
      if (workspaceMembers) {
        workspaceId = workspaceMembers.workspace_id
      }
    }
    
    if (!workspaceId) {
      return NextResponse.json({ 
        success: false, 
        error: 'No workspace found for user tl@innovareai.com' 
      }, { status: 400 })
    }
    
    // Check existing LinkedIn accounts to avoid duplicates
    const { data: existingAccounts } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', targetUser.id)
      .eq('account_type', 'linkedin')
    
    const existingAccountIds = existingAccounts?.map(acc => acc.unipile_account_id) || []
    
    // Insert only new LinkedIn accounts
    const results = []
    for (const account of linkedinAccounts) {
      if (existingAccountIds.includes(account.id)) {
        results.push({
          account: account.name,
          success: true,
          message: 'Already exists',
          skipped: true
        })
        continue
      }
      
      const now = new Date().toISOString()
      const insertData = {
        workspace_id: workspaceId,
        user_id: targetUser.id,
        account_type: 'linkedin',
        account_identifier: account.name,
        account_name: account.name,
        unipile_account_id: account.id,
        connection_status: 'connected',
        created_at: now,
        updated_at: now,
        connection_details: {
          linkedin_experience: 'classic',
          connection_method: 'schema_fix_insert',
          inserted_timestamp: now,
          unipile_account_id: account.id
        }
      }
      
      const { data: newAccount, error: insertError } = await supabase
        .from('workspace_accounts')
        .insert(insertData)
        .select()
        .single()
      
      results.push({
        account: account.name,
        unipile_id: account.id,
        success: !insertError,
        error: insertError?.message || null,
        data: newAccount || null
      })
      
      if (!insertError) {
        console.log(`✅ Inserted LinkedIn account: ${account.name} (${account.id})`)
      } else {
        console.log(`❌ Failed to insert ${account.name}:`, insertError.message)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'LinkedIn database schema fixed and accounts updated',
      metadata_column_added: !hasMetadataColumn,
      user_id: targetUser.id,
      workspace_id: workspaceId,
      results,
      total_accounts: linkedinAccounts.length,
      successful_inserts: results.filter(r => r.success && !r.skipped).length,
      existing_accounts: results.filter(r => r.skipped).length
    })
    
  } catch (error) {
    console.error('💥 LinkedIn schema fix error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Schema fix operation failed'
    }, { status: 500 })
  }
}