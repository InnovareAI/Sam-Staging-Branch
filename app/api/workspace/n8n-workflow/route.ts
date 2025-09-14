import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Get workspace N8N workflow configuration
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default-user'
    const workspaceId = request.headers.get('x-workspace-id') || 'default-workspace'

    // Get current workspace workflow configuration
    const { data: workflowConfig, error } = await supabase
      .from('workspace_n8n_workflows')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('deployment_status', 'active')
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return NextResponse.json({
      success: true,
      workflow_config: workflowConfig || null,
      has_active_workflow: !!workflowConfig
    })

  } catch (error) {
    console.error('Workflow config fetch error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST - Deploy new workflow for workspace
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      channel_preferences,
      email_config,
      linkedin_config,
      reply_handling_config,
      template_version = 'v1.0'
    } = body
    
    const userId = request.headers.get('x-user-id') || 'default-user'
    const workspaceId = request.headers.get('x-workspace-id') || 'default-workspace'

    // Check if workspace already has an active workflow
    const { data: existing } = await supabase
      .from('workspace_n8n_workflows')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('deployment_status', 'active')
      .single()

    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'Workspace already has an active workflow. Use PUT to update configuration.'
      }, { status: 409 })
    }

    // Get default workflow template
    const { data: template, error: templateError } = await supabase
      .from('workflow_templates')
      .select('*')
      .eq('template_version', template_version)
      .eq('status', 'active')
      .single()

    if (templateError || !template) {
      return NextResponse.json({
        success: false,
        error: `Workflow template ${template_version} not found or inactive`
      }, { status: 404 })
    }

    // TODO: Deploy actual workflow to N8N instance
    // For now, we'll simulate deployment
    const deployedWorkflowId = `sam_workflow_${workspaceId}_${Date.now()}`
    
    // Create workspace workflow record
    const { data: newWorkflow, error } = await supabase
      .from('workspace_n8n_workflows')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        deployed_workflow_id: deployedWorkflowId,
        master_template_version: template_version,
        deployment_status: 'active', // Would be 'deploying' in real implementation
        workspace_config: {},
        channel_preferences: channel_preferences || {
          email_enabled: true,
          linkedin_enabled: true,
          execution_sequence: 'email_first',
          delay_between_channels: 24
        },
        email_config: email_config || {
          enabled: true,
          from_email: '',
          from_name: '',
          reply_to: '',
          sequences: [],
          personalization_enabled: true
        },
        linkedin_config: linkedin_config || {
          enabled: true,
          account_id: '',
          connection_requests_enabled: true,
          inmails_enabled: false,
          response_handling: 'auto_classify'
        },
        reply_handling_config: reply_handling_config || {
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

    if (error) throw error

    // Create deployment history record
    await supabase
      .from('workflow_deployment_history')
      .insert({
        workspace_n8n_workflow_id: newWorkflow.id,
        workspace_id: workspaceId,
        deployment_type: 'initial_deployment',
        deployment_trigger: 'user_request',
        new_template_version: template_version,
        status: 'completed',
        deployed_workflow_id: deployedWorkflowId,
        initiated_by: userId,
        deployment_notes: 'Initial workflow deployment for new workspace',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      workflow: newWorkflow,
      deployment_id: deployedWorkflowId,
      message: 'Workflow deployed successfully'
    })

  } catch (error) {
    console.error('Workflow deployment error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PUT - Update existing workflow configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      channel_preferences,
      email_config,
      linkedin_config,
      reply_handling_config
    } = body
    
    const userId = request.headers.get('x-user-id') || 'default-user'
    const workspaceId = request.headers.get('x-workspace-id') || 'default-workspace'

    // Get existing workflow
    const { data: existingWorkflow, error: fetchError } = await supabase
      .from('workspace_n8n_workflows')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('deployment_status', 'active')
      .single()

    if (fetchError || !existingWorkflow) {
      return NextResponse.json({
        success: false,
        error: 'No active workflow found for workspace'
      }, { status: 404 })
    }

    // Update workflow configuration
    const { data: updatedWorkflow, error } = await supabase
      .from('workspace_n8n_workflows')
      .update({
        channel_preferences: channel_preferences || existingWorkflow.channel_preferences,
        email_config: email_config || existingWorkflow.email_config,
        linkedin_config: linkedin_config || existingWorkflow.linkedin_config,
        reply_handling_config: reply_handling_config || existingWorkflow.reply_handling_config,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingWorkflow.id)
      .select()
      .single()

    if (error) throw error

    // Create deployment history record for configuration update
    await supabase
      .from('workflow_deployment_history')
      .insert({
        workspace_n8n_workflow_id: existingWorkflow.id,
        workspace_id: workspaceId,
        deployment_type: 'configuration_update',
        deployment_trigger: 'user_request',
        status: 'completed',
        configuration_changes: {
          channel_preferences: channel_preferences,
          email_config: email_config,
          linkedin_config: linkedin_config,
          reply_handling_config: reply_handling_config
        },
        initiated_by: userId,
        deployment_notes: 'Configuration update via API',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      workflow: updatedWorkflow,
      message: 'Workflow configuration updated successfully'
    })

  } catch (error) {
    console.error('Workflow update error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}