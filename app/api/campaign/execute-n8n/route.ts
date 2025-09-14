import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - Execute campaign via N8N master workflow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      campaign_approval_session_id,
      execution_preferences = {},
      notification_preferences = {}
    } = body
    
    const userId = request.headers.get('x-user-id') || 'default-user'
    const workspaceId = request.headers.get('x-workspace-id') || 'default-workspace'

    // Validate campaign approval session exists and is completed
    const { data: approvalSession, error: approvalError } = await supabase
      .from('prospect_approval_sessions')
      .select('*')
      .eq('id', campaign_approval_session_id)
      .eq('workspace_id', workspaceId)
      .eq('status', 'completed')
      .single()

    if (approvalError || !approvalSession) {
      return NextResponse.json({
        success: false,
        error: 'Campaign approval session not found or not completed'
      }, { status: 404 })
    }

    // Get workspace N8N workflow configuration
    const { data: workflowConfig, error: workflowError } = await supabase
      .from('workspace_n8n_workflows')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('deployment_status', 'active')
      .single()

    if (workflowError || !workflowConfig) {
      return NextResponse.json({
        success: false,
        error: 'No active N8N workflow found for workspace. Deploy workflow first.'
      }, { status: 404 })
    }

    // Get approved prospects from the session
    const { data: approvedProspects, error: prospectsError } = await supabase
      .from('prospect_approval_decisions')
      .select(`
        *,
        prospect_approval_data:prospect_approval_data!inner(*)
      `)
      .eq('session_id', campaign_approval_session_id)
      .eq('decision', 'approved')

    if (prospectsError || !approvedProspects?.length) {
      return NextResponse.json({
        success: false,
        error: 'No approved prospects found for campaign execution'
      }, { status: 400 })
    }

    // Generate N8N execution ID (would be from actual N8N API call)
    const n8nExecutionId = `exec_${workspaceId}_${Date.now()}`
    
    // Determine campaign type based on channel preferences
    let campaignType = 'multi_channel'
    if (workflowConfig.channel_preferences?.email_enabled && !workflowConfig.channel_preferences?.linkedin_enabled) {
      campaignType = 'email_only'
    } else if (!workflowConfig.channel_preferences?.email_enabled && workflowConfig.channel_preferences?.linkedin_enabled) {
      campaignType = 'linkedin_only'
    }

    // Create campaign execution record
    const { data: campaignExecution, error } = await supabase
      .from('n8n_campaign_executions')
      .insert({
        workspace_n8n_workflow_id: workflowConfig.id,
        campaign_approval_session_id,
        workspace_id: workspaceId,
        n8n_execution_id: n8nExecutionId,
        n8n_workflow_id: workflowConfig.deployed_workflow_id,
        campaign_name: `Campaign_${approvalSession.batch_number}`,
        campaign_type: campaignType,
        execution_config: {
          execution_preferences,
          notification_preferences,
          channel_preferences: workflowConfig.channel_preferences,
          email_config: workflowConfig.email_config,
          linkedin_config: workflowConfig.linkedin_config,
          reply_handling_config: workflowConfig.reply_handling_config
        },
        total_prospects: approvedProspects.length,
        processed_prospects: 0,
        successful_outreach: 0,
        failed_outreach: 0,
        responses_received: 0,
        execution_status: 'started',
        current_step: 'initializing_campaign',
        progress_percentage: 0.0,
        estimated_completion_time: new Date(Date.now() + (approvedProspects.length * 2 * 60 * 1000)).toISOString(), // 2 min per prospect
        estimated_duration_minutes: approvedProspects.length * 2,
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    // TODO: Make actual API call to N8N workflows.innovareai.com
    // const n8nResponse = await fetch(`${workflowConfig.n8n_instance_url}/api/v1/workflows/${workflowConfig.deployed_workflow_id}/execute`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${process.env.N8N_API_KEY}`
    //   },
    //   body: JSON.stringify({
    //     workspaceConfig: workflowConfig,
    //     approvedProspects: approvedProspects,
    //     executionPreferences: execution_preferences
    //   })
    // })

    // Update workspace workflow with latest execution
    await supabase
      .from('workspace_n8n_workflows')
      .update({
        total_executions: (workflowConfig.total_executions || 0) + 1,
        last_execution_at: new Date().toISOString()
      })
      .eq('id', workflowConfig.id)

    return NextResponse.json({
      success: true,
      n8n_execution_id: n8nExecutionId,
      campaign_execution_id: campaignExecution.id,
      estimated_completion_time: campaignExecution.estimated_completion_time,
      total_prospects: approvedProspects.length,
      monitoring_dashboard_url: `/app/dashboard/campaigns/${campaignExecution.id}`,
      webhook_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/campaign/n8n-status-update`,
      message: 'Campaign execution started successfully'
    })

  } catch (error) {
    console.error('Campaign execution error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET - Get campaign execution status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const executionId = searchParams.get('execution_id')
    const workspaceId = request.headers.get('x-workspace-id') || 'default-workspace'

    if (!executionId) {
      // Return all executions for workspace
      const { data: executions, error } = await supabase
        .from('n8n_campaign_executions')
        .select(`
          *,
          workspace_n8n_workflows:workspace_n8n_workflows(deployed_workflow_id, master_template_version)
        `)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      return NextResponse.json({
        success: true,
        executions: executions || []
      })
    }

    // Return specific execution
    const { data: execution, error } = await supabase
      .from('n8n_campaign_executions')
      .select(`
        *,
        workspace_n8n_workflows:workspace_n8n_workflows(deployed_workflow_id, master_template_version, channel_preferences, email_config, linkedin_config),
        prospect_approval_sessions:prospect_approval_sessions(batch_number, total_prospects, approved_count)
      `)
      .eq('id', executionId)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !execution) {
      return NextResponse.json({
        success: false,
        error: 'Campaign execution not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      execution
    })

  } catch (error) {
    console.error('Campaign execution status error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}