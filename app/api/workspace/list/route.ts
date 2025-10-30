import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Cookie setting can fail in middleware context
            }
          }
        }
      }
    )
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ workspaces: [] })

    // Fetch current workspace
    const { data: user } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', session.user.id)
      .single()

    // Fetch accessible workspaces - using separate queries instead of join
    const { data: memberships, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', session.user.id)
      .eq('status', 'active')

    if (memberError) {
      console.error('[workspace/list] Error fetching memberships:', memberError)
      return NextResponse.json({ workspaces: [], error: memberError.message })
    }

    console.log('[workspace/list] Memberships:', memberships)

    // Fetch workspace details separately
    const workspaceIds = (memberships || []).map(m => m.workspace_id)

    if (workspaceIds.length === 0) {
      console.log('[workspace/list] No workspace memberships found')
      return NextResponse.json({ workspaces: [], current: null })
    }

    const { data: workspaceData, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name')
      .in('id', workspaceIds)

    if (workspaceError) {
      console.error('[workspace/list] Error fetching workspaces:', workspaceError)
      return NextResponse.json({ workspaces: [], error: workspaceError.message })
    }

    const workspaces = workspaceData || []
    const current = workspaces.find(w => w.id === user?.current_workspace_id) || workspaces[0] || null

    console.log('[workspace/list] Returning:', { workspaceCount: workspaces.length, current })
    return NextResponse.json({ workspaces, current })
  } catch (e) {
    console.error('[workspace/list] Exception:', e)
    return NextResponse.json({ workspaces: [], error: String(e) })
  }
}
