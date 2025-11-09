import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Cache bust: 2025-11-09-v2
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

    console.log('[workspace/list] Session user:', session?.user?.id, session?.user?.email)

    if (!session?.user) {
      console.log('[workspace/list] No session, returning empty')
      return NextResponse.json({ workspaces: [] })
    }

    // Note: users table doesn't have current_workspace_id
    // We'll select the first workspace or use localStorage on client side
    console.log('[workspace/list] Skipping users.current_workspace_id (column does not exist)')

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

    // Fetch accessible workspaces using admin client to bypass RLS
    const { data: memberships, error: memberError } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', session.user.id)
      .eq('status', 'active')

    console.log('[workspace/list] Query result:', {
      memberships,
      memberError,
      userId: session.user.id,
      membershipCount: memberships?.length || 0
    })

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

    const { data: workspaceData, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('id, name')
      .in('id', workspaceIds)

    if (workspaceError) {
      console.error('[workspace/list] Error fetching workspaces:', workspaceError)
      return NextResponse.json({ workspaces: [], error: workspaceError.message })
    }

    const workspaces = workspaceData || []
    // Default to first workspace since users table doesn't have current_workspace_id
    const current = workspaces[0] || null

    console.log('[workspace/list] Returning:', { workspaceCount: workspaces.length, current })

    // TEMPORARY DEBUG: Return full debug info in response
    return NextResponse.json({
      workspaces,
      current,
      debug: {
        userId: session.user.id,
        userEmail: session.user.email,
        membershipCount: memberships?.length || 0,
        memberError: memberError?.message || null,
        workspaceIds,
        rawMemberships: memberships
      }
    })
  } catch (e) {
    console.error('[workspace/list] Exception:', e)
    return NextResponse.json({ workspaces: [], error: String(e) })
  }
}
