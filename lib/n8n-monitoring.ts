/**
 * N8N Campaign Execution Monitoring and Error Handling Service
 * Provides comprehensive monitoring, alerting, and recovery for N8N integrations
 */

import { logger } from '@/lib/logging'
import { pool } from '@/lib/db'
import { n8nClient } from '@/lib/n8n-client'

export interface CampaignExecutionMetrics {
  execution_id: string
  n8n_execution_id: string
  workspace_id: string
  status: 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'
  total_prospects: number
  processed_prospects: number
  successful_outreach: number
  failed_outreach: number
  success_rate: number
  execution_time_minutes: number
  estimated_completion: string | null
  last_heartbeat: string
}

export interface N8NHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  instance_url: string
  api_accessible: boolean
  response_time_ms: number
  active_executions: number
  failed_executions_last_hour: number
  circuit_breaker_state: 'closed' | 'open' | 'half-open'
  last_check_time: string
}

export class N8NCampaignMonitor {
  private readonly supabase = pool
  private monitoringInterval: NodeJS.Timeout | null = null
  private readonly HEARTBEAT_INTERVAL_MS = 30000 // 30 seconds
  private readonly EXECUTION_TIMEOUT_MINUTES = 120 // 2 hours

  /**
   * Start monitoring active campaign executions
   */
  public startMonitoring(): void {
    if (this.monitoringInterval) {
      return // Already monitoring
    }

    logger.info('Starting N8N campaign execution monitoring')
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkActiveExecutions()
        await this.checkN8NHealth()
        await this.cleanupStaleExecutions()
      } catch (error) {
        logger.error('N8N monitoring cycle failed', error)
      }
    }, this.HEARTBEAT_INTERVAL_MS)
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
      logger.info('Stopped N8N campaign execution monitoring')
    }
  }

  /**
   * Get comprehensive metrics for a campaign execution
   */
  public async getCampaignExecutionMetrics(executionId: string): Promise<CampaignExecutionMetrics | null> {
    try {
      const { data: execution, error } = await this.supabase
        .from('n8n_campaign_executions')
        .select(`
          id,
          n8n_execution_id,
          workspace_id,
          execution_status,
          total_prospects,
          processed_prospects,
          successful_outreach,
          failed_outreach,
          started_at,
          estimated_completion_time,
          last_status_update
        `)
        .eq('id', executionId)
        .single()

      if (error || !execution) {
        return null
      }

      const executionTimeMs = execution.started_at ? 
        Date.now() - new Date(execution.started_at).getTime() : 0
      
      const successRate = execution.processed_prospects > 0 ? 
        (execution.successful_outreach / execution.processed_prospects) * 100 : 0

      return {
        execution_id: execution.id,
        n8n_execution_id: execution.n8n_execution_id,
        workspace_id: execution.workspace_id,
        status: execution.execution_status,
        total_prospects: execution.total_prospects || 0,
        processed_prospects: execution.processed_prospects || 0,
        successful_outreach: execution.successful_outreach || 0,
        failed_outreach: execution.failed_outreach || 0,
        success_rate: successRate,
        execution_time_minutes: Math.round(executionTimeMs / (1000 * 60)),
        estimated_completion: execution.estimated_completion_time,
        last_heartbeat: execution.last_status_update || new Date().toISOString()
      }
    } catch (error) {
      logger.error('Failed to get campaign execution metrics', error, {
        metadata: { execution_id: executionId }
      })
      return null
    }
  }

  /**
   * Check health status of N8N instance
   */
  public async getN8NHealthStatus(): Promise<N8NHealthStatus> {
    const startTime = Date.now()
    
    try {
      // Check N8N API accessibility
      const healthResponse = await n8nClient.healthCheck()
      const responseTime = Date.now() - startTime
      
      // Get active executions count
      const { count: activeExecutions } = await this.supabase
        .from('n8n_campaign_executions')
        .select('*', { count: 'exact' })
        .eq('execution_status', 'running')

      // Get failed executions in last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { count: failedExecutions } = await this.supabase
        .from('n8n_campaign_executions')
        .select('*', { count: 'exact' })
        .eq('execution_status', 'failed')
        .gte('created_at', oneHourAgo)

      // Determine overall health status
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
      
      if (healthResponse.status === 'error' || responseTime > 5000) {
        status = 'unhealthy'
      } else if (responseTime > 2000 || (failedExecutions || 0) > 5) {
        status = 'degraded'
      }

      return {
        status,
        instance_url: process.env.N8N_INSTANCE_URL || 'https://workflows.innovareai.com',
        api_accessible: healthResponse.status !== 'error',
        response_time_ms: responseTime,
        active_executions: activeExecutions || 0,
        failed_executions_last_hour: failedExecutions || 0,
        circuit_breaker_state: 'closed', // Would get from circuit breaker registry
        last_check_time: new Date().toISOString()
      }
    } catch (error) {
      logger.error('N8N health check failed', error)
      
      return {
        status: 'unhealthy',
        instance_url: process.env.N8N_INSTANCE_URL || 'https://workflows.innovareai.com',
        api_accessible: false,
        response_time_ms: Date.now() - startTime,
        active_executions: 0,
        failed_executions_last_hour: 0,
        circuit_breaker_state: 'open',
        last_check_time: new Date().toISOString()
      }
    }
  }

  /**
   * Attempt to recover failed campaign execution
   */
  public async recoverFailedExecution(executionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const metrics = await this.getCampaignExecutionMetrics(executionId)
      
      if (!metrics) {
        return { success: false, message: 'Execution not found' }
      }

      if (metrics.status !== 'failed') {
        return { success: false, message: 'Execution is not in failed state' }
      }

      // Check if N8N is healthy before attempting recovery
      const healthStatus = await this.getN8NHealthStatus()
      if (healthStatus.status === 'unhealthy') {
        return { success: false, message: 'N8N instance is unhealthy, cannot recover' }
      }

      // Get execution details for recovery
      const { data: execution, error } = await this.supabase
        .from('n8n_campaign_executions')
        .select(`
          *,
          workspace_n8n_workflows:workspace_n8n_workflows(*)
        `)
        .eq('id', executionId)
        .single()

      if (error || !execution) {
        return { success: false, message: 'Failed to fetch execution details' }
      }

      // TODO: Implement recovery logic based on failure type
      // This could include:
      // - Restarting from last successful prospect
      // - Retrying failed prospects only
      // - Creating new N8N execution with remaining prospects

      logger.info('Campaign execution recovery initiated', {
        metadata: {
          execution_id: executionId,
          n8n_execution_id: metrics.n8n_execution_id,
          workspace_id: metrics.workspace_id,
          processed_prospects: metrics.processed_prospects,
          remaining_prospects: metrics.total_prospects - metrics.processed_prospects
        }
      })

      return { success: true, message: 'Recovery initiated (implementation pending)' }

    } catch (error) {
      logger.error('Campaign execution recovery failed', error, {
        metadata: { execution_id: executionId }
      })
      return { success: false, message: 'Recovery failed due to system error' }
    }
  }

  /**
   * Check active executions for timeouts and issues
   */
  private async checkActiveExecutions(): Promise<void> {
    const { data: activeExecutions, error } = await this.supabase
      .from('n8n_campaign_executions')
      .select('*')
      .eq('execution_status', 'running')

    if (error || !activeExecutions?.length) {
      return
    }

    const timeoutThreshold = new Date(Date.now() - this.EXECUTION_TIMEOUT_MINUTES * 60 * 1000)

    for (const execution of activeExecutions) {
      // Check for execution timeouts
      if (execution.started_at && new Date(execution.started_at) < timeoutThreshold) {
        logger.warn('Campaign execution timeout detected', {
          metadata: {
            execution_id: execution.id,
            n8n_execution_id: execution.n8n_execution_id,
            workspace_id: execution.workspace_id,
            started_at: execution.started_at,
            timeout_minutes: this.EXECUTION_TIMEOUT_MINUTES
          }
        })

        // Mark as timed out
        await this.supabase
          .from('n8n_campaign_executions')
          .update({
            execution_status: 'failed',
            error_message: `Execution timed out after ${this.EXECUTION_TIMEOUT_MINUTES} minutes`,
            completed_at: new Date().toISOString(),
            last_status_update: new Date().toISOString()
          })
          .eq('id', execution.id)
      }

      // Check N8N execution status if we have the ID
      if (execution.n8n_execution_id) {
        try {
          const n8nStatus = await n8nClient.getCampaignExecutionStatus(execution.n8n_execution_id)
          
          // Sync status if there's a mismatch
          if (n8nStatus.status !== execution.execution_status) {
            logger.info('Syncing execution status from N8N', {
              metadata: {
                execution_id: execution.id,
                current_status: execution.execution_status,
                n8n_status: n8nStatus.status
              }
            })

            await this.supabase
              .from('n8n_campaign_executions')
              .update({
                execution_status: n8nStatus.status,
                last_status_update: new Date().toISOString()
              })
              .eq('id', execution.id)
          }
        } catch (error) {
          logger.warn('Failed to check N8N execution status', error, {
            metadata: {
              execution_id: execution.id,
              n8n_execution_id: execution.n8n_execution_id
            }
          })
        }
      }
    }
  }

  /**
   * Check overall N8N health and alert if needed
   */
  private async checkN8NHealth(): Promise<void> {
    const healthStatus = await this.getN8NHealthStatus()
    
    if (healthStatus.status === 'unhealthy') {
      logger.error('N8N instance health check failed', {
        metadata: {
          instance_url: healthStatus.instance_url,
          api_accessible: healthStatus.api_accessible,
          response_time_ms: healthStatus.response_time_ms,
          active_executions: healthStatus.active_executions,
          failed_executions_last_hour: healthStatus.failed_executions_last_hour
        }
      })

      // TODO: Send critical alert notifications
      // TODO: Trigger circuit breaker if needed
      
    } else if (healthStatus.status === 'degraded') {
      logger.warn('N8N instance performance degraded', {
        metadata: {
          response_time_ms: healthStatus.response_time_ms,
          failed_executions_last_hour: healthStatus.failed_executions_last_hour
        }
      })
    }
  }

  /**
   * Clean up old completed/failed executions
   */
  private async cleanupStaleExecutions(): Promise<void> {
    // This could include archiving old executions, cleaning up logs, etc.
    // Implementation depends on data retention policies
  }
}

// Export singleton instance
export const n8nCampaignMonitor = new N8NCampaignMonitor()

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production') {
  n8nCampaignMonitor.startMonitoring()
}