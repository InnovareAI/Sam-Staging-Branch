import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: await cookies() })
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { workspace_id } = await request.json()

    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Verify user has access to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', session.user.id)
      .eq('workspace_id', workspace_id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Update current workspace
    const { error } = await supabase
      .from('users')
      .update({ current_workspace_id: workspace_id })
      .eq('id', session.user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to switch workspace' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Switch workspace error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
