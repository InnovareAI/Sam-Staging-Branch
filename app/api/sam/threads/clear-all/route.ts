/**
 * Clear All Threads API
 * Deletes all conversation threads for the authenticated user
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function DELETE() {
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
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Delete all messages first (foreign key constraint)
    const { error: messagesError } = await supabaseAdmin
      .from('sam_thread_messages')
      .delete()
      .in('thread_id',
        supabaseAdmin
          .from('sam_conversation_threads')
          .select('id')
          .eq('user_id', user.id)
      )

    if (messagesError) {
      console.error('Failed to delete messages:', messagesError)
    }

    // Delete all threads for this user
    const { error: threadsError } = await supabaseAdmin
      .from('sam_conversation_threads')
      .delete()
      .eq('user_id', user.id)

    if (threadsError) {
      console.error('Failed to delete threads:', threadsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to clear threads'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'All threads cleared'
    })

  } catch (error) {
    console.error('Clear threads API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
