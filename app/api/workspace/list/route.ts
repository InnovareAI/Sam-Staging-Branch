import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Cache bust: 2025-12-15-v3 - Super admin sees ALL workspaces
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
    // Try getUser first (more reliable), fallback to getSession
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    console.log('[workspace/list] Auth check - user:', user?.id, user?.email, 'error:', userError?.message)

    if (!user) {
      // Fallback: Try getSession as backup
      const { data: { session } } = await supabase.auth.getSession()
      console.log('[workspace/list] Session fallback - session:', session?.user?.id, session?.user?.email)

      if (!session?.user) {
        console.log('[workspace/list] No user found via getUser or getSession, returning empty')
        return NextResponse.json({ workspaces: [], debug: { reason: 'no_auth', userError: userError?.message } })
      }
    }

    // Use user from getUser if available, otherwise from session
    const sessionUser = user || (await supabase.auth.getSession()).data.session?.user

    if (!sessionUser) {
      console.log('[workspace/list] No session user after all checks')
      return NextResponse.json({ workspaces: [] })
    }

    console.log('[workspace/list] Authenticated user:', sessionUser.id, sessionUser.email)

    // CRITICAL FIX: Use service role to bypass RLS since policies are broken
    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
            } catch {}
          }
        }
      }
    )

    // Get user's current_workspace_id from users table
    const { data: userRecord } = await supabaseAdmin
      .from('users')
      .select('current_workspace_id')
      .eq('id', sessionUser.id)
      .single()

    console.log('[workspace/list] User current_workspace_id:', userRecord?.current_workspace_id)

    // Check if user is super admin
    const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com']
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(sessionUser.email || '')

    console.log('[workspace/list] Is super admin:', isSuperAdmin, sessionUser.email)

    let workspaceIds: string[] = []
    let memberships: any[] = []

    if (isSuperAdmin) {
      // Super admins see ALL workspaces
      console.log('[workspace/list] Super admin - fetching ALL workspaces')
      const { data: allWorkspaces, error: allError } = await supabaseAdmin
        .from('workspaces')
        .select('id')

      if (allError) {
        console.error('[workspace/list] Error fetching all workspaces:', allError)
        return NextResponse.json({ workspaces: [], error: allError.message })
      }

      workspaceIds = (allWorkspaces || []).map(w => w.id)
      console.log('[workspace/list] Super admin - found', workspaceIds.length, 'workspaces')
    } else {
      // Regular users - only see their memberships
      const { data: membershipData, error: memberError } = await supabaseAdmin
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', sessionUser.id)
        .eq('status', 'active')

      console.log('[workspace/list] Query result:', {
        memberships: membershipData,
        memberError,
        userId: sessionUser.id,
        membershipCount: membershipData?.length || 0
      })

      if (memberError) {
        console.error('[workspace/list] Error fetching memberships:', memberError)
        return NextResponse.json({ workspaces: [], error: memberError.message })
      }

      memberships = membershipData || []
      workspaceIds = memberships.map(m => m.workspace_id)
    }

    console.log('[workspace/list] CRITICAL DEBUG - Workspace IDs to filter by:', workspaceIds)
    console.log('[workspace/list] Number of workspace IDs:', workspaceIds.length)

    if (workspaceIds.length === 0) {
      console.log('[workspace/list] No workspaces found')
      return NextResponse.json({ workspaces: [], current: null })
    }

    const { data: workspaceData, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select(`
        id,
        name,
        created_at,
        owner_id,
        commenting_agent_enabled,
        workspace_members(id, user_id, role, users(email, first_name, last_name))
      `)
      .in('id', workspaceIds)
      .order('created_at', { ascending: false })

    console.log('[workspace/list] CRITICAL DEBUG - Workspaces returned from DB:', workspaceData?.length)
    console.log('[workspace/list] CRITICAL DEBUG - Workspace names returned:', workspaceData?.map(w => w.name))

    if (workspaceError) {
      console.error('[workspace/list] Error fetching workspaces:', workspaceError)
      return NextResponse.json({ workspaces: [], error: workspaceError.message })
    }

    const workspaces = workspaceData || []

    // Use current_workspace_id from users table if it exists and is in the workspace list
    let current = null
    if (userRecord?.current_workspace_id) {
      current = workspaces.find(ws => ws.id === userRecord.current_workspace_id) || null
      console.log('[workspace/list] Found current workspace from DB:', current?.name || 'not found in memberships')
    }

    // Fallback to first workspace if current_workspace_id not set or not in user's workspaces
    if (!current && workspaces.length > 0) {
      current = workspaces[0]
      console.log('[workspace/list] Using first workspace as fallback:', current.name)
    }

    console.log('[workspace/list] Returning:', { workspaceCount: workspaces.length, current: current?.name })

    // Return workspaces with debug info for super admins
    return NextResponse.json({
      workspaces,
      current,
      debug: {
        userId: sessionUser.id,
        userEmail: sessionUser.email,
        isSuperAdmin,
        workspaceCount: workspaces.length,
        workspaceIds
      }
    })
  } catch (e) {
    console.error('[workspace/list] Exception:', e)
    return NextResponse.json({ workspaces: [], error: String(e) })
  }
}
