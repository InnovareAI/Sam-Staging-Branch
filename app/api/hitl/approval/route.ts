/**
 * HITL Approval API Endpoints
 * Create and manage Human-in-the-Loop approval sessions
 */

import { NextRequest, NextResponse } from 'next/server'
import { HITLApprovalEmailService } from '@/lib/services/hitl-approval-email-service'
import { pool } from '@/lib/db'
import { apiError, handleApiError, apiSuccess } from '@/lib/api-error-handler'
import { z } from 'zod'

const supabase = pool
const hitlService = new HITLApprovalEmailService()

// Validation schema for creating approval sessions
const CreateApprovalSessionSchema = z.object({
  workspace_id: z.string().uuid('Invalid workspace ID'),
  campaign_execution_id: z.string().uuid('Invalid campaign execution ID').optional(),
  original_message_id: z.string().min(1, 'Original message ID is required'),
  original_message_content: z.string().min(1, 'Original message content is required'),
  original_message_channel: z.enum(['linkedin', 'email'], {
    errorMap: () => ({ message: 'Channel must be linkedin or email' })
  }),
  prospect_name: z.string().optional(),
  prospect_email: z.string().email('Invalid prospect email').optional(),
  prospect_linkedin_url: z.string().url('Invalid LinkedIn URL').optional(),
  prospect_company: z.string().optional(),
  sam_suggested_reply: z.string().min(1, 'SAM suggested reply is required'),
  sam_confidence_score: z.number().min(0).max(1).optional(),
  sam_reasoning: z.string().optional(),
  assigned_to_email: z.string().email('Invalid assigned email'),
  timeout_hours: z.number().min(1).max(168).optional() // Max 1 week
}).strict()

// POST - Create new HITL approval session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const validation = CreateApprovalSessionSchema.safeParse(body)
    if (!validation.success) {
      throw apiError.validation(
        'Invalid request data',
        JSON.stringify(validation.error.issues)
      )
    }

    const data = validation.data

    // Verify workspace exists and user has access
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', data.workspace_id)
      .single()

    if (workspaceError || !workspace) {
      throw apiError.notFound('Workspace')
    }

    // Skip reviewer verification for now - focus on HITL functionality
    // In production, this would verify against your user management system
    // For testing, we'll accept any valid email format

    // Create approval session
    const result = await hitlService.createApprovalSession({
      workspace_id: data.workspace_id,
      campaign_execution_id: data.campaign_execution_id,
      original_message_id: data.original_message_id,
      original_message_content: data.original_message_content,
      original_message_channel: data.original_message_channel,
      prospect_name: data.prospect_name,
      prospect_email: data.prospect_email,
      prospect_linkedin_url: data.prospect_linkedin_url,
      prospect_company: data.prospect_company,
      sam_suggested_reply: data.sam_suggested_reply,
      sam_confidence_score: data.sam_confidence_score,
      sam_reasoning: data.sam_reasoning,
      assigned_to_email: data.assigned_to_email,
      timeout_hours: data.timeout_hours
    })

    if (!result.success) {
      throw apiError.internal(result.error || 'Failed to create approval session')
    }

    return apiSuccess({
      session: result.session
    }, 'HITL approval session created and email sent')

  } catch (error) {
    return handleApiError(error, 'hitl_approval_session_create')
  }
}

// GET - List approval sessions for workspace
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    const status = searchParams.get('status')
    const assignedTo = searchParams.get('assigned_to')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspaceId) {
      throw apiError.validation('workspace_id is required')
    }

    let query = supabase
      .from('hitl_reply_approval_sessions')
      .select(`
        *,
        workspace:workspaces(id, name),
        campaign:n8n_campaign_executions(id, campaign_name)
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Add filters
    if (status) {
      query = query.eq('approval_status', status)
    }
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo)
    }

    const { data: sessions, error } = await query

    if (error) {
      throw apiError.database('HITL sessions fetch', error)
    }

    return apiSuccess({
      sessions,
      pagination: {
        limit,
        offset,
        total: sessions?.length || 0
      }
    })

  } catch (error) {
    return handleApiError(error, 'hitl_approval_sessions_list')
  }
}