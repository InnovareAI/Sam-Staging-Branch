import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/workspace/set-current
 * Updates the user's current_workspace_id in the users table
 */
export async function POST(request: NextRequest) {
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
            } catch {}
          }
        }
      }
    )

    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceId } = await request.json()

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
    }

    console.log('[workspace/set-current] Setting current workspace:', {
      userId: session.user.id,
      userEmail: session.user.email,
      workspaceId
    })

    // Verify user has access to this workspace
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

    const { data: membership } = await supabaseAdmin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .single()

    if (!membership) {
      console.error('[workspace/set-current] User not a member of workspace:', workspaceId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update current_workspace_id in users table
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ current_workspace_id: workspaceId, updated_at: new Date().toISOString() })
      .eq('id', session.user.id)

    if (updateError) {
      console.error('[workspace/set-current] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 })
    }

    console.log('[workspace/set-current] Successfully updated current_workspace_id')

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[workspace/set-current] Exception:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
