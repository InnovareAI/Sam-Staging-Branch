import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { WorkspaceProspectManager } from '@/lib/workspace-prospect-manager'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const supabase = supabaseAdmin()
    const { workspaceId } = await params
    const { searchParams } = new URL(request.url)

    // Get query parameters
    const status = searchParams.get('status')?.split(',') || undefined
    const assigned_to = searchParams.get('assigned_to') || undefined
    const has_response = searchParams.get('has_response') === 'true' ? true : 
                        searchParams.get('has_response') === 'false' ? false : undefined
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search') || undefined

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Verify user has access to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({
        success: false,
        error: 'Access denied to this workspace'
      }, { status: 403 })
    }

    // Get prospects using the manager
    const { prospects, total } = await WorkspaceProspectManager.getWorkspaceProspects(
      workspaceId,
      {
        status,
        assigned_to,
        has_response,
        limit,
        offset,
        search
      }
    )

    // Get contact statistics
    const contactStats = await WorkspaceProspectManager.getWorkspaceContactStats(workspaceId, 'week')

    return NextResponse.json({
      success: true,
      prospects,
      total,
      limit,
      offset,
      has_more: total > (offset + limit),
      contact_stats: contactStats,
      filters: {
        status,
        assigned_to,
        has_response,
        search
      }
    })

  } catch (error) {
    console.error('Failed to get workspace prospects:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params
    const body = await request.json()

    const { prospects, data_source = 'manual', options = {} } = body

    if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'prospects array is required'
      }, { status: 400 })
    }

    // Get current user
    const supabase = supabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Verify user has access to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({
        success: false,
        error: 'Access denied to this workspace'
      }, { status: 403 })
    }

    // Handle single prospect add or bulk import
    if (prospects.length === 1) {
      const prospect = await WorkspaceProspectManager.addOrGetProspect(
        workspaceId,
        prospects[0],
        data_source
      )

      return NextResponse.json({
        success: true,
        prospect,
        message: 'Prospect added successfully'
      })
    } else {
      // Bulk import
      const results = await WorkspaceProspectManager.bulkImportProspects(
        workspaceId,
        prospects,
        data_source,
        options
      )

      return NextResponse.json({
        success: true,
        ...results,
        message: `Bulk import completed: ${results.imported} imported, ${results.duplicates} duplicates, ${results.errors} errors`
      })
    }

  } catch (error) {
    console.error('Failed to add prospects:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}