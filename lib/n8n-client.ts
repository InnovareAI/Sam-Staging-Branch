// N8N API Client for workflows.innovareai.com integration
// This handles all communication with the N8N instance
// Now includes enterprise-grade circuit breaker protection

import { 
  CircuitBreaker, 
  CIRCUIT_BREAKER_CONFIGS,
  circuitBreakerRegistry,
  FallbackStrategy,
  N8NQueueFallbackStrategy,
  N8NSimulationFallbackStrategy
} from '@/lib/circuit-breaker'
import { logger } from '@/lib/logging'

interface N8NWorkflowCreateRequest {
  name: string
  nodes: any[]
  connections: any
  settings?: any
  tags?: string[]
}

interface N8NWorkflowCreateResponse {
  id: string
  name: string
  active: boolean
  nodes: any[]
  connections: any
  createdAt: string
  updatedAt: string
}

interface N8NWorkflowExecuteRequest {
  workflowId: string
  executionData?: any
  waitForCompletion?: boolean
}

interface N8NWorkflowExecuteResponse {
  executionId: string
  startedAt: string
  status: 'running' | 'success' | 'error' | 'waiting'
  data?: any
}

interface N8NCampaignExecutionRequest {
  workspaceConfig: {
    id: string
    workspace_id: string
    deployed_workflow_id: string
    channel_preferences?: any
    email_config?: any
    linkedin_config?: any
    reply_handling_config?: any
  }
  approvedProspects: Array<{
    id: string
    email: string
    first_name: string
    last_name: string
    company_name?: string
    linkedin_url?: string
    job_title?: string
    industry?: string
  }>
  executionPreferences: {
    delay_between_prospects?: number
    max_daily_outreach?: number
    working_hours_start?: number
    working_hours_end?: number
    timezone?: string
    exclude_weekends?: boolean
    exclude_holidays?: boolean
    auto_pause_on_replies?: boolean
  }
  credentials: {
    unipile_api_key: string
    account_mappings: Array<{
      channel: string
      account_id: string
      account_name: string
    }>
  }
  campaignMetadata: {
    campaign_execution_id: string
    workspace_id: string
    campaign_name: string
    campaign_type: 'email_only' | 'linkedin_only' | 'multi_channel'
    webhook_url: string
  }
}

export class N8NClient {
  private baseUrl: string
  private apiKey: string
  private circuitBreaker: CircuitBreaker

  constructor() {
    this.baseUrl = process.env.N8N_INSTANCE_URL || 'https://workflows.innovareai.com'
    this.apiKey = process.env.N8N_API_KEY || ''
    
    // Initialize circuit breaker for N8N API calls
    this.circuitBreaker = circuitBreakerRegistry.getCircuitBreaker(
      'n8n-api',
      CIRCUIT_BREAKER_CONFIGS.N8N_API
    )

    // Setup fallback strategies
    this.setupFallbackStrategies()
    
    if (!this.apiKey) {
      console.warn('N8N_API_KEY not provided. N8N operations will be simulated.')
    }
  }

  /**
   * Setup fallback strategies for N8N API failures
   */
  private setupFallbackStrategies(): void {
    // Queue for retry fallback strategy
    this.circuitBreaker.addFallbackStrategy(new N8NQueueFallbackStrategy())
    
    // Simulation fallback strategy
    this.circuitBreaker.addFallbackStrategy(new N8NSimulationFallbackStrategy())
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    // Execute API call through circuit breaker for protection
    const result = await this.circuitBreaker.execute(async () => {
      return await this.executeRequest(endpoint, options)
    }, `n8n_${endpoint.replace('/', '_')}`)

    if (!result.success) {
      logger.error('N8N API call failed through circuit breaker', result.error, {
        metadata: {
          endpoint,
          used_fallback: result.usedFallback,
          circuit_state: result.circuitState
        }
      })
      throw result.error || new Error('N8N API call failed')
    }

    if (result.usedFallback) {
      logger.info('N8N API call completed using fallback', {
        metadata: {
          endpoint,
          circuit_state: result.circuitState
        }
      })
    }

    return result.data
  }

  private async executeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}/api/v1${endpoint}`
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(this.apiKey && { 'X-N8N-API-KEY': this.apiKey })
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = new Error(`N8N API Error (${response.status}): ${errorText}`)
      
      // Add metadata for circuit breaker decision making
      if (response.status >= 500 || response.status === 408) {
        error.name = 'N8NServerError'
      } else if (response.status === 429) {
        error.name = 'N8NRateLimitError'
      } else {
        error.name = 'N8NClientError'
      }
      
      throw error
    }

    return response.json()
  }

  // Create a new workflow in N8N
  async createWorkflow(workflowData: N8NWorkflowCreateRequest): Promise<N8NWorkflowCreateResponse> {
    if (!this.apiKey) {
      // Simulate successful creation for development
      return {
        id: `sim_workflow_${Date.now()}`,
        name: workflowData.name,
        active: false,
        nodes: workflowData.nodes,
        connections: workflowData.connections,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }

    return this.makeRequest('/workflows', {
      method: 'POST',
      body: JSON.stringify(workflowData)
    })
  }

  // Execute a workflow
  async executeWorkflow(request: N8NWorkflowExecuteRequest): Promise<N8NWorkflowExecuteResponse> {
    if (!this.apiKey) {
      // Simulate successful execution for development
      return {
        executionId: `sim_exec_${Date.now()}`,
        startedAt: new Date().toISOString(),
        status: 'running'
      }
    }

    return this.makeRequest(`/workflows/${request.workflowId}/execute`, {
      method: 'POST',
      body: JSON.stringify({
        executionData: request.executionData,
        waitTillDone: request.waitForCompletion || false
      })
    })
  }

  // Get workflow execution status
  async getExecutionStatus(executionId: string) {
    if (!this.apiKey) {
      // Simulate execution status for development
      return {
        id: executionId,
        status: 'success',
        startedAt: new Date(Date.now() - 60000).toISOString(),
        stoppedAt: new Date().toISOString(),
        workflowData: {}
      }
    }

    return this.makeRequest(`/executions/${executionId}`)
  }

  // Get all workflows
  async listWorkflows() {
    if (!this.apiKey) {
      // Return empty list for development
      return []
    }

    return this.makeRequest('/workflows')
  }

  // Activate/deactivate workflow
  async setWorkflowActive(workflowId: string, active: boolean) {
    if (!this.apiKey) {
      // Simulate successful activation for development
      return {
        id: workflowId,
        active: active,
        updatedAt: new Date().toISOString()
      }
    }

    return this.makeRequest(`/workflows/${workflowId}`, {
      method: 'PATCH',
      body: JSON.stringify({ active })
    })
  }

  // Delete workflow
  async deleteWorkflow(workflowId: string) {
    if (!this.apiKey) {
      // Simulate successful deletion for development
      return { success: true }
    }

    return this.makeRequest(`/workflows/${workflowId}`, {
      method: 'DELETE'
    })
  }

  // Check N8N health/connectivity
  async healthCheck() {
    try {
      if (!this.apiKey) {
        return {
          status: 'simulation',
          message: 'N8N API key not provided - running in simulation mode',
          timestamp: new Date().toISOString()
        }
      }

      // Try different health check endpoints
      try {
        // Try /health first
        const response = await this.makeRequest('/health')
        return {
          status: 'healthy',
          data: response,
          timestamp: new Date().toISOString()
        }
      } catch (healthError) {
        // If health fails, try listing workflows as a connectivity test
        try {
          await this.makeRequest('/workflows')
          return {
            status: 'healthy',
            message: 'N8N instance accessible (health endpoint not available)',
            timestamp: new Date().toISOString()
          }
        } catch (workflowError) {
          throw healthError // Return original health error
        }
      }
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  // Execute campaign workflow with comprehensive data and monitoring
  async executeCampaignWorkflow(request: N8NCampaignExecutionRequest): Promise<N8NWorkflowExecuteResponse> {
    const { workspaceConfig, approvedProspects, executionPreferences, credentials, campaignMetadata } = request

    if (!this.apiKey) {
      // Enhanced simulation for development with realistic data
      logger.info('Simulating N8N campaign execution', {
        metadata: {
          workspace_id: workspaceConfig.workspace_id,
          workflow_id: workspaceConfig.deployed_workflow_id,
          prospects_count: approvedProspects.length,
          campaign_type: campaignMetadata.campaign_type
        }
      })

      return {
        executionId: `sim_campaign_${Date.now()}_${workspaceConfig.workspace_id}`,
        startedAt: new Date().toISOString(),
        status: 'running',
        data: {
          prospects_count: approvedProspects.length,
          campaign_type: campaignMetadata.campaign_type,
          estimated_duration_minutes: approvedProspects.length * 2
        }
      }
    }

    // Prepare execution data with complete campaign context
    const executionData = {
      // Workspace and workflow context
      workspaceConfig: {
        workspace_id: workspaceConfig.workspace_id,
        workflow_id: workspaceConfig.deployed_workflow_id,
        channel_preferences: workspaceConfig.channel_preferences,
        email_config: workspaceConfig.email_config,
        linkedin_config: workspaceConfig.linkedin_config,
        reply_handling_config: workspaceConfig.reply_handling_config
      },

      // Campaign execution metadata
      campaignMetadata: {
        campaign_execution_id: campaignMetadata.campaign_execution_id,
        campaign_name: campaignMetadata.campaign_name,
        campaign_type: campaignMetadata.campaign_type,
        webhook_url: campaignMetadata.webhook_url,
        execution_timestamp: new Date().toISOString()
      },

      // Prospect data for outreach
      prospects: approvedProspects.map(prospect => ({
        id: prospect.id,
        email: prospect.email,
        first_name: prospect.first_name,
        last_name: prospect.last_name,
        company_name: prospect.company_name,
        linkedin_url: prospect.linkedin_url,
        job_title: prospect.job_title,
        industry: prospect.industry,
        // Add prospect-specific tracking
        prospect_tracking: {
          status: 'pending',
          assigned_at: new Date().toISOString(),
          channels_to_use: this.determineChannelsForProspect(prospect, workspaceConfig.channel_preferences)
        }
      })),

      // Execution preferences and timing
      executionPreferences: {
        delay_between_prospects: executionPreferences.delay_between_prospects || 300, // 5 minutes default
        max_daily_outreach: executionPreferences.max_daily_outreach || 50,
        working_hours_start: executionPreferences.working_hours_start || 9,
        working_hours_end: executionPreferences.working_hours_end || 17,
        timezone: executionPreferences.timezone || 'UTC',
        exclude_weekends: executionPreferences.exclude_weekends ?? true,
        exclude_holidays: executionPreferences.exclude_holidays ?? true,
        auto_pause_on_replies: executionPreferences.auto_pause_on_replies ?? true
      },

      // Secure credential injection (Option 3 architecture)
      credentials: {
        unipile_api_key: credentials.unipile_api_key,
        account_mappings: credentials.account_mappings,
        // Add workspace-specific credentials context
        workspace_id: workspaceConfig.workspace_id,
        injected_at: new Date().toISOString()
      }
    }

    // Log campaign execution initiation
    logger.info('Initiating N8N campaign workflow execution', {
      metadata: {
        workflow_id: workspaceConfig.deployed_workflow_id,
        campaign_execution_id: campaignMetadata.campaign_execution_id,
        prospects_count: approvedProspects.length,
        campaign_type: campaignMetadata.campaign_type,
        execution_preferences: executionPreferences
      }
    })

    // Execute the campaign workflow
    return this.makeRequest(`/workflows/${workspaceConfig.deployed_workflow_id}/execute`, {
      method: 'POST',
      body: JSON.stringify({
        executionData,
        waitTillDone: false, // Always async for campaigns
        metadata: {
          source: 'sam_campaign_api',
          version: '1.0.0',
          execution_type: 'campaign'
        }
      })
    })
  }

  // Helper method to determine channels for a specific prospect
  private determineChannelsForProspect(
    prospect: any, 
    channelPreferences: any
  ): string[] {
    const channels = []
    
    // Email channel (always available if prospect has email)
    if (prospect.email && channelPreferences?.email_enabled) {
      channels.push('email')
    }
    
    // LinkedIn channel (only if prospect has LinkedIn URL)
    if (prospect.linkedin_url && channelPreferences?.linkedin_enabled) {
      channels.push('linkedin')
    }
    
    return channels
  }

  // Get detailed campaign execution status with prospect-level tracking
  async getCampaignExecutionStatus(executionId: string) {
    if (!this.apiKey) {
      // Enhanced simulation with campaign-specific status
      return {
        id: executionId,
        status: 'running',
        startedAt: new Date(Date.now() - 300000).toISOString(), // 5 min ago
        progress: {
          total_prospects: 25,
          processed_prospects: 8,
          successful_outreach: 6,
          failed_outreach: 2,
          remaining_prospects: 17
        },
        estimated_completion: new Date(Date.now() + 1800000).toISOString(), // 30 min from now
        workflowData: {
          execution_type: 'campaign',
          last_activity: new Date().toISOString()
        }
      }
    }

    // Get execution status with additional campaign context
    const execution = await this.makeRequest(`/executions/${executionId}`)
    
    // Add campaign-specific status enrichment
    return {
      ...execution,
      campaign_context: {
        execution_type: 'campaign',
        last_status_check: new Date().toISOString()
      }
    }
  }

  // Monitor campaign execution health and performance
  async getCampaignExecutionMetrics(executionId: string) {
    if (!this.apiKey) {
      return {
        execution_id: executionId,
        metrics: {
          execution_time_ms: 180000, // 3 minutes
          prospects_per_minute: 2.5,
          success_rate: 0.85,
          error_rate: 0.15,
          average_response_time_ms: 1200
        },
        health_status: 'healthy',
        timestamp: new Date().toISOString()
      }
    }

    // Get comprehensive execution metrics
    try {
      const metrics = await this.makeRequest(`/executions/${executionId}/metrics`)
      return {
        execution_id: executionId,
        metrics,
        health_status: 'healthy',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      // Return basic health status if metrics endpoint doesn't exist
      const execution = await this.getExecutionStatus(executionId)
      return {
        execution_id: executionId,
        metrics: {
          status: execution.status,
          started_at: execution.startedAt
        },
        health_status: execution.status === 'error' ? 'unhealthy' : 'healthy',
        timestamp: new Date().toISOString()
      }
    }
  }

  // Deploy SAM master workflow template to workspace
  async deploySAMWorkflow(workspaceId: string, workspaceName: string, templateData: any) {
    const workflowName = `SAM_Workflow_${workspaceName}_${workspaceId}`
    
    const workflowData: N8NWorkflowCreateRequest = {
      name: workflowName,
      nodes: templateData.n8n_workflow_json?.nodes || [],
      connections: templateData.n8n_workflow_json?.connections || {},
      settings: {
        executionOrder: 'v1',
        saveManualExecutions: true,
        saveExecutionProgress: true,
        saveDataErrorExecution: 'all',
        saveDataSuccessExecution: 'all',
        timezone: 'UTC'
      },
      tags: ['SAM', 'campaign', 'workspace', workspaceId]
    }

    // Create the workflow
    const workflow = await this.createWorkflow(workflowData)
    
    // Activate the workflow
    await this.setWorkflowActive(workflow.id, true)
    
    return {
      deployed_workflow_id: workflow.id,
      workflow_name: workflowName,
      status: 'deployed',
      created_at: workflow.createdAt
    }
  }
}

// Export types for external usage
export type { N8NCampaignExecutionRequest, N8NWorkflowExecuteResponse }

// Export singleton instance
export const n8nClient = new N8NClient()

// Environment check helper
export function checkN8NConfiguration() {
  const baseUrl = process.env.N8N_INSTANCE_URL || 'https://workflows.innovareai.com'
  const apiKey = process.env.N8N_API_KEY
  const hasApiKey = !!apiKey

  return {
    baseUrl,
    hasApiKey,
    isConfigured: hasApiKey,
    mode: hasApiKey ? 'production' : 'simulation'
  }
}

