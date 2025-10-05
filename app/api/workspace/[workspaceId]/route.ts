import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/app/lib/supabase'

/**
 * GET /api/workspace/[workspaceId]
 *
 * Fetch workspace details including name, members, and subscription info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const supabase = createServerClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceId } = params

    // Verify user is a member of this workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Forbidden: Not a member of this workspace' }, { status: 403 })
    }

    // Fetch workspace details
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, slug, created_at, owner_id')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Fetch workspace members count
    const { count: memberCount } = await supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)

    // Fetch subscription info (if exists)
    const { data: subscription } = await supabase
      .from('workspace_subscriptions')
      .select('status, plan, trial_end')
      .eq('workspace_id', workspaceId)
      .single()

    return NextResponse.json({
      workspace: {
        ...workspace,
        memberCount: memberCount || 1,
        subscription: subscription || null,
        userRole: member.role
      }
    })

  } catch (error) {
    console.error('Workspace fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch workspace' },
      { status: 500 }
    )
  }
}
