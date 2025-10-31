/**
 * N8N API Client for Sam AI Dual Funnel System
 * Handles both Core and Dynamic funnel operations
 */

export interface N8NConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export interface ProspectData {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  company_name: string;
  title: string;
  linkedin_url?: string;
  custom_fields?: Record<string, any>;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'success' | 'error' | 'waiting';
  startedAt: string;
  finishedAt?: string;
  data?: any;
}

export interface WorkflowDefinition {
  name: string;
  nodes: N8NNode[];
  connections: N8NConnections;
  settings?: Record<string, any>;
}

export interface N8NNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, any>;
}

export interface N8NConnections {
  [nodeId: string]: {
    main?: Array<Array<{ node: string; type: string; index: number }>>;
  };
}

export class N8NClient {
  private config: N8NConfig;

  constructor(config: N8NConfig) {
    this.config = {
      timeout: 30000,
      ...config
    };
  }

  // ============================================================================
  // CORE FUNNEL OPERATIONS
  // ============================================================================

  /**
   * Deploy a pre-built core funnel template
   */
  async deployCoreFunnel(templateId: string, variables: Record<string, any>): Promise<string> {
    try {
      console.log(`🚀 Deploying core funnel template: ${templateId}`);

      // Get template workflow definition
      const template = await this.getCoreTemplate(templateId);
      
      // Replace variables in template
      const workflowDefinition = this.replaceTemplateVariables(template, variables);
      
      // Create workflow in N8N
      const workflow = await this.createWorkflow(workflowDefinition);
      
      // Activate workflow
      await this.activateWorkflow(workflow.id);
      
      console.log(`✅ Core funnel deployed: ${workflow.id}`);
      return workflow.id;
      
    } catch (error) {
      console.error('❌ Core funnel deployment failed:', error);
      throw new Error(`Failed to deploy core funnel: ${error.message}`);
    }
  }

  /**
   * Execute a core funnel with prospect data
   * Now includes retry logic with exponential backoff
   */
  async executeCoreFunnel(workflowId: string, prospects: ProspectData[], retryCount = 0): Promise<string> {
    const maxRetries = 3;

    try {
      console.log(`⚡ Executing core funnel ${workflowId} for ${prospects.length} prospects (attempt ${retryCount + 1}/${maxRetries})`);

      const execution = await this.executeWorkflow(workflowId, {
        prospects,
        execution_type: 'core_funnel',
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Core funnel execution started: ${execution.id}`);
      return execution.id;

    } catch (error) {
      console.error(`❌ Core funnel execution failed (attempt ${retryCount + 1}/${maxRetries}):`, error);

      // Retry up to maxRetries times
      if (retryCount < maxRetries - 1) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeCoreFunnel(workflowId, prospects, retryCount + 1);
      }

      throw new Error(`Failed to execute core funnel after ${maxRetries} attempts: ${error.message}`);
    }
  }

  // ============================================================================
  // DYNAMIC FUNNEL OPERATIONS
  // ============================================================================

  /**
   * Create a dynamic workflow from AI-generated definition
   */
  async createDynamicWorkflow(definition: WorkflowDefinition): Promise<string> {
    try {
      console.log(`🎨 Creating dynamic workflow: ${definition.name}`);

      // Validate workflow definition
      this.validateWorkflowDefinition(definition);
      
      // Create workflow in N8N
      const workflow = await this.createWorkflow(definition);
      
      // Activate workflow
      await this.activateWorkflow(workflow.id);
      
      console.log(`✅ Dynamic workflow created: ${workflow.id}`);
      return workflow.id;
      
    } catch (error) {
      console.error('❌ Dynamic workflow creation failed:', error);
      throw new Error(`Failed to create dynamic workflow: ${error.message}`);
    }
  }

  /**
   * Update a dynamic workflow with modifications
   */
  async updateDynamicWorkflow(workflowId: string, changes: Partial<WorkflowDefinition>): Promise<boolean> {
    try {
      console.log(`🔄 Updating dynamic workflow: ${workflowId}`);

      // Get current workflow
      const currentWorkflow = await this.getWorkflow(workflowId);
      
      // Apply changes
      const updatedWorkflow = this.mergeWorkflowChanges(currentWorkflow, changes);
      
      // Update in N8N
      await this.updateWorkflow(workflowId, updatedWorkflow);
      
      console.log(`✅ Dynamic workflow updated: ${workflowId}`);
      return true;
      
    } catch (error) {
      console.error('❌ Dynamic workflow update failed:', error);
      throw new Error(`Failed to update dynamic workflow: ${error.message}`);
    }
  }

  /**
   * Execute a dynamic funnel with custom data
   */
  async executeDynamicFunnel(workflowId: string, data: any): Promise<string> {
    try {
      console.log(`🌟 Executing dynamic funnel ${workflowId}`);

      const execution = await this.executeWorkflow(workflowId, {
        ...data,
        execution_type: 'dynamic_funnel',
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Dynamic funnel execution started: ${execution.id}`);
      return execution.id;
      
    } catch (error) {
      console.error('❌ Dynamic funnel execution failed:', error);
      throw new Error(`Failed to execute dynamic funnel: ${error.message}`);
    }
  }

  // ============================================================================
  // SHARED OPERATIONS
  // ============================================================================

  /**
   * Get execution status and progress
   */
  async getExecutionStatus(executionId: string): Promise<WorkflowExecution> {
    try {
      const response = await this.makeRequest(`/executions/${executionId}`, 'GET');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get execution status: ${error.message}`);
    }
  }

  /**
   * Stop a running execution
   */
  async stopExecution(executionId: string): Promise<boolean> {
    try {
      await this.makeRequest(`/executions/${executionId}/stop`, 'POST');
      return true;
    } catch (error) {
      throw new Error(`Failed to stop execution: ${error.message}`);
    }
  }

  /**
   * Get execution logs and data
   */
  async getExecutionLogs(executionId: string): Promise<any[]> {
    try {
      const response = await this.makeRequest(`/executions/${executionId}`, 'GET');
      return response.data.resultData?.runData || [];
    } catch (error) {
      throw new Error(`Failed to get execution logs: ${error.message}`);
    }
  }

  /**
   * List all workflows
   */
  async listWorkflows(): Promise<any[]> {
    try {
      const response = await this.makeRequest('/workflows', 'GET');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to list workflows: ${error.message}`);
    }
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(workflowId: string): Promise<boolean> {
    try {
      await this.makeRequest(`/workflows/${workflowId}`, 'DELETE');
      return true;
    } catch (error) {
      throw new Error(`Failed to delete workflow: ${error.message}`);
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async getCoreTemplate(templateId: string): Promise<WorkflowDefinition> {
    // This would typically fetch from a template repository
    // For now, return a mock template
    return {
      name: `Core Template ${templateId}`,
      nodes: [],
      connections: {}
    };
  }

  private replaceTemplateVariables(template: WorkflowDefinition, variables: Record<string, any>): WorkflowDefinition {
    const templateStr = JSON.stringify(template);
    let replacedStr = templateStr;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      replacedStr = replacedStr.replace(new RegExp(placeholder, 'g'), String(value));
    }
    
    return JSON.parse(replacedStr);
  }

  private validateWorkflowDefinition(definition: WorkflowDefinition): void {
    if (!definition.name) {
      throw new Error('Workflow definition must have a name');
    }
    
    if (!definition.nodes || definition.nodes.length === 0) {
      throw new Error('Workflow definition must have at least one node');
    }
    
    // Validate each node has required properties
    for (const node of definition.nodes) {
      if (!node.id || !node.name || !node.type) {
        throw new Error(`Invalid node definition: ${JSON.stringify(node)}`);
      }
    }
  }

  private mergeWorkflowChanges(current: WorkflowDefinition, changes: Partial<WorkflowDefinition>): WorkflowDefinition {
    return {
      ...current,
      ...changes,
      nodes: changes.nodes || current.nodes,
      connections: changes.connections || current.connections
    };
  }

  private async createWorkflow(definition: WorkflowDefinition): Promise<{ id: string }> {
    try {
      const response = await this.makeRequest('/workflows', 'POST', {
        name: definition.name,
        nodes: definition.nodes,
        connections: definition.connections,
        settings: definition.settings || {},
        active: false
      });
      
      return { id: response.data.id };
    } catch (error) {
      throw new Error(`Failed to create workflow: ${error.message}`);
    }
  }

  private async updateWorkflow(workflowId: string, definition: WorkflowDefinition): Promise<void> {
    try {
      await this.makeRequest(`/workflows/${workflowId}`, 'PUT', {
        name: definition.name,
        nodes: definition.nodes,
        connections: definition.connections,
        settings: definition.settings || {}
      });
    } catch (error) {
      throw new Error(`Failed to update workflow: ${error.message}`);
    }
  }

  private async getWorkflow(workflowId: string): Promise<WorkflowDefinition> {
    try {
      const response = await this.makeRequest(`/workflows/${workflowId}`, 'GET');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get workflow: ${error.message}`);
    }
  }

  private async activateWorkflow(workflowId: string): Promise<void> {
    try {
      await this.makeRequest(`/workflows/${workflowId}/activate`, 'POST');
    } catch (error) {
      throw new Error(`Failed to activate workflow: ${error.message}`);
    }
  }

  private async executeWorkflow(workflowId: string, data: any): Promise<{ id: string }> {
    try {
      const response = await this.makeRequest(`/workflows/${workflowId}/execute`, 'POST', {
        data
      });
      
      return { id: response.data.id };
    } catch (error) {
      throw new Error(`Failed to execute workflow: ${error.message}`);
    }
  }

  private async makeRequest(endpoint: string, method: string, data?: any): Promise<any> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': this.config.apiKey,
      },
      signal: AbortSignal.timeout(this.config.timeout!),
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`N8N API error ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'TimeoutError') {
        throw new Error(`N8N API request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create N8N client instance with environment configuration
 */
export function createN8NClient(): N8NClient {
  const config: N8NConfig = {
    baseUrl: process.env.N8N_API_BASE_URL || 'https://innovareai.app.n8n.cloud/api/v1',
    apiKey: process.env.N8N_API_KEY || '',
    timeout: parseInt(process.env.N8N_TIMEOUT || '30000')
  };

  if (!config.apiKey) {
    throw new Error('N8N_API_KEY environment variable is required');
  }

  return new N8NClient(config);
}

/**
 * Create N8N client for testing with mock configuration
 */
export function createMockN8NClient(): N8NClient {
  return new N8NClient({
    baseUrl: 'https://mock.n8n.api',
    apiKey: 'mock-api-key'
  });
}