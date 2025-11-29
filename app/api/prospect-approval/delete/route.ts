import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/app/lib/supabase'

/**
 * DELETE /api/prospect-approval/delete?prospect_id=xxx
 * Permanently deletes a prospect from prospect_approval_data OR workspace_prospects
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const prospectId = searchParams.get('prospect_id')

    if (!prospectId) {
      return NextResponse.json({
        success: false,
        error: 'Prospect ID required'
      }, { status: 400 })
    }

    // Use @supabase/ssr createServerClient (matches browser client)
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      }
    )

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Get user's workspace
    const adminClient = supabaseAdmin()
    const { data: userProfile } = await adminClient
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    let workspaceId = userProfile?.current_workspace_id

    // Fallback: get first workspace from memberships
    // CRITICAL FIX: Use adminClient to bypass RLS (Nov 28)
    if (!workspaceId) {
      const { data: membership } = await adminClient
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      workspaceId = membership?.workspace_id
    }

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found'
      }, { status: 404 })
    }

    const userEmail = user.email?.toLowerCase() || ''
    const isSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(userEmail)

    // Try prospect_approval_data first (DataCollectionHub uses this table)
    // CRITICAL FIX (Nov 29): Frontend sends UUID `id`, but we also support legacy `prospect_id` (csv_xxx)
    // Try both columns - first by UUID `id`, then by text `prospect_id`
    let approvalProspect = null

    // Try 1: Search by UUID `id` column (frontend sends this)
    const { data: byId } = await adminClient
      .from('prospect_approval_data')
      .select('id, prospect_id, workspace_id')
      .eq('id', prospectId)
      .maybeSingle()

    if (byId) {
      approvalProspect = byId
    } else {
      // Try 2: Search by text `prospect_id` column (legacy csv_xxx format)
      const { data: byProspectId } = await adminClient
        .from('prospect_approval_data')
        .select('id, prospect_id, workspace_id')
        .eq('prospect_id', prospectId)
        .maybeSingle()

      approvalProspect = byProspectId
    }

    if (approvalProspect) {
      // Security check
      if (!isSuperAdmin && approvalProspect.workspace_id !== workspaceId) {
        return NextResponse.json({
          success: false,
          error: 'Access denied - prospect belongs to different workspace'
        }, { status: 403 })
      }

      // Delete by the actual UUID `id`, not the text `prospect_id`
      const { error: deleteError } = await adminClient
        .from('prospect_approval_data')
        .delete()
        .eq('id', approvalProspect.id)

      if (deleteError) {
        console.error('Delete error (prospect_approval_data):', deleteError)
        return NextResponse.json({
          success: false,
          error: 'Failed to delete prospect'
        }, { status: 500 })
      }

      console.log(`✅ Prospect ${approvalProspect.prospect_id} (UUID: ${approvalProspect.id}) deleted from prospect_approval_data by ${user.email}`)
      return NextResponse.json({
        success: true,
        message: 'Prospect deleted successfully'
      })
    }

    // Fallback: try workspace_prospects
    const { data: workspaceProspect } = await adminClient
      .from('workspace_prospects')
      .select('id, workspace_id')
      .eq('id', prospectId)
      .maybeSingle()

    if (workspaceProspect) {
      // Security check
      if (!isSuperAdmin && workspaceProspect.workspace_id !== workspaceId) {
        return NextResponse.json({
          success: false,
          error: 'Access denied - prospect belongs to different workspace'
        }, { status: 403 })
      }

      const { error: deleteError } = await adminClient
        .from('workspace_prospects')
        .delete()
        .eq('id', prospectId)

      if (deleteError) {
        console.error('Delete error (workspace_prospects):', deleteError)
        return NextResponse.json({
          success: false,
          error: 'Failed to delete prospect'
        }, { status: 500 })
      }

      console.log(`✅ Prospect ${prospectId} deleted from workspace_prospects by ${user.email}`)
      return NextResponse.json({
        success: true,
        message: 'Prospect deleted successfully'
      })
    }

    // Not found in either table
    return NextResponse.json({
      success: false,
      error: 'Prospect not found'
    }, { status: 404 })

  } catch (error) {
    console.error('Prospect delete error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
