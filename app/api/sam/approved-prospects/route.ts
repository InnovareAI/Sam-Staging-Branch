/**
 * SAM AI Approved Prospects API
 * 
 * Handles storage and management of user-approved prospect data
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

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
    const { threadId, prospects } = body

    if (!threadId || !prospects || !Array.isArray(prospects)) {
      return NextResponse.json({
        success: false,
        error: 'Thread ID and prospects array are required'
      }, { status: 400 })
    }

    // Verify thread ownership
    const { data: thread } = await supabase
      .from('sam_conversation_threads')
      .select('id, user_id')
      .eq('id', threadId)
      .eq('user_id', user.id)
      .single()

    if (!thread) {
      return NextResponse.json({
        success: false,
        error: 'Thread not found'
      }, { status: 404 })
    }

    // Prepare prospect data for database insertion
    const prospectRecords = prospects.map((prospect: any) => ({
      user_id: user.id,
      thread_id: threadId,
      prospect_id: prospect.id,
      name: prospect.name,
      title: prospect.title,
      company: prospect.company,
      email: prospect.email || null,
      phone: prospect.phone || null,
      linkedin_url: prospect.linkedinUrl || null,
      source_platform: prospect.source,
      confidence_score: prospect.confidence,
      compliance_flags: prospect.complianceFlags || [],
      approval_status: 'approved',
      approved_at: new Date().toISOString()
    }))

    // Insert approved prospects into database
    const { data: insertedProspects, error: insertError } = await supabase
      .from('sam_approved_prospects')
      .insert(prospectRecords)
      .select()

    if (insertError) {
      console.error('Failed to insert approved prospects:', insertError)
      return NextResponse.json({
        success: false,
        error: 'Failed to save approved prospects'
      }, { status: 500 })
    }

    // Update thread metadata
    await supabase
      .from('sam_conversation_threads')
      .update({
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId)

    return NextResponse.json({
      success: true,
      message: `Successfully saved ${prospects.length} approved prospects`,
      data: {
        saved_count: insertedProspects?.length || 0,
        prospects: insertedProspects
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Approved prospects API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

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

    const { searchParams } = new URL(request.url)
    const threadId = searchParams.get('threadId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('sam_approved_prospects')
      .select(`
        *,
        sam_conversation_threads (
          title,
          thread_type
        )
      `)
      .eq('user_id', user.id)
      .order('approved_at', { ascending: false })

    if (threadId) {
      query = query.eq('thread_id', threadId)
    }

    const { data: prospects, error } = await query
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Failed to fetch approved prospects:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch approved prospects'
      }, { status: 500 })
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('sam_approved_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (threadId) {
      countQuery = countQuery.eq('thread_id', threadId)
    }

    const { count: totalCount } = await countQuery

    return NextResponse.json({
      success: true,
      data: {
        prospects: prospects || [],
        pagination: {
          total: totalCount || 0,
          limit,
          offset,
          hasMore: (totalCount || 0) > (offset + limit)
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Get approved prospects API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}