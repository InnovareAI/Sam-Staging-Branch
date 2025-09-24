/**
 * SAM Enhanced Core Funnel MCP Tools
 * Complete data intelligence pipeline with scraping, enrichment, and personalization
 * Integrates WebSearch, Apify, Bright Data, Unipile, ActiveCampaign, and Airtable MCP servers
 */

import { createClient } from '@supabase/supabase-js';
import { createN8NClient } from '../n8n/n8n-client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const n8nClient = createN8NClient();

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface CoreFunnelTemplate {
  id: string;
  funnel_type: 'sam_signature' | 'event_invitation' | 'product_launch' | 'partnership' | 'nurture_sequence';
  name: string;
  description: string;
  industry?: string;
  target_role?: string;
  company_size?: string;
  n8n_workflow_id: string;
  n8n_workflow_json?: any; // Complete workflow definition with MCP integrations
  step_count: number;
  avg_response_rate: number;
  avg_conversion_rate: number;
  total_executions: number;
  default_timing?: any; // Timing configuration for each step
  message_templates?: any; // Templates with personalization variables
  personalization_variables?: string[]; // Available variables for personalization
  is_active: boolean;
  is_featured?: boolean;
  tags?: string[];
  created_at: string;
  sequence_steps?: FunnelStep[]; // Backward compatibility
}

export interface FunnelStep {
  day: number;
  step_type: 'connection_request' | 'thank_you' | 'value_share' | 'demo_invite' | 'follow_up';
  message_template: string;
  success_criteria: string;
}

export interface CoreFunnelExecution {
  id: string;
  campaign_id: string;
  template_id: string;
  n8n_execution_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  prospects_total: number;
  prospects_processed: number;
  started_at: string;
  completed_at?: string;
}

export interface CoreFunnelFilters {
  industry?: string;
  funnel_type?: string;
  min_conversion_rate?: number;
}

export interface CoreFunnelExecuteRequest {
  template_id: string;
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
  variables?: Record<string, any>;
}

export interface CoreFunnelStatus {
  execution_id: string;
  status: string;
  progress: {
    prospects_total: number;
    prospects_processed: number;
    current_step: number;
    completion_percentage: number;
  };
  performance: {
    connections_sent: number;
    connections_accepted: number;
    responses_received: number;
    meetings_booked: number;
    response_rate: number;
    connection_rate: number;
  };
  next_actions: string[];
  estimated_completion: string;
}

// ============================================================================
// CORE FUNNEL TEMPLATES
// ============================================================================

/**
 * List all available core funnel templates
 */
export async function mcp__core_funnel__list_templates(
  filters: CoreFunnelFilters = {}
): Promise<CoreFunnelTemplate[]> {
  try {
    console.log('🎯 Listing core funnel templates with filters:', filters);

    let query = supabase
      .from('core_funnel_templates')
      .select('*')
      .eq('is_active', true);

    if (filters.industry) {
      query = query.eq('industry', filters.industry);
    }

    if (filters.funnel_type) {
      query = query.eq('funnel_type', filters.funnel_type);
    }

    if (filters.min_conversion_rate) {
      query = query.gte('avg_conversion_rate', filters.min_conversion_rate);
    }

    const { data: templates, error } = await query.order('avg_response_rate', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch core funnel templates: ${error.message}`);
    }

    console.log(`✅ Found ${templates?.length || 0} core funnel templates`);
    return templates || [];

  } catch (error) {
    console.error('❌ Error listing core funnel templates:', error);
    throw error;
  }
}

/**
 * Get detailed template information including sequence steps
 */
export async function mcp__core_funnel__get_template(
  template_id: string
): Promise<CoreFunnelTemplate | null> {
  try {
    console.log('📋 Getting core funnel template:', template_id);

    const { data: template, error } = await supabase
      .from('core_funnel_templates')
      .select('*')
      .eq('id', template_id)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Template not found
      }
      throw new Error(`Failed to fetch template: ${error.message}`);
    }

    // Add sequence steps for backward compatibility (if steps table exists)
    let templateWithSteps: CoreFunnelTemplate = { ...template };
    
    try {
      const { data: steps, error: stepsError } = await supabase
        .from('core_funnel_steps')
        .select('*')
        .eq('template_id', template_id)
        .order('step_order');

      if (!stepsError && steps) {
        templateWithSteps.sequence_steps = steps.map(step => ({
          day: step.day_number,
          step_type: step.step_type,
          message_template: step.message_template,
          success_criteria: step.success_criteria
        }));
      }
    } catch (stepsError) {
      // Steps table might not exist in new schema - continue without it
      console.log('ℹ️ No sequence steps table found - using enhanced workflow definition');
    }

    console.log(`✅ Retrieved enhanced template: ${template.name} with ${template.step_count} steps`);
    return templateWithSteps;

  } catch (error) {
    console.error('❌ Error getting core funnel template:', error);
    throw error;
  }
}

// ============================================================================
// CORE FUNNEL EXECUTION
// ============================================================================

/**
 * Execute a core funnel with prospects
 */
export async function mcp__core_funnel__execute(
  request: CoreFunnelExecuteRequest
): Promise<CoreFunnelExecution> {
  try {
    console.log(`⚡ Executing core funnel ${request.template_id} for ${request.prospects.length} prospects`);

    // Validate template exists
    const template = await mcp__core_funnel__get_template(request.template_id);
    if (!template) {
      throw new Error(`Core funnel template not found: ${request.template_id}`);
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
      .from('core_funnel_executions')
      .insert({
        campaign_id: request.campaign_id,
        template_id: request.template_id,
        status: 'pending',
        prospects_total: request.prospects.length,
        prospects_processed: 0
      })
      .select()
      .single();

    if (executionError) {
      throw new Error(`Failed to create execution record: ${executionError.message}`);
    }

    try {
      // Execute N8N workflow
      const n8nExecutionId = await n8nClient.executeCoreFunnel(
        template.n8n_workflow_id,
        request.prospects
      );

      // Update execution with N8N execution ID
      const { error: updateError } = await supabase
        .from('core_funnel_executions')
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
        status: 'pending'
      }));

      const { error: prospectError } = await supabase
        .from('core_funnel_prospect_executions')
        .insert(prospectExecutions);

      if (prospectError) {
        console.warn('⚠️ Warning: Failed to create prospect execution records:', prospectError.message);
      }

      const result: CoreFunnelExecution = {
        id: execution.id,
        campaign_id: request.campaign_id,
        template_id: request.template_id,
        n8n_execution_id: n8nExecutionId,
        status: 'running',
        prospects_total: request.prospects.length,
        prospects_processed: 0,
        started_at: new Date().toISOString()
      };

      console.log(`✅ Core funnel execution started: ${execution.id}`);
      return result;

    } catch (n8nError) {
      // Update execution status to failed
      await supabase
        .from('core_funnel_executions')
        .update({ status: 'failed' })
        .eq('id', execution.id);

      throw new Error(`N8N execution failed: ${n8nError.message}`);
    }

  } catch (error) {
    console.error('❌ Error executing core funnel:', error);
    throw error;
  }
}

/**
 * Get core funnel execution status and progress
 */
export async function mcp__core_funnel__get_status(
  execution_id: string
): Promise<CoreFunnelStatus | null> {
  try {
    console.log('📊 Getting core funnel execution status:', execution_id);

    // Get execution record
    const { data: execution, error: executionError } = await supabase
      .from('core_funnel_executions')
      .select(`
        *,
        campaigns(name),
        core_funnel_templates(name, funnel_type)
      `)
      .eq('id', execution_id)
      .single();

    if (executionError) {
      if (executionError.code === 'PGRST116') {
        return null; // Execution not found
      }
      throw new Error(`Failed to fetch execution: ${executionError.message}`);
    }

    // Get N8N execution status if available
    let n8nStatus = null;
    if (execution.n8n_execution_id) {
      try {
        n8nStatus = await n8nClient.getExecutionStatus(execution.n8n_execution_id);
      } catch (n8nError) {
        console.warn('⚠️ Could not fetch N8N execution status:', n8nError.message);
      }
    }

    // Get prospect execution statistics
    const { data: prospectStats, error: statsError } = await supabase
      .from('core_funnel_prospect_executions')
      .select('status, current_step')
      .eq('execution_id', execution_id);

    if (statsError) {
      throw new Error(`Failed to fetch prospect statistics: ${statsError.message}`);
    }

    // Calculate progress and performance metrics
    const totalProspects = execution.prospects_total;
    const processedProspects = prospectStats?.filter(p => p.status !== 'pending').length || 0;
    const completionPercentage = totalProspects > 0 ? (processedProspects / totalProspects) * 100 : 0;

    // Get performance metrics from prospect execution logs
    const { data: performanceData, error: perfError } = await supabase
      .from('core_funnel_prospect_executions')
      .select('status, step_results')
      .eq('execution_id', execution_id);

    if (perfError) {
      console.warn('⚠️ Could not fetch performance data:', perfError.message);
    }

    // Calculate performance metrics
    const connections_sent = performanceData?.filter(p => 
      p.step_results?.some((r: any) => r.step_type === 'connection_request' && r.status === 'sent')
    ).length || 0;

    const connections_accepted = performanceData?.filter(p => 
      p.step_results?.some((r: any) => r.step_type === 'connection_request' && r.status === 'accepted')
    ).length || 0;

    const responses_received = performanceData?.filter(p => 
      p.step_results?.some((r: any) => r.response_received === true)
    ).length || 0;

    const meetings_booked = performanceData?.filter(p => 
      p.step_results?.some((r: any) => r.meeting_booked === true)
    ).length || 0;

    // Determine next actions
    const next_actions = [];
    if (execution.status === 'running') {
      next_actions.push('Monitor execution progress');
      if (processedProspects < totalProspects) {
        next_actions.push(`${totalProspects - processedProspects} prospects still processing`);
      }
    } else if (execution.status === 'completed') {
      next_actions.push('Review campaign results');
      next_actions.push('Analyze response patterns');
      next_actions.push('Schedule follow-up activities');
    } else if (execution.status === 'failed') {
      next_actions.push('Review error logs');
      next_actions.push('Consider restarting execution');
    }

    // Estimate completion time
    let estimated_completion = 'Unknown';
    if (execution.status === 'running' && execution.started_at) {
      const startTime = new Date(execution.started_at);
      const elapsed = Date.now() - startTime.getTime();
      if (processedProspects > 0) {
        const avgTimePerProspect = elapsed / processedProspects;
        const remainingProspects = totalProspects - processedProspects;
        const estimatedRemainingTime = remainingProspects * avgTimePerProspect;
        const completionTime = new Date(Date.now() + estimatedRemainingTime);
        estimated_completion = completionTime.toISOString();
      }
    }

    const status: CoreFunnelStatus = {
      execution_id,
      status: execution.status,
      progress: {
        prospects_total: totalProspects,
        prospects_processed: processedProspects,
        current_step: Math.max(...(prospectStats?.map(p => p.current_step) || [1])),
        completion_percentage: Math.round(completionPercentage)
      },
      performance: {
        connections_sent,
        connections_accepted,
        responses_received,
        meetings_booked,
        response_rate: connections_sent > 0 ? Math.round((responses_received / connections_sent) * 100) : 0,
        connection_rate: connections_sent > 0 ? Math.round((connections_accepted / connections_sent) * 100) : 0
      },
      next_actions,
      estimated_completion
    };

    console.log(`✅ Retrieved execution status for ${execution_id}`);
    return status;

  } catch (error) {
    console.error('❌ Error getting core funnel status:', error);
    throw error;
  }
}

/**
 * Stop a running core funnel execution
 */
export async function mcp__core_funnel__stop_execution(
  execution_id: string
): Promise<boolean> {
  try {
    console.log('⏹️ Stopping core funnel execution:', execution_id);

    // Get execution record
    const { data: execution, error: executionError } = await supabase
      .from('core_funnel_executions')
      .select('n8n_execution_id, status')
      .eq('id', execution_id)
      .single();

    if (executionError) {
      throw new Error(`Failed to fetch execution: ${executionError.message}`);
    }

    if (execution.status !== 'running') {
      throw new Error(`Cannot stop execution with status: ${execution.status}`);
    }

    // Stop N8N execution if available
    if (execution.n8n_execution_id) {
      try {
        await n8nClient.stopExecution(execution.n8n_execution_id);
      } catch (n8nError) {
        console.warn('⚠️ Could not stop N8N execution:', n8nError.message);
      }
    }

    // Update execution status
    const { error: updateError } = await supabase
      .from('core_funnel_executions')
      .update({
        status: 'stopped',
        completed_at: new Date().toISOString()
      })
      .eq('id', execution_id);

    if (updateError) {
      throw new Error(`Failed to update execution status: ${updateError.message}`);
    }

    console.log(`✅ Core funnel execution stopped: ${execution_id}`);
    return true;

  } catch (error) {
    console.error('❌ Error stopping core funnel execution:', error);
    throw error;
  }
}

/**
 * List recent core funnel executions
 */
export async function mcp__core_funnel__list_executions(
  filters: {
    campaign_id?: string;
    status?: string;
    limit?: number;
  } = {}
): Promise<CoreFunnelExecution[]> {
  try {
    console.log('📋 Listing core funnel executions with filters:', filters);

    let query = supabase
      .from('core_funnel_executions')
      .select(`
        *,
        campaigns(name),
        core_funnel_templates(name, funnel_type)
      `);

    if (filters.campaign_id) {
      query = query.eq('campaign_id', filters.campaign_id);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data: executions, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters.limit || 50);

    if (error) {
      throw new Error(`Failed to fetch executions: ${error.message}`);
    }

    console.log(`✅ Found ${executions?.length || 0} core funnel executions`);
    return executions || [];

  } catch (error) {
    console.error('❌ Error listing core funnel executions:', error);
    throw error;
  }
}

// ============================================================================
// CORE FUNNEL ANALYTICS
// ============================================================================

/**
 * Get performance analytics for core funnels
 */
export async function mcp__core_funnel__get_analytics(
  filters: {
    template_id?: string;
    campaign_id?: string;
    date_from?: string;
    date_to?: string;
  } = {}
): Promise<{
  summary: {
    total_executions: number;
    total_prospects: number;
    avg_response_rate: number;
    avg_conversion_rate: number;
    total_meetings_booked: number;
  };
  by_template: Array<{
    template_id: string;
    template_name: string;
    executions: number;
    prospects: number;
    response_rate: number;
    conversion_rate: number;
  }>;
  by_industry: Array<{
    industry: string;
    executions: number;
    prospects: number;
    response_rate: number;
    conversion_rate: number;
  }>;
}> {
  try {
    console.log('📈 Getting core funnel analytics with filters:', filters);

    // Build base query
    let executionsQuery = supabase
      .from('core_funnel_executions')
      .select(`
        *,
        core_funnel_templates(industry, name, funnel_type)
      `)
      .eq('status', 'completed');

    if (filters.template_id) {
      executionsQuery = executionsQuery.eq('template_id', filters.template_id);
    }

    if (filters.campaign_id) {
      executionsQuery = executionsQuery.eq('campaign_id', filters.campaign_id);
    }

    if (filters.date_from) {
      executionsQuery = executionsQuery.gte('created_at', filters.date_from);
    }

    if (filters.date_to) {
      executionsQuery = executionsQuery.lte('created_at', filters.date_to);
    }

    const { data: executions, error } = await executionsQuery;

    if (error) {
      throw new Error(`Failed to fetch analytics data: ${error.message}`);
    }

    // Calculate summary metrics
    const totalExecutions = executions?.length || 0;
    const totalProspects = executions?.reduce((sum, exec) => sum + exec.prospects_total, 0) || 0;

    // Get detailed performance data
    const { data: performanceData, error: perfError } = await supabase
      .from('funnel_performance_metrics')
      .select('*')
      .eq('funnel_type', 'core')
      .in('execution_id', executions?.map(e => e.id) || []);

    if (perfError) {
      console.warn('⚠️ Could not fetch performance data:', perfError.message);
    }

    const avgResponseRate = performanceData?.length 
      ? performanceData.reduce((sum, p) => sum + (p.response_rate || 0), 0) / performanceData.length
      : 0;

    const avgConversionRate = performanceData?.length 
      ? performanceData.reduce((sum, p) => sum + (p.conversion_rate || 0), 0) / performanceData.length
      : 0;

    const totalMeetingsBooked = performanceData?.reduce((sum, p) => sum + (p.prospects_converted || 0), 0) || 0;

    // Group by template
    const templateGroups = new Map();
    executions?.forEach(exec => {
      const templateId = exec.template_id;
      if (!templateGroups.has(templateId)) {
        templateGroups.set(templateId, {
          template_id: templateId,
          template_name: exec.core_funnel_templates?.name || 'Unknown',
          executions: 0,
          prospects: 0,
          response_rates: [],
          conversion_rates: []
        });
      }
      
      const group = templateGroups.get(templateId);
      group.executions++;
      group.prospects += exec.prospects_total;
      
      const perf = performanceData?.find(p => p.execution_id === exec.id);
      if (perf) {
        group.response_rates.push(perf.response_rate || 0);
        group.conversion_rates.push(perf.conversion_rate || 0);
      }
    });

    const byTemplate = Array.from(templateGroups.values()).map(group => ({
      template_id: group.template_id,
      template_name: group.template_name,
      executions: group.executions,
      prospects: group.prospects,
      response_rate: group.response_rates.length 
        ? Math.round(group.response_rates.reduce((a, b) => a + b, 0) / group.response_rates.length)
        : 0,
      conversion_rate: group.conversion_rates.length 
        ? Math.round(group.conversion_rates.reduce((a, b) => a + b, 0) / group.conversion_rates.length)
        : 0
    }));

    // Group by industry
    const industryGroups = new Map();
    executions?.forEach(exec => {
      const industry = exec.core_funnel_templates?.industry || 'Unknown';
      if (!industryGroups.has(industry)) {
        industryGroups.set(industry, {
          industry,
          executions: 0,
          prospects: 0,
          response_rates: [],
          conversion_rates: []
        });
      }
      
      const group = industryGroups.get(industry);
      group.executions++;
      group.prospects += exec.prospects_total;
      
      const perf = performanceData?.find(p => p.execution_id === exec.id);
      if (perf) {
        group.response_rates.push(perf.response_rate || 0);
        group.conversion_rates.push(perf.conversion_rate || 0);
      }
    });

    const byIndustry = Array.from(industryGroups.values()).map(group => ({
      industry: group.industry,
      executions: group.executions,
      prospects: group.prospects,
      response_rate: group.response_rates.length 
        ? Math.round(group.response_rates.reduce((a, b) => a + b, 0) / group.response_rates.length)
        : 0,
      conversion_rate: group.conversion_rates.length 
        ? Math.round(group.conversion_rates.reduce((a, b) => a + b, 0) / group.conversion_rates.length)
        : 0
    }));

    const analytics = {
      summary: {
        total_executions: totalExecutions,
        total_prospects: totalProspects,
        avg_response_rate: Math.round(avgResponseRate),
        avg_conversion_rate: Math.round(avgConversionRate),
        total_meetings_booked: totalMeetingsBooked
      },
      by_template: byTemplate,
      by_industry: byIndustry
    };

    console.log(`✅ Retrieved analytics for ${totalExecutions} executions`);
    return analytics;

  } catch (error) {
    console.error('❌ Error getting core funnel analytics:', error);
    throw error;
  }
}