import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies: await cookies() })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ workspaces: [] })

    // Fetch current workspace
    const { data: user } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', session.user.id)
      .single()

    // Fetch accessible workspaces
    const { data: memberships, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces!inner(id, name)')
      .eq('user_id', session.user.id)

    if (memberError) {
      console.error('[workspace/list] Error fetching memberships:', memberError)
      return NextResponse.json({ workspaces: [], error: memberError.message })
    }

    console.log('[workspace/list] Raw memberships:', memberships)

    const workspaces = (memberships || []).map(m => ({ 
      id: m.workspace_id, 
      name: (m as any).workspaces?.name || 'Unknown' 
    }))
    const current = workspaces.find(w => w.id === user?.current_workspace_id) || null

    console.log('[workspace/list] Returning:', { workspaceCount: workspaces.length, current })
    return NextResponse.json({ workspaces, current })
  } catch (e) {
    console.error('[workspace/list] Exception:', e)
    return NextResponse.json({ workspaces: [], error: String(e) })
  }
}
