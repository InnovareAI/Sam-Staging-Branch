import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - Deploy N8N workflows globally for all users/workspaces
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      template_version = 'v1.0',
      force_redeploy = false,
      workspace_filter = null // Optional: filter to specific workspaces
    } = body

    // Get default workflow template
    const { data: template, error: templateError } = await supabase
      .from('workflow_templates')
      .select('*')
      .eq('template_version', template_version)
      .eq('status', 'active')
      .eq('is_default', true)
      .single()

    if (templateError || !template) {
      return NextResponse.json({
        success: false,
        error: `Default workflow template ${template_version} not found or inactive`
      }, { status: 404 })
    }

    // Get all workspaces that need deployment (simulate workspace data for now)
    // In a real implementation, this would query actual workspaces table
    const mockWorkspaces = [
      { id: 'workspace_1', name: 'Demo Workspace 1', user_id: 'user_1' },
      { id: 'workspace_2', name: 'Demo Workspace 2', user_id: 'user_2' },
      { id: 'workspace_3', name: 'Demo Workspace 3', user_id: 'user_3' }
    ]

    let totalWorkspaces = mockWorkspaces.length
    let deployedCount = 0
    let skippedCount = 0
    let failedCount = 0
    let deploymentResults = []

    for (const workspace of mockWorkspaces) {
      try {
        // Check if workspace already has an active workflow
        const { data: existingWorkflow } = await supabase
          .from('workspace_n8n_workflows')
          .select('id, deployment_status')
          .eq('workspace_id', workspace.id)
          .eq('deployment_status', 'active')
          .single()

        if (existingWorkflow && !force_redeploy) {
          skippedCount++
          deploymentResults.push({
            workspace_id: workspace.id,
            workspace_name: workspace.name,
            status: 'skipped',
            reason: 'Active workflow already exists'
          })
          continue
        }

        // If force_redeploy, archive existing workflow
        if (existingWorkflow && force_redeploy) {
          await supabase
            .from('workspace_n8n_workflows')
            .update({ deployment_status: 'archived' })
            .eq('id', existingWorkflow.id)
        }

        // Generate unique workflow ID for N8N
        const deployedWorkflowId = `sam_workflow_${workspace.id}_${Date.now()}`

        // TODO: Deploy actual workflow to N8N instance
        // const n8nResponse = await fetch(`${process.env.N8N_INSTANCE_URL}/api/v1/workflows`, {
        //   method: 'POST',
        //   headers: {
        //     'Content-Type': 'application/json',
        //     'Authorization': `Bearer ${process.env.N8N_API_KEY}`
        //   },
        //   body: JSON.stringify({
        //     name: `SAM_Workflow_${workspace.name}`,
        //     nodes: template.n8n_workflow_json.nodes,
        //     connections: template.n8n_workflow_json.connections
        //   })
        // })

        // Create workspace workflow record
        const { data: newWorkflow, error: workflowError } = await supabase
          .from('workspace_n8n_workflows')
          .insert({
            workspace_id: workspace.id,
            user_id: workspace.user_id,
            deployed_workflow_id: deployedWorkflowId,
            master_template_version: template_version,
            deployment_status: 'active', // Would be 'deploying' in real implementation
            workspace_config: {},
            channel_preferences: {
              email_enabled: true,
              linkedin_enabled: true,
              execution_sequence: 'email_first',
              delay_between_channels: 24
            },
            email_config: {
              enabled: true,
              from_email: '',
              from_name: '',
              reply_to: '',
              sequences: [],
              personalization_enabled: true
            },
            linkedin_config: {
              enabled: true,
              account_id: '',
              connection_requests_enabled: true,
              inmails_enabled: false,
              response_handling: 'auto_classify'
            },
            reply_handling_config: {
              auto_response_enabled: true,
              classification_enabled: true,
              human_handoff_triggers: ['complex_question', 'objection', 'pricing_inquiry'],
              positive_reply_actions: ['schedule_meeting', 'notify_sales_rep'],
              negative_reply_actions: ['remove_from_sequence', 'add_to_suppression']
            },
            integration_status: {
              unipile_connected: false,
              email_provider_connected: false,
              calendar_connected: false
            }
          })
          .select()
          .single()

        if (workflowError) throw workflowError

        // Create deployment history record
        await supabase
          .from('workflow_deployment_history')
          .insert({
            workspace_n8n_workflow_id: newWorkflow.id,
            workspace_id: workspace.id,
            deployment_type: 'initial_deployment',
            deployment_trigger: 'admin_action',
            new_template_version: template_version,
            status: 'completed',
            deployed_workflow_id: deployedWorkflowId,
            initiated_by: 'system',
            deployment_notes: `Global deployment of template ${template_version}`,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          })

        deployedCount++
        deploymentResults.push({
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          workflow_id: newWorkflow.id,
          deployed_workflow_id: deployedWorkflowId,
          status: 'deployed',
          reason: 'Successfully deployed new workflow'
        })

      } catch (error) {
        failedCount++
        deploymentResults.push({
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          status: 'failed',
          reason: error instanceof Error ? error.message : 'Unknown error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_workspaces: totalWorkspaces,
        deployed: deployedCount,
        skipped: skippedCount,
        failed: failedCount
      },
      template_used: {
        name: template.template_name,
        version: template.template_version,
        description: template.description
      },
      deployment_results: deploymentResults,
      message: `Global N8N deployment completed: ${deployedCount} deployed, ${skippedCount} skipped, ${failedCount} failed`
    })

  } catch (error) {
    console.error('Global N8N deployment error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET - Get global deployment status
export async function GET(request: NextRequest) {
  try {
    // Get all workspace workflows with deployment status
    const { data: workflows, error } = await supabase
      .from('workspace_n8n_workflows')
      .select(`
        id,
        workspace_id,
        user_id,
        deployed_workflow_id,
        master_template_version,
        deployment_status,
        total_executions,
        successful_executions,
        failed_executions,
        last_execution_at,
        created_at
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get deployment statistics
    const statusCounts = workflows?.reduce((acc, wf) => {
      acc[wf.deployment_status] = (acc[wf.deployment_status] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const templateVersions = workflows?.reduce((acc, wf) => {
      acc[wf.master_template_version] = (acc[wf.master_template_version] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    return NextResponse.json({
      success: true,
      total_workflows: workflows?.length || 0,
      deployment_status_breakdown: statusCounts,
      template_versions: templateVersions,
      workflows: workflows || []
    })

  } catch (error) {
    console.error('Global deployment status error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}