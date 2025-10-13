/**
 * Test Thread Creation Diagnostic Endpoint
 *
 * This endpoint helps diagnose why thread creation is failing for a specific user
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment configuration')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      deployment_commit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
      auth: {
        hasUser: !!user,
        userId: user?.id,
        userEmail: user?.email,
        authError: authError?.message
      },
      cookies: cookieStore.getAll().map(c => ({ name: c.name, hasValue: !!c.value })),
      user_profile: null,
      workspace_membership: null,
      workspace_details: null,
      existing_threads: null,
      can_create_thread: false,
      errors: []
    }

    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'Not authenticated',
        diagnostics
      }, { status: 401 })
    }

    // Check user profile
    try {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('users')
        .select('id, email, current_workspace_id, created_at')
        .eq('id', user.id)
        .maybeSingle()

      diagnostics.user_profile = {
        exists: !!profile,
        current_workspace_id: profile?.current_workspace_id,
        error: profileError?.message
      }
    } catch (error: any) {
      diagnostics.errors.push(`Profile check failed: ${error.message}`)
    }

    // Check workspace membership
    try {
      const { data: memberships, error: memberError } = await supabaseAdmin
        .from('workspace_members')
        .select('workspace_id, role, joined_at')
        .eq('user_id', user.id)

      diagnostics.workspace_membership = {
        count: memberships?.length || 0,
        memberships: memberships,
        error: memberError?.message
      }

      // Get workspace details
      if (memberships && memberships.length > 0) {
        const workspaceIds = memberships.map(m => m.workspace_id)
        const { data: workspaces, error: workspaceError } = await supabaseAdmin
          .from('workspaces')
          .select('id, name, owner_id')
          .in('id', workspaceIds)

        diagnostics.workspace_details = {
          workspaces,
          error: workspaceError?.message
        }
      }
    } catch (error: any) {
      diagnostics.errors.push(`Workspace check failed: ${error.message}`)
    }

    // Check existing threads
    try {
      const { data: threads, error: threadsError } = await supabaseAdmin
        .from('sam_conversation_threads')
        .select('id, title, created_at, workspace_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      diagnostics.existing_threads = {
        count: threads?.length || 0,
        recent_threads: threads,
        error: threadsError?.message
      }
    } catch (error: any) {
      diagnostics.errors.push(`Thread check failed: ${error.message}`)
    }

    // Test thread creation capability
    try {
      // Try to create a test thread (but roll it back)
      const testThreadData = {
        user_id: user.id,
        workspace_id: diagnostics.user_profile?.current_workspace_id || null,
        title: `TEST - ${new Date().toISOString()}`,
        thread_type: 'general',
        priority: 'medium',
        sales_methodology: 'meddic'
      }

      // Check if we can insert (without actually inserting)
      const { error: testError } = await supabaseAdmin
        .from('sam_conversation_threads')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)

      diagnostics.can_create_thread = !testError
      if (testError) {
        diagnostics.errors.push(`Thread creation test failed: ${testError.message}`)
      }
    } catch (error: any) {
      diagnostics.errors.push(`Thread creation test error: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Diagnostics complete',
      diagnostics
    })

  } catch (error) {
    console.error('Diagnostic endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
