import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { apiError, handleApiError, apiSuccess } from '@/lib/api-error-handler'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const supabase = supabaseAdmin()
    const { workspaceId } = await params

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw apiError.unauthorized()
    }

    // Verify user has access to this workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      throw apiError.forbidden('Access denied to this workspace')
    }

    // Get all workspace accounts with user details
    const { data: accounts, error } = await supabase
      .from('user_workspace_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('user_email', { ascending: true })
      .order('account_type', { ascending: true })

    if (error) {
      throw apiError.database('workspace accounts fetch', error)
    }

    // Get workspace account sessions to show current selections
    const { data: sessions } = await supabase
      .from('workspace_account_sessions')
      .select('*')
      .eq('workspace_id', workspaceId)

    // Add session info to accounts
    const accountsWithSessions = (accounts || []).map(account => {
      const session = sessions?.find(s => s.user_id === account.user_id)
      const isSelected = session && (
        (account.account_type === 'linkedin' && session.current_linkedin_account === account.id) ||
        (account.account_type === 'email' && session.current_email_account === account.id) ||
        (account.account_type === 'whatsapp' && session.current_whatsapp_account === account.id)
      )

      return {
        ...account,
        is_currently_selected: Boolean(isSelected)
      }
    })

    return apiSuccess({
      accounts: accountsWithSessions,
      workspace_id: workspaceId,
      user_role: membership.role
    })

  } catch (error) {
    return handleApiError(error, 'get_workspace_accounts')
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const supabase = supabaseAdmin()
    const { workspaceId } = await params
    const body = await request.json()

    const {
      account_type,
      account_identifier,
      account_name,
      unipile_account_id,
      daily_message_limit = 50,
      is_primary = false
    } = body

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw apiError.unauthorized()
    }

    // Verify user has access to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      throw apiError.forbidden('Access denied to this workspace')
    }

    // Create workspace account
    const { data: account, error } = await supabase
      .from('workspace_accounts')
      .insert({
        workspace_id: workspaceId,
        user_id: user.id,
        account_type,
        account_identifier,
        account_name,
        unipile_account_id,
        connection_status: unipile_account_id ? 'connected' : 'disconnected',
        daily_message_limit,
        is_primary
      })
      .select()
      .single()

    if (error) {
      throw apiError.database('workspace account creation', error)
    }

    return apiSuccess({ account }, 'Account added successfully')

  } catch (error) {
    return handleApiError(error, 'add_workspace_account')
  }
}