import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - Receive status updates from N8N workflow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      execution_id,
      campaign_approval_session_id,
      status,
      progress = {},
      current_step,
      estimated_time_remaining,
      error_details
    } = body
    
    // Validate required fields
    if (!execution_id) {
      return NextResponse.json({
        success: false,
        error: 'execution_id is required'
      }, { status: 400 })
    }

    // Find the campaign execution record
    const { data: execution, error: fetchError } = await supabase
      .from('n8n_campaign_executions')
      .select('*')
      .eq('n8n_execution_id', execution_id)
      .single()

    if (fetchError || !execution) {
      return NextResponse.json({
        success: false,
        error: 'Campaign execution not found'
      }, { status: 404 })
    }

    // Calculate progress percentage
    let progressPercentage = 0
    if (progress.total_prospects && progress.processed_prospects) {
      progressPercentage = Math.round((progress.processed_prospects / progress.total_prospects) * 100)
    }

    // Update campaign execution status
    const updateData: any = {
      execution_status: status,
      current_step: current_step || execution.current_step,
      progress_percentage: progressPercentage,
      updated_at: new Date().toISOString()
    }

    // Update progress metrics if provided
    if (progress.total_prospects !== undefined) {
      updateData.total_prospects = progress.total_prospects
    }
    if (progress.processed_prospects !== undefined) {
      updateData.processed_prospects = progress.processed_prospects
    }
    if (progress.successful_outreach !== undefined) {
      updateData.successful_outreach = progress.successful_outreach
    }
    if (progress.failed_outreach !== undefined) {
      updateData.failed_outreach = progress.failed_outreach
    }
    if (progress.responses_received !== undefined) {
      updateData.responses_received = progress.responses_received
    }

    // Handle completion or failure
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString()
      updateData.actual_duration_minutes = Math.round(
        (new Date().getTime() - new Date(execution.started_at).getTime()) / (1000 * 60)
      )
    } else if (status === 'failed') {
      updateData.error_details = error_details
      updateData.completed_at = new Date().toISOString()
    }

    // Update the execution record
    const { data: updatedExecution, error } = await supabase
      .from('n8n_campaign_executions')
      .update(updateData)
      .eq('id', execution.id)
      .select()
      .single()

    if (error) throw error

    // Update parent workspace workflow statistics
    if (status === 'completed') {
      await supabase
        .from('workspace_n8n_workflows')
        .update({
          successful_executions: supabase.sql`successful_executions + 1`
        })
        .eq('id', execution.workspace_n8n_workflow_id)
    } else if (status === 'failed') {
      await supabase
        .from('workspace_n8n_workflows')
        .update({
          failed_executions: supabase.sql`failed_executions + 1`
        })
        .eq('id', execution.workspace_n8n_workflow_id)
    }

    // TODO: Send real-time notifications to user via WebSocket or SSE
    // TODO: Trigger email notifications if configured
    // TODO: Update dashboard via real-time subscription

    return NextResponse.json({
      success: true,
      execution: updatedExecution,
      message: `Campaign execution status updated to ${status}`
    })

  } catch (error) {
    console.error('N8N status update error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET - Get current status of campaign execution
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const executionId = searchParams.get('execution_id')
    const n8nExecutionId = searchParams.get('n8n_execution_id')

    if (!executionId && !n8nExecutionId) {
      return NextResponse.json({
        success: false,
        error: 'execution_id or n8n_execution_id is required'
      }, { status: 400 })
    }

    let query = supabase
      .from('n8n_campaign_executions')
      .select(`
        *,
        workspace_n8n_workflows:workspace_n8n_workflows(
          deployed_workflow_id,
          master_template_version,
          channel_preferences
        ),
        prospect_approval_sessions:prospect_approval_sessions(
          batch_number,
          total_prospects,
          approved_count
        )
      `)

    if (executionId) {
      query = query.eq('id', executionId)
    } else if (n8nExecutionId) {
      query = query.eq('n8n_execution_id', n8nExecutionId)
    }

    const { data: execution, error } = await query.single()

    if (error || !execution) {
      return NextResponse.json({
        success: false,
        error: 'Campaign execution not found'
      }, { status: 404 })
    }

    // Calculate execution metrics
    const metrics = {
      completion_percentage: execution.progress_percentage,
      success_rate: execution.processed_prospects > 0 ? 
        Math.round((execution.successful_outreach / execution.processed_prospects) * 100) : 0,
      response_rate: execution.successful_outreach > 0 ? 
        Math.round((execution.responses_received / execution.successful_outreach) * 100) : 0,
      time_elapsed_minutes: execution.started_at ? 
        Math.round((new Date().getTime() - new Date(execution.started_at).getTime()) / (1000 * 60)) : 0,
      estimated_time_remaining: execution.estimated_completion_time ? 
        Math.max(0, Math.round((new Date(execution.estimated_completion_time).getTime() - new Date().getTime()) / (1000 * 60))) : null
    }

    return NextResponse.json({
      success: true,
      execution,
      metrics
    })

  } catch (error) {
    console.error('Campaign execution status fetch error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}