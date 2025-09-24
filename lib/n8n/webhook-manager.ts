/**
 * N8N Webhook Manager for Sam AI Dual Funnel System
 * Handles incoming webhooks from both Core and Dynamic funnels
 */

import { supabaseAdmin } from '@/app/lib/supabase';

export interface WebhookPayload {
  executionId: string;
  workflowId: string;
  nodeId: string;
  data: any;
  timestamp: string;
  eventType: 'step_completed' | 'step_failed' | 'prospect_responded' | 'execution_completed' | 'execution_failed';
}

export interface CoreFunnelWebhook extends WebhookPayload {
  funnelType: 'core';
  templateId: string;
  campaignId: string;
  prospectId: string;
  stepName: string;
  stepResult: 'success' | 'failure' | 'pending';
}

export interface DynamicFunnelWebhook extends WebhookPayload {
  funnelType: 'dynamic';
  definitionId: string;
  campaignId: string;
  prospectId: string;
  stepOrder: number;
  adaptationTrigger?: string;
}

export interface StepData {
  stepId: string;
  stepType: 'message_sent' | 'response_received' | 'meeting_booked' | 'unsubscribed';
  result: 'success' | 'failure' | 'pending';
  responseData?: any;
  metadata?: Record<string, any>;
}

export interface ProspectProgress {
  prospectId: string;
  campaignId: string;
  currentStep: number;
  totalSteps: number;
  status: 'active' | 'completed' | 'failed' | 'paused';
  lastActivity: string;
  responseHistory: StepData[];
}

export class WebhookManager {
  private supabase = supabaseAdmin();

  // ============================================================================
  // MAIN WEBHOOK HANDLER
  // ============================================================================

  /**
   * Handle incoming webhook from N8N workflows
   */
  async handleWorkflowWebhook(payload: WebhookPayload): Promise<void> {
    try {
      console.log(`📨 Processing N8N webhook: ${payload.eventType} from ${payload.workflowId}`);

      // Determine funnel type and route appropriately
      const funnelType = await this.determineFunnelType(payload.workflowId);
      
      if (funnelType === 'core') {
        await this.routeCoreFunnelWebhook(payload as CoreFunnelWebhook);
      } else if (funnelType === 'dynamic') {
        await this.routeDynamicFunnelWebhook(payload as DynamicFunnelWebhook);
      } else {
        throw new Error(`Unknown funnel type for workflow: ${payload.workflowId}`);
      }

      console.log(`✅ Webhook processed successfully: ${payload.executionId}`);
      
    } catch (error) {
      console.error('❌ Webhook processing failed:', error);
      await this.logWebhookError(payload, error.message);
      throw error;
    }
  }

  // ============================================================================
  // CORE FUNNEL WEBHOOK HANDLING
  // ============================================================================

  /**
   * Handle webhooks from core funnel executions
   */
  async routeCoreFunnelWebhook(payload: CoreFunnelWebhook): Promise<void> {
    console.log(`🎯 Processing core funnel webhook: ${payload.stepName} for prospect ${payload.prospectId}`);

    switch (payload.eventType) {
      case 'step_completed':
        await this.handleCoreFunnelStepCompleted(payload);
        break;
        
      case 'step_failed':
        await this.handleCoreFunnelStepFailed(payload);
        break;
        
      case 'prospect_responded':
        await this.handleCoreFunnelProspectResponse(payload);
        break;
        
      case 'execution_completed':
        await this.handleCoreFunnelExecutionCompleted(payload);
        break;
        
      case 'execution_failed':
        await this.handleCoreFunnelExecutionFailed(payload);
        break;
        
      default:
        console.warn(`⚠️ Unknown core funnel event type: ${payload.eventType}`);
    }
  }

  private async handleCoreFunnelStepCompleted(payload: CoreFunnelWebhook): Promise<void> {
    // Update prospect progress
    await this.updateProspectProgress(payload.prospectId, {
      stepId: payload.stepName,
      stepType: 'message_sent',
      result: 'success',
      metadata: {
        templateId: payload.templateId,
        executionId: payload.executionId,
        timestamp: payload.timestamp
      }
    });

    // Update core funnel execution stats
    await this.updateCoreFunnelExecution(payload.executionId, {
      prospects_processed: { increment: 1 },
      last_step_completed: payload.stepName,
      updated_at: new Date().toISOString()
    });

    // Log step completion for analytics
    await this.logCoreFunnelStep(payload);
  }

  private async handleCoreFunnelStepFailed(payload: CoreFunnelWebhook): Promise<void> {
    // Update prospect status to failed
    await this.updateProspectProgress(payload.prospectId, {
      stepId: payload.stepName,
      stepType: 'message_sent',
      result: 'failure',
      metadata: {
        error: payload.data.error,
        templateId: payload.templateId,
        executionId: payload.executionId
      }
    });

    // Update failure count in execution
    await this.updateCoreFunnelExecution(payload.executionId, {
      failures: { increment: 1 },
      updated_at: new Date().toISOString()
    });
  }

  private async handleCoreFunnelProspectResponse(payload: CoreFunnelWebhook): Promise<void> {
    // Record prospect response
    await this.updateProspectProgress(payload.prospectId, {
      stepId: 'response_received',
      stepType: 'response_received',
      result: 'success',
      responseData: payload.data.response,
      metadata: {
        responseType: payload.data.responseType, // 'positive', 'negative', 'neutral'
        responseTime: payload.data.responseTime,
        executionId: payload.executionId
      }
    });

    // Update campaign response metrics
    await this.updateCampaignMetrics(payload.campaignId, {
      prospects_responded: { increment: 1 }
    });

    // Check if response indicates meeting booking
    if (payload.data.responseType === 'meeting_booked') {
      await this.handleMeetingBooked(payload.prospectId, payload.campaignId, payload.data);
    }
  }

  private async handleCoreFunnelExecutionCompleted(payload: CoreFunnelWebhook): Promise<void> {
    // Mark execution as completed
    await this.updateCoreFunnelExecution(payload.executionId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      final_stats: payload.data.stats
    });

    // Generate execution summary
    await this.generateExecutionSummary(payload.executionId, 'core');
  }

  private async handleCoreFunnelExecutionFailed(payload: CoreFunnelWebhook): Promise<void> {
    // Mark execution as failed
    await this.updateCoreFunnelExecution(payload.executionId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_details: payload.data.error
    });
  }

  // ============================================================================
  // DYNAMIC FUNNEL WEBHOOK HANDLING
  // ============================================================================

  /**
   * Handle webhooks from dynamic funnel executions
   */
  async routeDynamicFunnelWebhook(payload: DynamicFunnelWebhook): Promise<void> {
    console.log(`🌟 Processing dynamic funnel webhook: Step ${payload.stepOrder} for prospect ${payload.prospectId}`);

    switch (payload.eventType) {
      case 'step_completed':
        await this.handleDynamicFunnelStepCompleted(payload);
        break;
        
      case 'step_failed':
        await this.handleDynamicFunnelStepFailed(payload);
        break;
        
      case 'prospect_responded':
        await this.handleDynamicFunnelProspectResponse(payload);
        break;
        
      case 'execution_completed':
        await this.handleDynamicFunnelExecutionCompleted(payload);
        break;
        
      case 'execution_failed':
        await this.handleDynamicFunnelExecutionFailed(payload);
        break;
        
      default:
        console.warn(`⚠️ Unknown dynamic funnel event type: ${payload.eventType}`);
    }
  }

  private async handleDynamicFunnelStepCompleted(payload: DynamicFunnelWebhook): Promise<void> {
    // Update prospect progress in dynamic funnel
    await this.updateProspectProgress(payload.prospectId, {
      stepId: `step_${payload.stepOrder}`,
      stepType: 'message_sent',
      result: 'success',
      metadata: {
        definitionId: payload.definitionId,
        stepOrder: payload.stepOrder,
        executionId: payload.executionId,
        timestamp: payload.timestamp
      }
    });

    // Update dynamic funnel execution with step progress
    await this.updateDynamicFunnelExecution(payload.executionId, {
      current_step: payload.stepOrder + 1,
      prospects_in_step: {
        [`step_${payload.stepOrder}`]: { decrement: 1 },
        [`step_${payload.stepOrder + 1}`]: { increment: 1 }
      },
      updated_at: new Date().toISOString()
    });

    // Check if adaptation is needed based on step performance
    if (payload.adaptationTrigger) {
      await this.triggerFunnelAdaptation(payload);
    }
  }

  private async handleDynamicFunnelStepFailed(payload: DynamicFunnelWebhook): Promise<void> {
    // Update prospect status
    await this.updateProspectProgress(payload.prospectId, {
      stepId: `step_${payload.stepOrder}`,
      stepType: 'message_sent',
      result: 'failure',
      metadata: {
        error: payload.data.error,
        definitionId: payload.definitionId,
        stepOrder: payload.stepOrder
      }
    });

    // Log failure for adaptation learning
    await this.logDynamicFunnelFailure(payload);
  }

  private async handleDynamicFunnelProspectResponse(payload: DynamicFunnelWebhook): Promise<void> {
    // Record response for dynamic funnel
    await this.updateProspectProgress(payload.prospectId, {
      stepId: 'response_received',
      stepType: 'response_received',
      result: 'success',
      responseData: payload.data.response,
      metadata: {
        responseType: payload.data.responseType,
        responseTime: payload.data.responseTime,
        stepOrder: payload.stepOrder,
        sentiment: payload.data.sentiment // AI-analyzed sentiment
      }
    });

    // Trigger dynamic adaptation based on response
    await this.triggerResponseBasedAdaptation(payload);
  }

  private async handleDynamicFunnelExecutionCompleted(payload: DynamicFunnelWebhook): Promise<void> {
    // Mark dynamic execution as completed
    await this.updateDynamicFunnelExecution(payload.executionId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      performance_metrics: payload.data.metrics,
      adaptation_history: payload.data.adaptations
    });

    // Generate learning insights for future dynamic funnels
    await this.generateDynamicFunnelInsights(payload.definitionId);
  }

  private async handleDynamicFunnelExecutionFailed(payload: DynamicFunnelWebhook): Promise<void> {
    // Mark execution as failed
    await this.updateDynamicFunnelExecution(payload.executionId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_details: payload.data.error
    });
  }

  // ============================================================================
  // SHARED UTILITY METHODS
  // ============================================================================

  /**
   * Update prospect progress across both funnel types
   */
  async updateProspectProgress(prospectId: string, stepData: StepData): Promise<void> {
    try {
      // Get current prospect progress
      const { data: prospect } = await this.supabase
        .from('campaign_prospects')
        .select('*')
        .eq('id', prospectId)
        .single();

      if (!prospect) {
        throw new Error(`Prospect not found: ${prospectId}`);
      }

      // Update prospect status and add step to history
      const responseHistory = prospect.response_history || [];
      responseHistory.push({
        ...stepData,
        timestamp: new Date().toISOString()
      });

      await this.supabase
        .from('campaign_prospects')
        .update({
          status: stepData.result === 'failure' ? 'failed' : 'active',
          last_activity: new Date().toISOString(),
          response_history: responseHistory
        })
        .eq('id', prospectId);

      console.log(`✅ Updated prospect progress: ${prospectId} - ${stepData.stepType}`);
      
    } catch (error) {
      console.error(`❌ Failed to update prospect progress: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle meeting booking across both funnel types
   */
  private async handleMeetingBooked(prospectId: string, campaignId: string, meetingData: any): Promise<void> {
    // Update prospect status to converted
    await this.supabase
      .from('campaign_prospects')
      .update({
        status: 'converted',
        meeting_booked_at: new Date().toISOString(),
        meeting_details: meetingData
      })
      .eq('id', prospectId);

    // Update campaign conversion metrics
    await this.updateCampaignMetrics(campaignId, {
      prospects_converted: { increment: 1 }
    });

    console.log(`🎉 Meeting booked for prospect: ${prospectId}`);
  }

  /**
   * Trigger funnel adaptation for dynamic funnels
   */
  private async triggerFunnelAdaptation(payload: DynamicFunnelWebhook): Promise<void> {
    console.log(`🔄 Triggering funnel adaptation: ${payload.adaptationTrigger}`);

    // This would trigger Sam AI to analyze performance and adapt the funnel
    // For now, log the adaptation trigger
    await this.logAdaptationTrigger({
      definitionId: payload.definitionId,
      executionId: payload.executionId,
      trigger: payload.adaptationTrigger,
      stepOrder: payload.stepOrder,
      data: payload.data
    });
  }

  /**
   * Trigger response-based adaptation
   */
  private async triggerResponseBasedAdaptation(payload: DynamicFunnelWebhook): Promise<void> {
    const responseType = payload.data.responseType;
    
    if (responseType === 'objection') {
      // Route to objection handling sequence
      console.log(`🛑 Objection detected, routing to objection handler`);
    } else if (responseType === 'interest') {
      // Accelerate to meeting booking
      console.log(`🚀 Interest detected, accelerating to meeting booking`);
    } else if (responseType === 'unsubscribe') {
      // Remove from sequence
      console.log(`❌ Unsubscribe detected, removing from sequence`);
    }
  }

  // ============================================================================
  // DATABASE OPERATIONS
  // ============================================================================

  private async determineFunnelType(workflowId: string): Promise<'core' | 'dynamic' | null> {
    // Check core funnel templates
    const { data: coreTemplate } = await this.supabase
      .from('core_funnel_templates')
      .select('id')
      .eq('n8n_workflow_id', workflowId)
      .single();

    if (coreTemplate) return 'core';

    // Check dynamic funnel definitions
    const { data: dynamicDefinition } = await this.supabase
      .from('dynamic_funnel_definitions')
      .select('id')
      .eq('n8n_workflow_id', workflowId)
      .single();

    if (dynamicDefinition) return 'dynamic';

    return null;
  }

  private async updateCoreFunnelExecution(executionId: string, updates: any): Promise<void> {
    await this.supabase
      .from('core_funnel_executions')
      .update(updates)
      .eq('n8n_execution_id', executionId);
  }

  private async updateDynamicFunnelExecution(executionId: string, updates: any): Promise<void> {
    await this.supabase
      .from('dynamic_funnel_executions')
      .update(updates)
      .eq('n8n_execution_id', executionId);
  }

  private async updateCampaignMetrics(campaignId: string, updates: any): Promise<void> {
    await this.supabase
      .from('funnel_performance_metrics')
      .update(updates)
      .eq('campaign_id', campaignId);
  }

  private async logCoreFunnelStep(payload: CoreFunnelWebhook): Promise<void> {
    await this.supabase
      .from('funnel_step_logs')
      .insert({
        execution_id: payload.executionId,
        funnel_type: 'core',
        prospect_id: payload.prospectId,
        step_name: payload.stepName,
        result: payload.stepResult,
        data: payload.data,
        timestamp: payload.timestamp
      });
  }

  private async logDynamicFunnelFailure(payload: DynamicFunnelWebhook): Promise<void> {
    await this.supabase
      .from('funnel_adaptation_logs')
      .insert({
        definition_id: payload.definitionId,
        execution_id: payload.executionId,
        event_type: 'step_failure',
        step_order: payload.stepOrder,
        failure_reason: payload.data.error,
        timestamp: payload.timestamp
      });
  }

  private async logAdaptationTrigger(data: any): Promise<void> {
    await this.supabase
      .from('funnel_adaptation_logs')
      .insert({
        definition_id: data.definitionId,
        execution_id: data.executionId,
        event_type: 'adaptation_triggered',
        trigger_reason: data.trigger,
        step_order: data.stepOrder,
        adaptation_data: data.data,
        timestamp: new Date().toISOString()
      });
  }

  private async logWebhookError(payload: WebhookPayload, error: string): Promise<void> {
    await this.supabase
      .from('webhook_error_logs')
      .insert({
        execution_id: payload.executionId,
        workflow_id: payload.workflowId,
        event_type: payload.eventType,
        error_message: error,
        payload_data: payload.data,
        timestamp: new Date().toISOString()
      });
  }

  private async generateExecutionSummary(executionId: string, funnelType: 'core' | 'dynamic'): Promise<void> {
    console.log(`📊 Generating execution summary for ${funnelType} funnel: ${executionId}`);
    // Implementation would generate comprehensive execution analytics
  }

  private async generateDynamicFunnelInsights(definitionId: string): Promise<void> {
    console.log(`🧠 Generating insights for dynamic funnel: ${definitionId}`);
    // Implementation would analyze performance and generate insights for future funnels
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create webhook manager instance
 */
export function createWebhookManager(): WebhookManager {
  return new WebhookManager();
}

/**
 * Process webhook payload from N8N
 */
export async function processN8NWebhook(payload: any): Promise<void> {
  const manager = createWebhookManager();
  await manager.handleWorkflowWebhook(payload);
}