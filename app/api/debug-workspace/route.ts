import { NextResponse } from 'next/server'
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

    // Get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({
        error: 'No session',
        sessionError,
        cookies: cookieStore.getAll().map(c => ({ name: c.name, value: c.value.substring(0, 20) + '...' }))
      })
    }

    // Test direct query to workspace_members
    const { data: memberships, error: memberError } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('user_id', session.user.id)

    // Also check RLS by using service role
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

    const { data: adminMemberships } = await supabaseAdmin
      .from('workspace_members')
      .select('*')
      .eq('user_id', session.user.id)

    return NextResponse.json({
      success: true,
      session: {
        userId: session.user.id,
        email: session.user.email
      },
      rlsQuery: {
        data: memberships,
        error: memberError,
        count: memberships?.length || 0
      },
      adminQuery: {
        data: adminMemberships,
        count: adminMemberships?.length || 0
      },
      comparison: {
        rlsBlocking: (memberships?.length || 0) === 0 && (adminMemberships?.length || 0) > 0,
        message: (memberships?.length || 0) === 0 && (adminMemberships?.length || 0) > 0
          ? 'RLS is blocking your access! Policies need adjustment.'
          : 'RLS is working correctly.'
      }
    })

  } catch (e) {
    return NextResponse.json({
      error: 'Exception',
      message: String(e)
    })
  }
}
