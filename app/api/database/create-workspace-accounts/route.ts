import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const supabase = pool
    
    console.log('🛠️ Creating workspace_accounts table...')
    
    // Create the table using Supabase
    const { error: tableError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS workspace_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          
          account_type TEXT NOT NULL CHECK (account_type IN ('linkedin', 'email', 'whatsapp', 'instagram')),
          account_identifier TEXT NOT NULL,
          account_name TEXT,
          
          unipile_account_id TEXT,
          connection_status TEXT DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected', 'error', 'suspended')),
          connection_details JSONB DEFAULT '{}',
          metadata JSONB DEFAULT '{}',
          
          daily_message_count INTEGER DEFAULT 0,
          daily_message_limit INTEGER DEFAULT 50,
          monthly_message_count INTEGER DEFAULT 0,
          last_message_sent_at TIMESTAMPTZ,
          last_reset_date DATE DEFAULT CURRENT_DATE,
          
          is_active BOOLEAN DEFAULT true,
          is_primary BOOLEAN DEFAULT false,
          
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          
          UNIQUE(workspace_id, user_id, account_type, account_identifier)
        );
      `
    })
    
    if (tableError) {
      console.log('⚠️ Table creation result:', tableError)
    }
    
    // Now insert the LinkedIn accounts directly
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
      return NextResponse.json({ success: false, error: 'Failed to get users', details: authError }, { status: 500 })
    }
    
    const targetUser = authUsers.users.find((u: any) => u.email === 'tl@innovareai.com')
    
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User tl@innovareai.com not found' }, { status: 404 })
    }
    
    // Get user's workspace
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', targetUser.id)
      .single()
    
    if (profileError || !userProfile?.current_workspace_id) {
      return NextResponse.json({ success: false, error: 'No workspace found for user', details: profileError }, { status: 400 })
    }
    
    const workspaceId = userProfile.current_workspace_id
    
    // Insert LinkedIn accounts directly
    const results = []
    for (const account of linkedinAccounts) {
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
        metadata: {
          linkedin_experience: 'classic',
          connection_method: 'direct_insert',
          inserted_timestamp: now
        }
      }
      
      const { data: newAccount, error: insertError } = await supabase
        .from('workspace_accounts')
        .insert(insertData)
        .select()
        .single()
      
      results.push({
        account: account.name,
        success: !insertError,
        error: insertError?.message || null,
        data: newAccount || null
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Direct LinkedIn account insertion completed',
      table_created: !tableError,
      user_id: targetUser.id,
      workspace_id: workspaceId,
      results
    })
    
  } catch (error) {
    console.error('💥 Database creation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Database operation failed'
    }, { status: 500 })
  }
}