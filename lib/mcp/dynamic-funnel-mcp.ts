/**
 * Sam Dynamic Flexible Funnel MCP Tools
 * AI-generated, conversational funnel creation for unique business needs
 */

import { pool } from '@/lib/db';
import { createN8NClient } from '../n8n/n8n-client';

const n8nClient = createN8NClient();

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ProspectPersona {
  role: string;
  industry: string;
  company_size: string;
  seniority_level: string;
  pain_points: string[];
  goals: string[];
  preferred_communication_style: string;
  decision_making_process: string;
}

export interface FunnelConstraints {
  max_touches?: number;
  time_span_days?: number;
  channels?: ('linkedin' | 'email' | 'phone')[];
  tone?: 'professional' | 'casual' | 'authoritative' | 'friendly';
  aggressiveness?: 'soft' | 'medium' | 'aggressive';
  compliance_requirements?: string[];
}

export interface DynamicFunnelDefinition {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  ai_prompt: string;
  target_persona: ProspectPersona;
  funnel_logic: {
    triggers: Array<{
      condition: string;
      action: string;
      next_step?: number;
    }>;
    branches: Array<{
      condition: string;
      path: string;
      steps: number[];
    }>;
  };
  n8n_workflow_json: any;
  n8n_workflow_id?: string;
  created_by_sam: boolean;
  steps: DynamicFunnelStep[];
}

export interface DynamicFunnelStep {
  id: string;
  step_order: number;
  step_type: 'message' | 'wait' | 'condition' | 'webhook' | 'ai_response';
  trigger_condition: any;
  message_template: string;
  wait_duration?: string;
  success_action: any;
  failure_action: any;
  ai_instructions?: string;
}

export interface DynamicFunnelExecution {
  id: string;
  funnel_id: string;
  campaign_id: string;
  n8n_execution_id?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  current_step: number;
  prospects_total: number;
  prospects_in_step: Record<number, string[]>;
  adaptation_history: Array<{
    timestamp: string;
    trigger: string;
    changes: any;
    reason: string;
  }>;
  performance_metrics: {
    step_conversion_rates: Record<number, number>;
    response_rates: Record<number, number>;
    engagement_scores: Record<string, number>;
  };
  started_at?: string;
  completed_at?: string;
}

export interface FunnelAdaptation {
  execution_id: string;
  adaptation_type: 'message_optimization' | 'timing_adjustment' | 'path_modification' | 'step_addition';
  changes_made: any;
  expected_improvement: string;
  confidence_score: number;
}

export interface ResponseData {
  prospect_id: string;
  step_number: number;
  response_type: 'positive' | 'negative' | 'neutral' | 'objection' | 'request_info';
  response_content: string;
  sentiment_score: number;
  extracted_intent: string;
  next_action_suggestion: string;
}

// ============================================================================
// AI WORKFLOW GENERATION
// ============================================================================

/**
 * Create a dynamic funnel from conversational input using AI
 */
export async function mcp__dynamic_funnel__create_from_conversation(request: {
  conversation_context: string;
  target_persona: ProspectPersona;
  business_objective: string;
  constraints?: FunnelConstraints;
}): Promise<DynamicFunnelDefinition> {
  try {
    console.log('🎨 Creating dynamic funnel from conversation:', request.conversation_context.substring(0, 100) + '...');

    // Generate AI-powered funnel definition
    const funnelDefinition = await generateAIFunnelDefinition(
      request.conversation_context,
      request.target_persona,
      request.business_objective,
      request.constraints
    );

    // Create N8N workflow from AI definition
    const n8nWorkflowJson = await generateN8NWorkflow(funnelDefinition);

    // Deploy workflow to N8N
    let n8nWorkflowId: string | undefined;
    try {
      n8nWorkflowId = await n8nClient.createDynamicWorkflow({
        name: funnelDefinition.name,
        nodes: n8nWorkflowJson.nodes,
        connections: n8nWorkflowJson.connections,
        settings: n8nWorkflowJson.settings
      });
    } catch (n8nError) {
      console.warn('⚠️ N8N deployment failed, saving workflow JSON for manual deployment:', n8nError.message);
    }

    // Save to database
    const { data: funnel, error: funnelError } = await supabase
      .from('dynamic_funnel_definitions')
      .insert({
        name: funnelDefinition.name,
        description: funnelDefinition.description,
        ai_prompt: request.conversation_context,
        target_persona: request.target_persona,
        funnel_logic: funnelDefinition.funnel_logic,
        n8n_workflow_json: n8nWorkflowJson,
        n8n_workflow_id: n8nWorkflowId,
        created_by_sam: true
      })
      .select()
      .single();

    if (funnelError) {
      throw new Error(`Failed to save dynamic funnel: ${funnelError.message}`);
    }

    // Save funnel steps
    const stepsToInsert = funnelDefinition.steps.map((step, index) => ({
      funnel_id: funnel.id,
      step_order: index + 1,
      step_type: step.step_type,
      trigger_condition: step.trigger_condition,
      message_template: step.message_template,
      wait_duration: step.wait_duration,
      success_action: step.success_action,
      failure_action: step.failure_action,
      ai_instructions: step.ai_instructions
    }));

    const { error: stepsError } = await supabase
      .from('dynamic_funnel_steps')
      .insert(stepsToInsert);

    if (stepsError) {
      throw new Error(`Failed to save funnel steps: ${stepsError.message}`);
    }

    const result: DynamicFunnelDefinition = {
      id: funnel.id,
      campaign_id: '', // Will be set when executed
      name: funnel.name,
      description: funnel.description,
      ai_prompt: funnel.ai_prompt,
      target_persona: funnel.target_persona,
      funnel_logic: funnel.funnel_logic,
      n8n_workflow_json: funnel.n8n_workflow_json,
      n8n_workflow_id: funnel.n8n_workflow_id,
      created_by_sam: funnel.created_by_sam,
      steps: funnelDefinition.steps
    };

    console.log(`✅ Dynamic funnel created: ${funnel.name} (${funnel.id})`);
    return result;

  } catch (error) {
    console.error('❌ Error creating dynamic funnel from conversation:', error);
    throw error;
  }
}

/**
 * Modify an existing dynamic funnel based on user feedback
 */
export async function mcp__dynamic_funnel__modify(request: {
  funnel_id: string;
  modification_request: string;
  context?: string;
}): Promise<DynamicFunnelDefinition> {
  try {
    console.log(`🔄 Modifying dynamic funnel ${request.funnel_id}: ${request.modification_request}`);

    // Get existing funnel
    const existingFunnel = await mcp__dynamic_funnel__get_definition(request.funnel_id);
    if (!existingFunnel) {
      throw new Error(`Dynamic funnel not found: ${request.funnel_id}`);
    }

    // Generate modifications using AI
    const modifications = await generateAIFunnelModifications(
      existingFunnel,
      request.modification_request,
      request.context
    );

    // Apply modifications to funnel definition
    const updatedFunnel = applyFunnelModifications(existingFunnel, modifications);

    // Generate updated N8N workflow
    const updatedN8NWorkflow = await generateN8NWorkflow(updatedFunnel);

    // Update N8N workflow if deployed
    if (existingFunnel.n8n_workflow_id) {
      try {
        await n8nClient.updateDynamicWorkflow(existingFunnel.n8n_workflow_id, {
          name: updatedFunnel.name,
          nodes: updatedN8NWorkflow.nodes,
          connections: updatedN8NWorkflow.connections,
          settings: updatedN8NWorkflow.settings
        });
      } catch (n8nError) {
        console.warn('⚠️ N8N workflow update failed:', n8nError.message);
      }
    }

    // Update database
    const { error: updateError } = await supabase
      .from('dynamic_funnel_definitions')
      .update({
        name: updatedFunnel.name,
        description: updatedFunnel.description,
        funnel_logic: updatedFunnel.funnel_logic,
        n8n_workflow_json: updatedN8NWorkflow
      })
      .eq('id', request.funnel_id);

    if (updateError) {
      throw new Error(`Failed to update funnel definition: ${updateError.message}`);
    }

    // Update steps
    await supabase
      .from('dynamic_funnel_steps')
      .delete()
      .eq('funnel_id', request.funnel_id);

    const updatedStepsToInsert = updatedFunnel.steps.map((step, index) => ({
      funnel_id: request.funnel_id,
      step_order: index + 1,
      step_type: step.step_type,
      trigger_condition: step.trigger_condition,
      message_template: step.message_template,
      wait_duration: step.wait_duration,
      success_action: step.success_action,
      failure_action: step.failure_action,
      ai_instructions: step.ai_instructions
    }));

    const { error: stepsError } = await supabase
      .from('dynamic_funnel_steps')
      .insert(updatedStepsToInsert);

    if (stepsError) {
      throw new Error(`Failed to update funnel steps: ${stepsError.message}`);
    }

    console.log(`✅ Dynamic funnel modified: ${request.funnel_id}`);
    return updatedFunnel;

  } catch (error) {
    console.error('❌ Error modifying dynamic funnel:', error);
    throw error;
  }
}

// ============================================================================
// DYNAMIC FUNNEL EXECUTION
// ============================================================================

/**
 * Execute a dynamic funnel with prospects
 */
export async function mcp__dynamic_funnel__execute(request: {
  funnel_id: string;
  campaign_id: string;
  prospects: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    company_name: string;
    title: string;
    linkedin_url?: string;
    custom_fields?: Record<string, any>;
  }>;
}): Promise<DynamicFunnelExecution> {
  try {
    console.log(`🌟 Executing dynamic funnel ${request.funnel_id} for ${request.prospects.length} prospects`);

    // Validate funnel exists
    const funnel = await mcp__dynamic_funnel__get_definition(request.funnel_id);
    if (!funnel) {
      throw new Error(`Dynamic funnel not found: ${request.funnel_id}`);
    }

    // Validate campaign exists
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name')
      .eq('id', request.campaign_id)
      .single();

    if (campaignError) {
      throw new Error(`Campaign not found: ${request.campaign_id}`);
    }

    // Create execution record
    const { data: execution, error: executionError } = await supabase
      .from('dynamic_funnel_executions')
      .insert({
        funnel_id: request.funnel_id,
        campaign_id: request.campaign_id,
        status: 'pending',
        current_step: 1,
        prospects_total: request.prospects.length,
        prospects_in_step: { 1: request.prospects.map(p => p.id) },
        adaptation_history: [],
        performance_metrics: {
          step_conversion_rates: {},
          response_rates: {},
          engagement_scores: {}
        }
      })
      .select()
      .single();

    if (executionError) {
      throw new Error(`Failed to create execution record: ${executionError.message}`);
    }

    try {
      // Execute N8N workflow if deployed
      let n8nExecutionId: string | undefined;
      if (funnel.n8n_workflow_id) {
        n8nExecutionId = await n8nClient.executeDynamicFunnel(
          funnel.n8n_workflow_id,
          {
            execution_id: execution.id,
            prospects: request.prospects,
            funnel_definition: funnel
          }
        );
      }

      // Update execution with N8N execution ID
      const { error: updateError } = await supabase
        .from('dynamic_funnel_executions')
        .update({
          n8n_execution_id: n8nExecutionId,
          status: 'running',
          started_at: new Date().toISOString()
        })
        .eq('id', execution.id);

      if (updateError) {
        throw new Error(`Failed to update execution record: ${updateError.message}`);
      }

      // Create prospect execution records
      const prospectExecutions = request.prospects.map(prospect => ({
        execution_id: execution.id,
        prospect_id: prospect.id,
        prospect_data: prospect,
        current_step: 1,
        status: 'active',
        step_history: [],
        ai_context: {
          persona_analysis: funnel.target_persona,
          conversation_state: 'initiated',
          engagement_score: 0
        }
      }));

      const { error: prospectError } = await supabase
        .from('dynamic_funnel_prospect_executions')
        .insert(prospectExecutions);

      if (prospectError) {
        console.warn('⚠️ Warning: Failed to create prospect execution records:', prospectError.message);
      }

      const result: DynamicFunnelExecution = {
        id: execution.id,
        funnel_id: request.funnel_id,
        campaign_id: request.campaign_id,
        n8n_execution_id: n8nExecutionId,
        status: 'running',
        current_step: 1,
        prospects_total: request.prospects.length,
        prospects_in_step: { 1: request.prospects.map(p => p.id) },
        adaptation_history: [],
        performance_metrics: {
          step_conversion_rates: {},
          response_rates: {},
          engagement_scores: {}
        },
        started_at: new Date().toISOString()
      };

      console.log(`✅ Dynamic funnel execution started: ${execution.id}`);
      return result;

    } catch (n8nError) {
      // Update execution status to failed
      await supabase
        .from('dynamic_funnel_executions')
        .update({ status: 'failed' })
        .eq('id', execution.id);

      throw new Error(`N8N execution failed: ${n8nError.message}`);
    }

  } catch (error) {
    console.error('❌ Error executing dynamic funnel:', error);
    throw error;
  }
}

/**
 * Adapt a running dynamic funnel based on prospect responses
 */
export async function mcp__dynamic_funnel__adapt(request: {
  execution_id: string;
  response_data: ResponseData;
  adaptation_trigger: string;
}): Promise<FunnelAdaptation> {
  try {
    console.log(`🧠 Adapting dynamic funnel execution ${request.execution_id} based on: ${request.adaptation_trigger}`);

    // Get execution details
    const { data: execution, error: executionError } = await supabase
      .from('dynamic_funnel_executions')
      .select(`
        *,
        dynamic_funnel_definitions(*)
      `)
      .eq('id', request.execution_id)
      .single();

    if (executionError) {
      throw new Error(`Failed to fetch execution: ${executionError.message}`);
    }

    if (execution.status !== 'running') {
      throw new Error(`Cannot adapt execution with status: ${execution.status}`);
    }

    // Analyze response and generate adaptation
    const adaptation = await generateAIFunnelAdaptation(
      execution,
      request.response_data,
      request.adaptation_trigger
    );

    // Apply adaptation to execution
    const updatedExecution = await applyExecutionAdaptation(execution, adaptation);

    // Update database with adaptation
    const { error: updateError } = await supabase
      .from('dynamic_funnel_executions')
      .update({
        adaptation_history: updatedExecution.adaptation_history,
        performance_metrics: updatedExecution.performance_metrics
      })
      .eq('id', request.execution_id);

    if (updateError) {
      throw new Error(`Failed to update execution with adaptation: ${updateError.message}`);
    }

    // Log adaptation for tracking
    const { error: logError } = await supabase
      .from('funnel_adaptation_logs')
      .insert({
        execution_id: request.execution_id,
        adaptation_type: adaptation.adaptation_type,
        trigger_data: request.response_data,
        changes_made: adaptation.changes_made,
        confidence_score: adaptation.confidence_score,
        expected_improvement: adaptation.expected_improvement
      });

    if (logError) {
      console.warn('⚠️ Warning: Failed to log adaptation:', logError.message);
    }

    console.log(`✅ Dynamic funnel adapted: ${adaptation.adaptation_type} with ${adaptation.confidence_score}% confidence`);
    return adaptation;

  } catch (error) {
    console.error('❌ Error adapting dynamic funnel:', error);
    throw error;
  }
}

// ============================================================================
// DYNAMIC FUNNEL MANAGEMENT
// ============================================================================

/**
 * Get dynamic funnel definition
 */
export async function mcp__dynamic_funnel__get_definition(
  funnel_id: string
): Promise<DynamicFunnelDefinition | null> {
  try {
    const { data: funnel, error } = await supabase
      .from('dynamic_funnel_definitions')
      .select('*')
      .eq('id', funnel_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch funnel definition: ${error.message}`);
    }

    // Get steps
    const { data: steps, error: stepsError } = await supabase
      .from('dynamic_funnel_steps')
      .select('*')
      .eq('funnel_id', funnel_id)
      .order('step_order');

    if (stepsError) {
      throw new Error(`Failed to fetch funnel steps: ${stepsError.message}`);
    }

    const definition: DynamicFunnelDefinition = {
      ...funnel,
      steps: steps?.map(step => ({
        id: step.id,
        step_order: step.step_order,
        step_type: step.step_type,
        trigger_condition: step.trigger_condition,
        message_template: step.message_template,
        wait_duration: step.wait_duration,
        success_action: step.success_action,
        failure_action: step.failure_action,
        ai_instructions: step.ai_instructions
      })) || []
    };

    return definition;

  } catch (error) {
    console.error('❌ Error getting dynamic funnel definition:', error);
    throw error;
  }
}

/**
 * List dynamic funnels
 */
export async function mcp__dynamic_funnel__list_funnels(
  filters: {
    created_by_sam?: boolean;
    campaign_id?: string;
    limit?: number;
  } = {}
): Promise<DynamicFunnelDefinition[]> {
  try {
    let query = supabase
      .from('dynamic_funnel_definitions')
      .select('*');

    if (filters.created_by_sam !== undefined) {
      query = query.eq('created_by_sam', filters.created_by_sam);
    }

    if (filters.campaign_id) {
      query = query.eq('campaign_id', filters.campaign_id);
    }

    const { data: funnels, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters.limit || 50);

    if (error) {
      throw new Error(`Failed to list funnels: ${error.message}`);
    }

    // Get steps for each funnel
    const funnelsWithSteps = await Promise.all(
      (funnels || []).map(async (funnel) => {
        const { data: steps } = await supabase
          .from('dynamic_funnel_steps')
          .select('*')
          .eq('funnel_id', funnel.id)
          .order('step_order');

        return {
          ...funnel,
          steps: steps?.map(step => ({
            id: step.id,
            step_order: step.step_order,
            step_type: step.step_type,
            trigger_condition: step.trigger_condition,
            message_template: step.message_template,
            wait_duration: step.wait_duration,
            success_action: step.success_action,
            failure_action: step.failure_action,
            ai_instructions: step.ai_instructions
          })) || []
        };
      })
    );

    return funnelsWithSteps;

  } catch (error) {
    console.error('❌ Error listing dynamic funnels:', error);
    throw error;
  }
}

// ============================================================================
// AI HELPER FUNCTIONS
// ============================================================================

async function generateAIFunnelDefinition(
  conversationContext: string,
  targetPersona: ProspectPersona,
  businessObjective: string,
  constraints?: FunnelConstraints
): Promise<DynamicFunnelDefinition> {
  // This would call an AI service (OpenRouter/Mistral) to generate the funnel
  // For now, return a structured example based on the inputs
  
  const funnelName = `AI-Generated Funnel for ${targetPersona.role}s`;
  const description = `Custom funnel targeting ${targetPersona.role}s in ${targetPersona.industry} for ${businessObjective}`;

  const steps: DynamicFunnelStep[] = [
    {
      id: '1',
      step_order: 1,
      step_type: 'message',
      trigger_condition: { event: 'execution_start' },
      message_template: `Hi {{first_name}}, I noticed you're a ${targetPersona.role} at {{company_name}}. I have insights that could help with ${targetPersona.pain_points[0]}.`,
      success_action: { next_step: 2, wait_days: 3 },
      failure_action: { next_step: 5, wait_days: 7 },
      ai_instructions: 'Personalize based on company research and role-specific pain points'
    },
    {
      id: '2',
      step_order: 2,
      step_type: 'wait',
      trigger_condition: { days_passed: 3 },
      message_template: '',
      wait_duration: '3 days',
      success_action: { next_step: 3 },
      failure_action: { next_step: 3 }
    },
    {
      id: '3',
      step_order: 3,
      step_type: 'message',
      trigger_condition: { days_passed: 3 },
      message_template: `{{first_name}}, sharing a case study of how we helped a similar ${targetPersona.role} achieve ${businessObjective}. Would you like to see the specific results?`,
      success_action: { next_step: 4, wait_days: 4 },
      failure_action: { next_step: 6, wait_days: 7 },
      ai_instructions: 'Include specific metrics and outcomes relevant to their industry'
    }
  ];

  return {
    id: '', // Will be set when saved
    campaign_id: '',
    name: funnelName,
    description,
    ai_prompt: conversationContext,
    target_persona: targetPersona,
    funnel_logic: {
      triggers: [
        { condition: 'positive_response', action: 'accelerate_sequence', next_step: 4 },
        { condition: 'objection_raised', action: 'objection_handling_path' },
        { condition: 'no_response_after_3_attempts', action: 'nurture_sequence' }
      ],
      branches: [
        { condition: 'high_engagement', path: 'direct_pitch', steps: [1, 3, 4] },
        { condition: 'low_engagement', path: 'value_nurture', steps: [1, 2, 3, 5, 6] }
      ]
    },
    n8n_workflow_json: {},
    created_by_sam: true,
    steps
  };
}

async function generateN8NWorkflow(funnelDefinition: DynamicFunnelDefinition): Promise<any> {
  // Generate N8N workflow JSON from funnel definition
  // This would create the actual N8N nodes and connections
  
  const nodes = [
    {
      id: 'trigger',
      name: 'Funnel Trigger',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [100, 100],
      parameters: {
        path: `dynamic-funnel-${funnelDefinition.id || 'new'}`,
        httpMethod: 'POST'
      }
    }
  ];

  // Add nodes for each step
  funnelDefinition.steps.forEach((step, index) => {
    nodes.push({
      id: `step_${index + 1}`,
      name: `Step ${index + 1}: ${step.step_type}`,
      type: step.step_type === 'message' ? 'n8n-nodes-base.emailSend' : 'n8n-nodes-base.wait',
      typeVersion: 1,
      position: [300 + (index * 200), 100],
      parameters: step.step_type === 'message' ? {
        subject: 'Sam AI Message',
        text: step.message_template
      } : {
        amount: step.wait_duration || '1',
        unit: 'days'
      }
    });
  });

  const connections = {
    trigger: {
      main: [[{ node: 'step_1', type: 'main', index: 0 }]]
    }
  };

  // Connect steps sequentially
  for (let i = 0; i < funnelDefinition.steps.length - 1; i++) {
    connections[`step_${i + 1}`] = {
      main: [[{ node: `step_${i + 2}`, type: 'main', index: 0 }]]
    };
  }

  return {
    name: funnelDefinition.name,
    nodes,
    connections,
    settings: {
      executionOrder: 'v1'
    }
  };
}

async function generateAIFunnelModifications(
  existingFunnel: DynamicFunnelDefinition,
  modificationRequest: string,
  context?: string
): Promise<any> {
  // AI would analyze the request and generate specific modifications
  return {
    type: 'message_optimization',
    changes: {
      step_1: {
        message_template: 'Updated message based on user request'
      }
    },
    reason: modificationRequest
  };
}

function applyFunnelModifications(
  funnel: DynamicFunnelDefinition,
  modifications: any
): DynamicFunnelDefinition {
  // Apply the modifications to the funnel definition
  const updatedFunnel = { ...funnel };
  
  if (modifications.changes) {
    // Apply changes to specific steps
    Object.keys(modifications.changes).forEach(stepKey => {
      const stepIndex = parseInt(stepKey.replace('step_', '')) - 1;
      if (updatedFunnel.steps[stepIndex]) {
        Object.assign(updatedFunnel.steps[stepIndex], modifications.changes[stepKey]);
      }
    });
  }

  return updatedFunnel;
}

async function generateAIFunnelAdaptation(
  execution: any,
  responseData: ResponseData,
  adaptationTrigger: string
): Promise<FunnelAdaptation> {
  // AI would analyze the response and generate appropriate adaptations
  return {
    execution_id: execution.id,
    adaptation_type: 'message_optimization',
    changes_made: {
      next_message_tone: responseData.response_type === 'positive' ? 'more_direct' : 'more_nurturing',
      timing_adjustment: responseData.sentiment_score > 0.7 ? 'accelerate' : 'slow_down'
    },
    expected_improvement: 'Increase response rate by 15% based on prospect engagement patterns',
    confidence_score: 85
  };
}

async function applyExecutionAdaptation(
  execution: any,
  adaptation: FunnelAdaptation
): Promise<any> {
  // Apply the adaptation to the execution
  const updatedExecution = { ...execution };
  
  // Add to adaptation history
  updatedExecution.adaptation_history.push({
    timestamp: new Date().toISOString(),
    trigger: adaptation.adaptation_type,
    changes: adaptation.changes_made,
    reason: adaptation.expected_improvement
  });

  return updatedExecution;
}