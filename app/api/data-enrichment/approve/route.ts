import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db';
import { apiError, handleApiError, apiSuccess } from '@/lib/api-error-handler'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      prospect_id,
      approved,
      workspace_id,
      user_id,
      rejection_reason
    } = body

    // Validate required fields
    if (!prospect_id || typeof approved !== 'boolean' || !workspace_id || !user_id) {
      throw apiError.validation(
        'Missing required fields',
        'prospect_id, approved, workspace_id, and user_id are required'
      )
    }

    // Start transaction
    const { data: prospect, error: fetchError } = await supabase
      .from('enriched_prospects')
      .select('*')
      .eq('prospect_id', prospect_id)
      .eq('workspace_id', workspace_id)
      .single()

    if (fetchError || !prospect) {
      throw apiError.notFound('Enriched prospect')
    }

    // Update prospect status
    const newStatus = approved ? 'approved' : 'rejected'
    const { error: updateError } = await supabase
      .from('enriched_prospects')
      .update({
        enrichment_status: newStatus,
        manual_review_required: false,
        updated_at: new Date().toISOString()
      })
      .eq('prospect_id', prospect_id)
      .eq('workspace_id', workspace_id)

    if (updateError) {
      throw apiError.database('prospect status update', updateError)
    }

    // Record approval decision
    const { error: approvalError } = await supabase
      .from('prospect_approvals')
      .insert({
        prospect_id,
        workspace_id,
        approved_by: user_id,
        approved,
        approved_at: new Date().toISOString(),
        rejection_reason: approved ? null : rejection_reason,
        approval_metadata: {
          icp_score: prospect.icp_score,
          confidence_score: prospect.confidence_score,
          estimated_cost: prospect.estimated_cost
        }
      })

    if (approvalError) {
      // CRITICAL: Fail the operation - approval logging is required for audit trail
      throw apiError.database('approval decision recording', approvalError)
    }

    // If approved, move to active prospects
    if (approved) {
      const enrichedData = prospect.enriched_data

      const { error: prospectInsertError } = await supabase
        .from('prospects')
        .insert({
          workspace_id,
          first_name: enrichedData.first_name,
          last_name: enrichedData.last_name,
          email: enrichedData.email_address,
          company: enrichedData.company_name,
          title: enrichedData.linkedin_profile?.current_position?.title,
          linkedin_url: enrichedData.linkedin_url,
          website_url: enrichedData.website_url,
          enriched_data: enrichedData,
          icp_score: prospect.icp_score,
          confidence_score: prospect.confidence_score,
          status: 'new',
          source: 'data_enrichment',
          created_at: new Date().toISOString()
        })

      if (prospectInsertError) {
        // CRITICAL: Fail the operation - prospect must be created when approved
        throw apiError.database('prospect creation in active prospects table', prospectInsertError)
      }

      // Create initial engagement tasks if approved
      await createInitialEngagementTasks(prospect_id, workspace_id, user_id, enrichedData)
    }

    // Update quota usage if approved
    if (approved && prospect.estimated_cost > 0) {
      await updateQuotaUsage(user_id, workspace_id, prospect.estimated_cost)
    }

    return apiSuccess({
      prospect_id,
      approved,
      new_status: newStatus
    }, approved
      ? 'Prospect approved and added to active prospects'
      : 'Prospect rejected')

  } catch (error) {
    return handleApiError(error, 'prospect_approval')
  }
}

async function createInitialEngagementTasks(
  prospectId: string,
  workspaceId: string,
  userId: string,
  enrichedData: any
) {
  try {
    const tasks = []

    // Create personalized outreach task
    if (enrichedData.service_fit_analysis?.recommended_approach?.conversation_starters?.length > 0) {
      tasks.push({
        workspace_id: workspaceId,
        assigned_to: userId,
        prospect_id: prospectId,
        task_type: 'outreach',
        title: 'Send personalized LinkedIn message',
        description: `Reach out with: ${enrichedData.service_fit_analysis.recommended_approach.conversation_starters[0]}`,
        priority: 'high',
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
        metadata: {
          messaging_angle: enrichedData.service_fit_analysis.recommended_approach.messaging_angle,
          key_value_props: enrichedData.service_fit_analysis.recommended_approach.key_value_props,
          pain_points: enrichedData.service_fit_analysis.pain_points_identified
        }
      })
    }

    // Create research follow-up task if competitive threats identified
    if (enrichedData.service_fit_analysis?.competitive_threats?.length > 0) {
      tasks.push({
        workspace_id: workspaceId,
        assigned_to: userId,
        prospect_id: prospectId,
        task_type: 'research',
        title: 'Prepare competitive differentiation',
        description: `Address competitive threats: ${enrichedData.service_fit_analysis.competitive_threats.map((t: any) => t.competitor).join(', ')}`,
        priority: 'medium',
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
        metadata: {
          competitive_threats: enrichedData.service_fit_analysis.competitive_threats
        }
      })
    }

    // Create demo scheduling task for high ICP scores
    if (enrichedData.service_fit_analysis?.icp_score > 0.8) {
      tasks.push({
        workspace_id: workspaceId,
        assigned_to: userId,
        prospect_id: prospectId,
        task_type: 'meeting',
        title: 'Schedule product demo',
        description: 'High ICP score - prioritize for demo scheduling',
        priority: 'high',
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
        metadata: {
          icp_score: enrichedData.service_fit_analysis.icp_score,
          buying_signals: enrichedData.service_fit_analysis.buying_signals
        }
      })
    }

    if (tasks.length > 0) {
      const { error: taskError } = await supabase
        .from('tasks')
        .insert(tasks)

      if (taskError) {
        // CRITICAL: Throw standardized error instead of silent failure
        throw apiError.database('engagement task creation', taskError)
      }
    }

  } catch (error) {
    console.error('Task creation error:', error)
    // CRITICAL: Propagate error up - don't hide failures
    throw error
  }
}

async function updateQuotaUsage(userId: string, workspaceId: string, cost: number) {
  try {
    // Get current quota
    const { data: quota, error: fetchError } = await supabase
      .from('data_scraping_quotas')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single()

    if (fetchError) {
      console.error('Quota fetch error:', fetchError)
      return
    }

    // Update usage
    await supabase
      .from('data_scraping_quotas')
      .update({
        current_usage: quota.current_usage + cost,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)

  } catch (error) {
    console.error('Quota update error:', error)
    // Don't fail approval if quota update fails
  }
}