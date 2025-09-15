/**
 * SAM AI Threaded Conversations API
 * 
 * Handles creation and listing of conversation threads
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // CRITICAL: Check if required tables exist before proceeding
    try {
      const { error: tableCheckError } = await supabase
        .from('sam_conversation_threads')
        .select('id')
        .limit(0);

      if (tableCheckError && tableCheckError.code === '42P01') {
        console.error('🚨 CRITICAL: sam_conversation_threads table missing!');
        return NextResponse.json({
          success: false,
          error: 'Database schema error: Required chat tables missing',
          fix_instructions: 'Run SQL from /api/admin/setup-chat-tables in Supabase SQL Editor',
          health_check: '/api/admin/check-db'
        }, { status: 503 });
      }
    } catch (schemaError) {
      console.error('🚨 Schema check failed:', schemaError);
      return NextResponse.json({
        success: false,
        error: 'Database schema validation failed',
        fix_instructions: 'Check database connectivity and run /api/admin/check-db'
      }, { status: 503 });
    }

    // Get query parameters for filtering
    const url = new URL(request.url)
    const threadType = url.searchParams.get('type')
    const status = url.searchParams.get('status') || 'active'
    const priority = url.searchParams.get('priority')
    const search = url.searchParams.get('search')
    const tags = url.searchParams.get('tags')?.split(',')

    // Build query
    let query = supabase
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
    const supabase = createRouteHandlerClient({ cookies: cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
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
      sales_methodology = 'meddic'
    } = body

    if (!title || !thread_type) {
      return NextResponse.json({
        success: false,
        error: 'Title and thread type are required'
      }, { status: 400 })
    }

    // Get user's organization (if any)
    let organizationId = null
    try {
      const { data: userOrgs } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()
      
      if (userOrgs) {
        organizationId = userOrgs.organization_id
      }
    } catch (orgError) {
      // Continue without organization - not critical
    }

    // Create thread
    const { data: thread, error } = await supabase
      .from('sam_conversation_threads')
      .insert({
        user_id: user.id,
        organization_id: organizationId,
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