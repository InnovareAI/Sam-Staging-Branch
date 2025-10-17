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
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(name)')
      .eq('user_id', session.user.id)

    const workspaces = (memberships || []).map(m => ({ id: m.workspace_id, name: (m as any).workspaces?.name }))
    const current = workspaces.find(w => w.id === user?.current_workspace_id) || null

    return NextResponse.json({ workspaces, current })
  } catch (e) {
    return NextResponse.json({ workspaces: [] })
  }
}
