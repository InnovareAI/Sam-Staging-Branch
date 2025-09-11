/**
 * SAM AI Individual Thread Management API
 * 
 * Handles updates and deletion of specific conversation threads
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const resolvedParams = await params
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const { data: thread, error } = await supabase
      .from('sam_conversation_threads')
      .select('*')
      .eq('id', resolvedParams.threadId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Thread not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      thread
    })

  } catch (error) {
    console.error('Get thread API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const resolvedParams = await params
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const allowedFields = [
      'title',
      'status',
      'prospect_name',
      'prospect_company',
      'prospect_linkedin_url',
      'campaign_name',
      'tags',
      'priority',
      'current_discovery_stage',
      'discovery_progress',
      'sales_methodology',
      'deal_stage',
      'deal_value'
    ]

    // Filter only allowed fields
    const updates = Object.keys(body)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = body[key]
        return obj
      }, {} as any)

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid fields to update'
      }, { status: 400 })
    }

    const { data: thread, error } = await supabase
      .from('sam_conversation_threads')
      .update(updates)
      .eq('id', resolvedParams.threadId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update thread:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to update thread'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      thread,
      message: 'Thread updated successfully'
    })

  } catch (error) {
    console.error('Update thread API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const resolvedParams = await params
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Delete thread and all associated messages (cascade)
    const { error } = await supabase
      .from('sam_conversation_threads')
      .delete()
      .eq('id', resolvedParams.threadId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to delete thread:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to delete thread'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Thread deleted successfully'
    })

  } catch (error) {
    console.error('Delete thread API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}