/**
 * SAM AI Threaded Conversations API
 *
 * Handles creation and listing of conversation threads
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment configuration')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

interface SupabaseAuthUser {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}

async function ensureUserProfile(user: SupabaseAuthUser) {
  const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (existingProfileError) {
    console.error('Failed to fetch user profile', existingProfileError)
    throw new Error('Unable to load user profile')
  }

  if (existingProfile) {
    return
  }

  const insertPayload: Record<string, unknown> = {
    id: user.id,
    email: user.email || `${user.id}@unknown.local`,
    first_name: user.user_metadata?.first_name ?? null,
    last_name: user.user_metadata?.last_name ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const { error: upsertError } = await supabaseAdmin
    .from('users')
    .upsert(insertPayload, { onConflict: 'id' })

  if (upsertError) {
    console.error('Failed to upsert user profile', upsertError)
    throw new Error('Unable to initialize user profile')
  }
}

async function resolveWorkspaceId(
  authUser: SupabaseAuthUser,
  providedWorkspaceId?: string | null
): Promise<string> {
  const userId = authUser.id

  if (providedWorkspaceId && providedWorkspaceId.trim().length > 0) {
    return providedWorkspaceId
  }

  await ensureUserProfile(authUser)

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('current_workspace_id')
    .eq('id', userId)
    .single()

  if (profileError) {
    console.error('Failed to load user profile', profileError)
    throw new Error('Unable to load user profile')
  }

  if (profile?.current_workspace_id) {
    return profile.current_workspace_id
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    console.error('Failed to inspect workspace membership', membershipError)
    throw new Error('Unable to determine workspace access')
  }

  if (membership?.workspace_id) {
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ current_workspace_id: membership.workspace_id })
      .eq('id', userId)

    if (updateError) {
      console.error('Failed to update current workspace', updateError)
      throw new Error('Unable to persist workspace selection')
    }

    return membership.workspace_id
  }

  const { data: defaultWorkspace, error: workspaceFetchError } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (workspaceFetchError) {
    console.error('Failed to fetch fallback workspace', workspaceFetchError)
    throw new Error('Unable to resolve fallback workspace')
  }

  if (!defaultWorkspace?.id) {
    throw new Error('Workspace not found for user')
  }

  const { error: membershipInsertError } = await supabaseAdmin
    .from('workspace_members')
    .insert({
      workspace_id: defaultWorkspace.id,
      user_id: userId,
      role: 'member',
      joined_at: new Date().toISOString()
    })
    .onConflict('workspace_id,user_id')
    .ignore()

  if (membershipInsertError && membershipInsertError.code !== '23505') {
    console.error('Failed to assign default workspace membership', membershipInsertError)
    throw new Error('Unable to assign default workspace')
  }

  const { error: userUpdateError } = await supabaseAdmin
    .from('users')
    .update({ current_workspace_id: defaultWorkspace.id })
    .eq('id', userId)

  if (userUpdateError) {
    console.error('Failed to set current workspace after assignment', userUpdateError)
    throw new Error('Unable to finalize workspace assignment')
  }

  return defaultWorkspace.id
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Get query parameters for filtering
    const url = new URL(request.url)
    const threadType = url.searchParams.get('type')
    const status = url.searchParams.get('status') || 'active'
    const priority = url.searchParams.get('priority')
    const search = url.searchParams.get('search')
    const tags = url.searchParams.get('tags')?.split(',')

    // Build query
    let query = supabaseAdmin
      .from('sam_conversation_threads')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', status)
      .order('last_active_at', { ascending: false })

    if (threadType) {
      query = query.eq('thread_type', threadType)
    }

    if (priority) {
      query = query.eq('priority', priority)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,prospect_name.ilike.%${search}%,prospect_company.ilike.%${search}%`)
    }

    if (tags?.length) {
      query = query.overlaps('tags', tags)
    }

    const { data: threads, error } = await query

    if (error) {
      console.error('Failed to load threads:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to load conversation threads'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      threads: threads || [],
      count: threads?.length || 0
    })

  } catch (error) {
    console.error('Threads API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // Debug logging
    console.log('🔍 AUTH DEBUG:', {
      hasUser: !!user,
      userId: user?.id,
      authError: authError?.message,
      cookies: cookieStore.getAll().map(c => c.name)
    })

    if (authError || !user) {
      console.error('❌ Auth failed:', authError?.message || 'No user found')
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      thread_type,
      prospect_name,
      prospect_company,
      prospect_linkedin_url,
      campaign_name,
      tags,
      priority = 'medium',
      sales_methodology = 'meddic',
      workspace_id: providedWorkspaceId
    } = body

    if (!title || !thread_type) {
      return NextResponse.json({
        success: false,
        error: 'Title and thread type are required'
      }, { status: 400 })
    }

    // Try to resolve workspace but don't fail if it's not available
    let workspaceId: string | null = null
    try {
      workspaceId = await resolveWorkspaceId({
        id: user.id,
        email: user.email || undefined,
        user_metadata: user.user_metadata as Record<string, unknown> | undefined
      }, providedWorkspaceId)
    } catch (error) {
      console.warn('Workspace resolution failed, creating thread without workspace:', error)
      // Don't fail - just create thread without workspace
    }

    // Get user's organization (if any)
    let organizationId = null
    try {
      const { data: userOrgs } = await supabaseAdmin
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

      if (userOrgs) {
        organizationId = userOrgs.organization_id
      }
    } catch {
      // Continue without organization - not critical
    }

    // Create thread
    const { data: thread, error } = await supabaseAdmin
      .from('sam_conversation_threads')
      .insert({
        user_id: user.id,
        organization_id: organizationId,
        workspace_id: workspaceId,
        title,
        thread_type,
        prospect_name,
        prospect_company,
        prospect_linkedin_url,
        campaign_name,
        tags,
        priority,
        sales_methodology
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create thread:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to create conversation thread'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      thread,
      message: 'Thread created successfully'
    })

  } catch (error) {
    console.error('Create thread API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
