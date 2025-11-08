import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * DEBUG ENDPOINT: Get user's workspaces and current context
 */
export async function GET(request: NextRequest) {
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
            cookiesToSet.forEach(({ name, value, options}) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get all workspaces user has access to
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspace_members')
      .select(`
        workspace_id,
        role,
        workspaces (
          id,
          name,
          client_code
        )
      `)
      .eq('user_id', user.id)

    if (workspacesError) {
      console.error('Error fetching workspaces:', workspacesError)
      return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      workspaces: workspaces?.map(w => ({
        workspace_id: w.workspace_id,
        role: w.role,
        name: w.workspaces?.name,
        client_code: w.workspaces?.client_code
      })) || []
    })

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
