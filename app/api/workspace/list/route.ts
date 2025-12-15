import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'

// Cache bust: 2025-12-15-v8 - Debug auth token path, fixed token passthrough
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const headersList = await headers()

    // Log all headers for debugging
    const allHeaders: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      allHeaders[key] = key.toLowerCase() === 'authorization' ? `Bearer ${value.slice(7, 20)}...` : value
    })
    console.log('[workspace/list] Request headers:', JSON.stringify(allHeaders))
    console.log('[workspace/list] Cookie count:', cookieStore.getAll().length)

    let sessionUser: { id: string; email?: string } | null = null
    let authMethod = 'none'

    // Method 1: Try Authorization header first (most reliable for SPA)
    const authHeader = headersList.get('authorization') || request.headers.get('authorization')
    console.log('[workspace/list] Auth header present:', !!authHeader, authHeader ? `${authHeader.slice(0, 30)}...` : 'none')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      console.log('[workspace/list] Found Authorization header, verifying token...')

      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      )

      const { data: { user: tokenUser }, error: tokenError } = await supabaseWithToken.auth.getUser()
      if (tokenUser) {
        sessionUser = tokenUser
        authMethod = 'bearer_token'
        console.log('[workspace/list] Auth via Bearer token:', tokenUser.id, tokenUser.email)
      } else {
        console.log('[workspace/list] Bearer token invalid:', tokenError?.message)
      }
    }

    // Method 2: Try cookie-based auth if Bearer didn't work
    if (!sessionUser) {
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

      // Try getUser first (more reliable)
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      console.log('[workspace/list] Cookie auth - getUser:', user?.id, user?.email, 'error:', userError?.message)

      if (user) {
        sessionUser = user
        authMethod = 'cookie_getUser'
      } else {
        // Fallback: Try getSession as backup
        const { data: { session } } = await supabase.auth.getSession()
        console.log('[workspace/list] Cookie auth - getSession:', session?.user?.id, session?.user?.email)
        if (session?.user) {
          sessionUser = session.user
          authMethod = 'cookie_getSession'
        }
      }
    }

    if (!sessionUser) {
      console.log('[workspace/list] No auth found via any method')
      return NextResponse.json({ workspaces: [], debug: { reason: 'no_auth', authMethod } })
    }

    console.log('[workspace/list] Authenticated user via', authMethod, ':', sessionUser.id, sessionUser.email)

    // CRITICAL FIX: Use createClient (NOT createServerClient) with service role to bypass RLS
    // createServerClient still applies RLS even with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
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
      console.log('[workspace/list] No workspaces found for user:', sessionUser.id, sessionUser.email)
      return NextResponse.json({
        workspaces: [],
        current: null,
        debug: {
          userId: sessionUser.id,
          userEmail: sessionUser.email,
          isSuperAdmin,
          membershipCount: memberships.length,
          reason: 'no_workspace_memberships'
        }
      })
    }

    // CRITICAL FIX (Dec 15): COMPLETELY REMOVED JOINS
    // Use 2 separate queries to avoid "relationship not found" schema errors
    const { data: workspaceData, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, created_at, owner_id, commenting_agent_enabled')
      .in('id', workspaceIds)
      .order('created_at', { ascending: false })

    if (workspaceError) {
      console.error('[workspace/list] Error fetching workspaces:', workspaceError)
      return NextResponse.json({ 
        workspaces: [], 
        error: workspaceError.message,
        debug: { reason: 'workspace_fetch_error', error: workspaceError }
      })
    }

    // Fetch members separately to avoid join issues
    const { data: allMembers, error: membersError } = await supabaseAdmin
      .from('workspace_members')
      .select('id, user_id, role, workspace_id, linkedin_unipile_account_id')
      .in('workspace_id', workspaceIds)
      
    if (membersError) {
       console.error('[workspace/list] Error fetching members:', membersError)
       // Continue without members if that fails
    }

    // Stitch data together in JS
    const workspaces = (workspaceData || []).map(ws => ({
      ...ws,
      workspace_members: (allMembers || []).filter(m => m.workspace_id === ws.id)
    }))

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
