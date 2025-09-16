// N8N API Client for workflows.innovareai.com integration
// This handles all communication with the N8N instance

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

export class N8NClient {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = process.env.N8N_INSTANCE_URL || 'https://workflows.innovareai.com'
    this.apiKey = process.env.N8N_API_KEY || ''
    
    if (!this.apiKey) {
      console.warn('N8N_API_KEY not provided. N8N operations will be simulated.')
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
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
      throw new Error(`N8N API Error (${response.status}): ${errorText}`)
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