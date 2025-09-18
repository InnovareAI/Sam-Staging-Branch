/**
 * PRODUCTION-READY N8N Webhook Status Update Handler
 * Receives real-time status updates from N8N workflows with enterprise-grade security
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { logger, PerformanceMonitor } from '@/lib/logging'
import { validateRequest } from '@/lib/validation'
import { z } from 'zod'

// Webhook payload validation schema
const N8NStatusUpdateSchema = z.object({
  execution_id: z.string().min(1, 'execution_id is required'),
  campaign_execution_id: z.string().uuid('Invalid campaign execution ID').optional(),
  status: z.enum(['running', 'completed', 'failed', 'paused', 'cancelled'], 'Invalid status'),
  progress: z.object({
    total_prospects: z.number().min(0).optional(),
    processed_prospects: z.number().min(0).optional(),
    successful_outreach: z.number().min(0).optional(),
    failed_outreach: z.number().min(0).optional(),
    responses_received: z.number().min(0).optional(),
    current_prospect_index: z.number().min(0).optional(),
    channels_used: z.array(z.string()).optional()
  }).optional(),
  current_step: z.string().optional(),
  estimated_time_remaining: z.number().min(0).optional(),
  error_details: z.object({
    error_type: z.string(),
    error_message: z.string(),
    failed_at_step: z.string().optional(),
    prospect_id: z.string().optional(),
    channel: z.string().optional()
  }).optional(),
  metadata: z.object({
    workspace_id: z.string().uuid().optional(),
    workflow_id: z.string().optional(),
    n8n_instance: z.string().optional(),
    execution_start_time: z.string().optional(),
    last_activity_time: z.string().optional()
  }).optional()
}).strict()

const supabase = supabaseAdmin()

// POST - Receive status updates from N8N workflow
export async function POST(request: NextRequest) {
  const monitor = new PerformanceMonitor()
  let requestId: string

  try {
    // Initialize performance monitoring and request tracking
    monitor.mark('webhook_start')
    requestId = logger.requestStart('POST', '/api/campaign/n8n-status-update', {
      requestId: `n8n_webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      n8nInstance: request.headers.get('x-n8n-instance') || undefined
    })

    // Enhanced webhook authentication and security validation
    const authHeader = request.headers.get('authorization')
    const n8nWebhookToken = process.env.N8N_WEBHOOK_SECRET_TOKEN

    if (n8nWebhookToken && (!authHeader || !authHeader.startsWith('Bearer '))) {
      logger.warn('N8N webhook authentication failed - missing authorization header', {
        metadata: { 
          hasToken: !!n8nWebhookToken,
          hasAuthHeader: !!authHeader,
          requestId
        }
      })
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - missing authentication'
      }, { status: 401 })
    }

    if (n8nWebhookToken && authHeader) {
      const providedToken = authHeader.substring(7) // Remove 'Bearer '
      if (providedToken !== n8nWebhookToken) {
        logger.warn('N8N webhook authentication failed - invalid token', {
          metadata: { requestId }
        })
        return NextResponse.json({
          success: false,
          error: 'Unauthorized - invalid token'
        }, { status: 401 })
      }
    }

    monitor.mark('auth_complete')

    // Parse and validate webhook payload
    let body: unknown
    try {
      body = await request.json()
    } catch (parseError) {
      logger.error('N8N webhook payload parsing failed', parseError, {
        metadata: { requestId }
      })
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON payload'
      }, { status: 400 })
    }

    // Validate payload structure
    const validation = validateRequest(N8NStatusUpdateSchema, body)
    if (!validation.success) {
      logger.warn('N8N webhook payload validation failed', {
        metadata: { 
          errors: validation.errors,
          requestId 
        }
      })
      return NextResponse.json({
        success: false,
        error: 'Invalid webhook payload',
        details: validation.errors
      }, { status: 400 })
    }

    const { 
      execution_id,
      campaign_execution_id,
      status,
      progress = {},
      current_step,
      estimated_time_remaining,
      error_details,
      metadata: webhookMetadata
    } = validation.data

    monitor.mark('validation_complete')

    logger.info('N8N webhook status update received', {
      metadata: {
        execution_id,
        campaign_execution_id,
        status,
        current_step,
        progress_summary: {
          total: progress.total_prospects,
          processed: progress.processed_prospects,
          successful: progress.successful_outreach,
          failed: progress.failed_outreach
        },
        requestId
      }
    })

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
      // Get current successful_executions count and increment
      const { data: currentWorkflow } = await supabase
        .from('workspace_n8n_workflows')
        .select('successful_executions')
        .eq('id', execution.workspace_n8n_workflow_id)
        .single()
      
      if (currentWorkflow) {
        await supabase
          .from('workspace_n8n_workflows')
          .update({
            successful_executions: (currentWorkflow.successful_executions || 0) + 1,
            last_execution_at: new Date().toISOString()
          })
          .eq('id', execution.workspace_n8n_workflow_id)
      }
    } else if (status === 'failed') {
      // Get current failed_executions count and increment
      const { data: currentWorkflow } = await supabase
        .from('workspace_n8n_workflows')
        .select('failed_executions')
        .eq('id', execution.workspace_n8n_workflow_id)
        .single()
      
      if (currentWorkflow) {
        await supabase
          .from('workspace_n8n_workflows')
          .update({
            failed_executions: (currentWorkflow.failed_executions || 0) + 1,
            last_execution_at: new Date().toISOString()
          })
          .eq('id', execution.workspace_n8n_workflow_id)
      }
    }

    monitor.mark('database_update_complete')

    // REAL-TIME NOTIFICATIONS AND MONITORING INTEGRATION
    try {
      // 1. Real-time dashboard updates via Supabase Realtime
      await supabase
        .channel(`campaign_execution_${execution.id}`)
        .send({
          type: 'broadcast',
          event: 'campaign_status_update',
          payload: {
            execution_id: execution.id,
            n8n_execution_id: execution_id,
            status,
            progress,
            current_step,
            timestamp: new Date().toISOString()
          }
        })

      // 2. Critical status notifications
      if (status === 'completed') {
        logger.info('Campaign execution completed successfully', {
          metadata: {
            execution_id: execution.id,
            n8n_execution_id: execution_id,
            workspace_id: execution.workspace_id,
            total_prospects: progress.total_prospects || execution.total_prospects,
            successful_outreach: progress.successful_outreach || execution.successful_outreach,
            duration_minutes: updateData.actual_duration_minutes,
            requestId
          }
        })

        // TODO: Send completion email notification
        // TODO: Trigger Slack notification if configured
        
      } else if (status === 'failed') {
        logger.error('Campaign execution failed', error_details, {
          metadata: {
            execution_id: execution.id,
            n8n_execution_id: execution_id,
            workspace_id: execution.workspace_id,
            error_details,
            current_step,
            requestId
          }
        })

        // TODO: Send failure alert email
        // TODO: Trigger emergency Slack notification
      }

      monitor.mark('notifications_complete')

    } catch (notificationError) {
      // Log notification failures but don't fail the webhook
      logger.warn('Real-time notification failed', notificationError, {
        metadata: {
          execution_id: execution.id,
          n8n_execution_id: execution_id,
          requestId
        }
      })
    }

    // Performance monitoring completion
    monitor.mark('webhook_complete')
    const performanceMetrics = monitor.getMetrics()
    
    logger.info('N8N webhook processing completed', {
      metadata: {
        execution_id: execution.id,
        n8n_execution_id: execution_id,
        status,
        processing_time_ms: performanceMetrics.total_time_ms,
        requestId
      }
    })

    return NextResponse.json({
      success: true,
      execution: updatedExecution,
      message: `Campaign execution status updated to ${status}`,
      processing_time_ms: performanceMetrics.total_time_ms,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    // Enhanced error handling with comprehensive logging
    const errorId = `webhook_error_${Date.now()}`
    
    logger.error('N8N webhook processing failed', error, {
      metadata: {
        error_id: errorId,
        requestId: requestId || 'unknown',
        error_type: error instanceof Error ? error.name : 'UnknownError',
        stack_trace: error instanceof Error ? error.stack : undefined
      }
    })

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown webhook processing error',
      error_id: errorId,
      timestamp: new Date().toISOString()
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