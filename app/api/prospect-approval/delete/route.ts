import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/app/lib/supabase'

/**
 * DELETE /api/prospect-approval/delete?prospect_id=xxx
 * Permanently deletes a prospect from workspace_prospects
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
    if (!workspaceId) {
      const { data: membership } = await supabase
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

    // Verify prospect belongs to user's workspace before deleting
    const { data: prospect, error: prospectError } = await adminClient
      .from('workspace_prospects')
      .select('id, workspace_id')
      .eq('id', prospectId)
      .single()

    if (prospectError || !prospect) {
      return NextResponse.json({
        success: false,
        error: 'Prospect not found'
      }, { status: 404 })
    }

    // Security check: prospect must belong to user's workspace
    const userEmail = user.email?.toLowerCase() || ''
    const isSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(userEmail)

    if (!isSuperAdmin && prospect.workspace_id !== workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied - prospect belongs to different workspace'
      }, { status: 403 })
    }

    // Delete the prospect
    const { error: deleteError } = await adminClient
      .from('workspace_prospects')
      .delete()
      .eq('id', prospectId)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return NextResponse.json({
        success: false,
        error: 'Failed to delete prospect'
      }, { status: 500 })
    }

    console.log(`✅ Prospect ${prospectId} deleted by ${user.email}`)

    return NextResponse.json({
      success: true,
      message: 'Prospect deleted successfully'
    })

  } catch (error) {
    console.error('Prospect delete error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
