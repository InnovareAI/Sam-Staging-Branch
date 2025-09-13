/**
 * N8N MCP Server for SAM AI Platform
 * 
 * Workflow automation and integration platform
 * Enables visual workflow creation and execution
 */

import { MCPTool, MCPCallToolRequest, MCPCallToolResult } from './types'

export interface N8NMCPConfig {
  baseUrl: string
  apiKey: string
  organizationId: string
  userId: string
}

export interface N8NWorkflow {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
  nodes: N8NNode[]
  connections: Record<string, any>
  settings?: Record<string, any>
  tags?: Array<{ id: string; name: string }>
}

export interface N8NNode {
  id: string
  name: string
  type: string
  typeVersion: number
  position: [number, number]
  parameters: Record<string, any>
  credentials?: Record<string, string>
}

export interface N8NExecution {
  id: string
  workflowId: string
  status: 'new' | 'running' | 'success' | 'error' | 'canceled'
  mode: 'manual' | 'trigger' | 'webhook' | 'retry'
  startedAt: string
  finishedAt?: string
  data?: Record<string, any>
  error?: string
}

export class N8NMCPServer {
  private config: N8NMCPConfig
  private clientId: string

  constructor(config: N8NMCPConfig) {
    this.config = config
    this.clientId = `n8n-client-${Date.now()}`
  }

  async listTools(): Promise<{ tools: MCPTool[] }> {
    return {
      tools: [
        {
          name: 'n8n_list_workflows',
          description: 'List all workflows in the N8N instance',
          inputSchema: {
            type: 'object',
            properties: {
              active: {
                type: 'boolean',
                description: 'Filter by active status'
              },
              limit: {
                type: 'integer',
                description: 'Maximum number of workflows to return',
                default: 100
              }
            },
            required: []
          }
        },
        {
          name: 'n8n_get_workflow',
          description: 'Get detailed workflow information by ID',
          inputSchema: {
            type: 'object',
            properties: {
              workflow_id: {
                type: 'string',
                description: 'The workflow ID to retrieve'
              }
            },
            required: ['workflow_id']
          }
        },
        {
          name: 'n8n_create_workflow',
          description: 'Create a new workflow with nodes and connections',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Workflow name'
              },
              nodes: {
                type: 'array',
                description: 'Array of workflow nodes',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    parameters: { type: 'object' },
                    position: {
                      type: 'array',
                      items: { type: 'number' },
                      minItems: 2,
                      maxItems: 2
                    }
                  },
                  required: ['name', 'type', 'position']
                }
              },
              connections: {
                type: 'object',
                description: 'Node connections configuration'
              }
            },
            required: ['name', 'nodes', 'connections']
          }
        },
        {
          name: 'n8n_execute_workflow',
          description: 'Execute a workflow manually',
          inputSchema: {
            type: 'object',
            properties: {
              workflow_id: {
                type: 'string',
                description: 'The workflow ID to execute'
              },
              input_data: {
                type: 'object',
                description: 'Input data for the workflow execution'
              }
            },
            required: ['workflow_id']
          }
        },
        {
          name: 'n8n_get_executions',
          description: 'Get workflow execution history',
          inputSchema: {
            type: 'object',
            properties: {
              workflow_id: {
                type: 'string',
                description: 'Filter by workflow ID'
              },
              status: {
                type: 'string',
                enum: ['success', 'error', 'running'],
                description: 'Filter by execution status'
              },
              limit: {
                type: 'integer',
                description: 'Maximum number of executions to return',
                default: 50
              }
            },
            required: []
          }
        },
        {
          name: 'n8n_create_sam_prospect_workflow',
          description: 'Create a SAM AI-optimized prospect research workflow',
          inputSchema: {
            type: 'object',
            properties: {
              workflow_name: {
                type: 'string',
                description: 'Name for the prospect research workflow'
              },
              data_sources: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['linkedin', 'apollo', 'brightdata', 'websearch']
                },
                description: 'Data sources to include in the workflow'
              },
              output_format: {
                type: 'string',
                enum: ['json', 'csv', 'airtable', 'supabase'],
                description: 'Output format for prospect data',
                default: 'supabase'
              }
            },
            required: ['workflow_name', 'data_sources']
          }
        },
        {
          name: 'n8n_create_outreach_workflow',
          description: 'Create a multi-channel outreach automation workflow',
          inputSchema: {
            type: 'object',
            properties: {
              workflow_name: {
                type: 'string',
                description: 'Name for the outreach workflow'
              },
              channels: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['email', 'linkedin', 'twitter', 'slack']
                },
                description: 'Communication channels to include'
              },
              sequence_days: {
                type: 'array',
                items: { type: 'integer' },
                description: 'Days to wait between outreach steps',
                default: [0, 3, 7, 14]
              }
            },
            required: ['workflow_name', 'channels']
          }
        },
        {
          name: 'n8n_health_check',
          description: 'Check N8N instance health and connectivity',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      ]
    }
  }

  async callTool(request: MCPCallToolRequest): Promise<MCPCallToolResult> {
    try {
      switch (request.params.name) {
        case 'n8n_list_workflows':
          return await this.listWorkflows(
            request.params.arguments?.active,
            request.params.arguments?.limit
          )
        
        case 'n8n_get_workflow':
          return await this.getWorkflow(request.params.arguments?.workflow_id)
        
        case 'n8n_create_workflow':
          return await this.createWorkflow(
            request.params.arguments?.name,
            request.params.arguments?.nodes,
            request.params.arguments?.connections
          )
        
        case 'n8n_execute_workflow':
          return await this.executeWorkflow(
            request.params.arguments?.workflow_id,
            request.params.arguments?.input_data
          )
        
        case 'n8n_get_executions':
          return await this.getExecutions(
            request.params.arguments?.workflow_id,
            request.params.arguments?.status,
            request.params.arguments?.limit
          )
        
        case 'n8n_create_sam_prospect_workflow':
          return await this.createSAMProspectWorkflow(
            request.params.arguments?.workflow_name,
            request.params.arguments?.data_sources,
            request.params.arguments?.output_format
          )
        
        case 'n8n_create_outreach_workflow':
          return await this.createOutreachWorkflow(
            request.params.arguments?.workflow_name,
            request.params.arguments?.channels,
            request.params.arguments?.sequence_days
          )
        
        case 'n8n_health_check':
          return await this.healthCheck()
        
        default:
          return {
            content: [{
              type: 'text',
              text: `Unknown N8N tool: ${request.params.name}`
            }],
            isError: true
          }
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `N8N MCP error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${this.config.baseUrl}/api/v1${endpoint}`, {
      ...options,
      headers: {
        'X-N8N-API-KEY': this.config.apiKey,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      throw new Error(`N8N API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  private async listWorkflows(active?: boolean, limit: number = 100): Promise<MCPCallToolResult> {
    try {
      const params = new URLSearchParams()
      if (active !== undefined) params.append('active', active.toString())
      params.append('limit', limit.toString())

      const workflows = await this.makeRequest(`/workflows?${params}`)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            workflows: workflows.data?.map((w: N8NWorkflow) => ({
              id: w.id,
              name: w.name,
              active: w.active,
              createdAt: w.createdAt,
              updatedAt: w.updatedAt,
              nodeCount: w.nodes?.length || 0,
              tags: w.tags?.map(t => t.name) || []
            })) || [],
            total: workflows.data?.length || 0,
            active_count: workflows.data?.filter((w: N8NWorkflow) => w.active).length || 0
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to list workflows: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async getWorkflow(workflowId: string): Promise<MCPCallToolResult> {
    try {
      const workflow = await this.makeRequest(`/workflows/${workflowId}`)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: workflow.id,
            name: workflow.name,
            active: workflow.active,
            nodes: workflow.nodes?.map((node: N8NNode) => ({
              id: node.id,
              name: node.name,
              type: node.type,
              position: node.position
            })) || [],
            connections: workflow.connections || {},
            settings: workflow.settings || {},
            tags: workflow.tags?.map((t: any) => t.name) || [],
            createdAt: workflow.createdAt,
            updatedAt: workflow.updatedAt
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to get workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async createWorkflow(name: string, nodes: any[], connections: any): Promise<MCPCallToolResult> {
    try {
      const workflowData = {
        name,
        nodes: nodes.map((node, index) => ({
          id: node.id || `node-${index}`,
          name: node.name,
          type: node.type,
          typeVersion: node.typeVersion || 1,
          position: node.position,
          parameters: node.parameters || {}
        })),
        connections: connections || {},
        active: false
      }

      const workflow = await this.makeRequest('/workflows', {
        method: 'POST',
        body: JSON.stringify(workflowData)
      })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Workflow created successfully',
            workflow_id: workflow.id,
            name: workflow.name,
            nodes_count: workflow.nodes?.length || 0,
            active: workflow.active,
            webhook_url: workflow.nodes?.find((n: any) => n.type === 'n8n-nodes-base.webhook')
              ? `${this.config.baseUrl}/webhook/${workflow.id}`
              : null
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to create workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async executeWorkflow(workflowId: string, inputData?: any): Promise<MCPCallToolResult> {
    try {
      const execution = await this.makeRequest(`/workflows/${workflowId}/execute`, {
        method: 'POST',
        body: JSON.stringify({
          inputData: inputData || {}
        })
      })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Workflow execution started',
            execution_id: execution.id,
            workflow_id: workflowId,
            status: execution.status || 'running',
            started_at: execution.startedAt || new Date().toISOString()
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to execute workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async getExecutions(workflowId?: string, status?: string, limit: number = 50): Promise<MCPCallToolResult> {
    try {
      const params = new URLSearchParams()
      if (workflowId) params.append('workflowId', workflowId)
      if (status) params.append('status', status)
      params.append('limit', limit.toString())

      const executions = await this.makeRequest(`/executions?${params}`)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            executions: executions.data?.map((exec: N8NExecution) => ({
              id: exec.id,
              workflowId: exec.workflowId,
              status: exec.status,
              mode: exec.mode,
              startedAt: exec.startedAt,
              finishedAt: exec.finishedAt,
              duration: exec.finishedAt && exec.startedAt 
                ? new Date(exec.finishedAt).getTime() - new Date(exec.startedAt).getTime()
                : null,
              error: exec.error
            })) || [],
            total: executions.data?.length || 0,
            success_rate: executions.data?.length > 0 
              ? executions.data.filter((e: N8NExecution) => e.status === 'success').length / executions.data.length 
              : 0
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to get executions: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async createSAMProspectWorkflow(name: string, dataSources: string[], outputFormat: string = 'supabase'): Promise<MCPCallToolResult> {
    try {
      const nodes: any[] = [
        // Trigger node
        {
          name: 'Webhook Trigger',
          type: 'n8n-nodes-base.webhook',
          position: [100, 100],
          parameters: {
            httpMethod: 'POST',
            path: `sam-prospect-${Date.now()}`
          }
        }
      ]

      let xPosition = 300
      const yPosition = 100

      // Add data source nodes
      dataSources.forEach((source, index) => {
        switch (source) {
          case 'linkedin':
            nodes.push({
              name: `LinkedIn Scraper`,
              type: 'n8n-nodes-base.httpRequest',
              position: [xPosition, yPosition + (index * 150)],
              parameters: {
                url: 'https://api.linkedin.com/v2/people',
                method: 'GET'
              }
            })
            break
          case 'apollo':
            nodes.push({
              name: `Apollo Enrichment`,
              type: 'n8n-nodes-base.httpRequest',
              position: [xPosition, yPosition + (index * 150)],
              parameters: {
                url: 'https://api.apollo.io/v1/people/search',
                method: 'POST'
              }
            })
            break
          case 'brightdata':
            nodes.push({
              name: `Bright Data Research`,
              type: 'n8n-nodes-base.httpRequest',
              position: [xPosition, yPosition + (index * 150)],
              parameters: {
                url: `${process.env.BRIGHT_DATA_ENDPOINT}/research`,
                method: 'POST'
              }
            })
            break
          case 'websearch':
            nodes.push({
              name: `Web Intelligence`,
              type: 'n8n-nodes-base.httpRequest',
              position: [xPosition, yPosition + (index * 150)],
              parameters: {
                url: 'https://api.search.brave.com/res/v1/web/search',
                method: 'GET'
              }
            })
            break
        }
      })

      // Add merge node
      nodes.push({
        name: 'Merge Data',
        type: 'n8n-nodes-base.merge',
        position: [xPosition + 200, yPosition],
        parameters: {
          mode: 'combine',
          combineBy: 'combineByPosition'
        }
      })

      // Add output node based on format
      if (outputFormat === 'supabase') {
        nodes.push({
          name: 'Save to Supabase',
          type: 'n8n-nodes-base.supabase',
          position: [xPosition + 400, yPosition],
          parameters: {
            operation: 'insert',
            table: 'prospects'
          }
        })
      }

      const workflow = await this.createWorkflow(name, nodes, {})

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'SAM Prospect Research workflow created successfully',
            workflow_id: JSON.parse(workflow.content[0].text!).workflow_id,
            data_sources: dataSources,
            output_format: outputFormat,
            webhook_url: `${this.config.baseUrl}/webhook/sam-prospect-${Date.now()}`,
            setup_instructions: [
              '1. Configure API credentials for each data source',
              '2. Test the webhook endpoint with sample data',
              '3. Activate the workflow when ready',
              '4. Monitor execution logs for optimization'
            ]
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to create SAM prospect workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async createOutreachWorkflow(name: string, channels: string[], sequenceDays: number[] = [0, 3, 7, 14]): Promise<MCPCallToolResult> {
    try {
      const nodes: any[] = [
        {
          name: 'Schedule Trigger',
          type: 'n8n-nodes-base.cron',
          position: [100, 100],
          parameters: {
            rule: {
              hour: 9,
              minute: 0
            }
          }
        }
      ]

      // Add delay and channel nodes for each sequence step
      sequenceDays.forEach((day, index) => {
        if (day > 0) {
          nodes.push({
            name: `Wait ${day} Days`,
            type: 'n8n-nodes-base.wait',
            position: [300 + (index * 200), 100],
            parameters: {
              amount: day,
              unit: 'days'
            }
          })
        }

        channels.forEach((channel, channelIndex) => {
          switch (channel) {
            case 'email':
              nodes.push({
                name: `Send Email ${index + 1}`,
                type: 'n8n-nodes-base.emailSend',
                position: [400 + (index * 200), 100 + (channelIndex * 100)],
                parameters: {
                  subject: `Follow-up ${index + 1}`,
                  message: 'Personalized outreach message'
                }
              })
              break
            case 'linkedin':
              nodes.push({
                name: `LinkedIn Message ${index + 1}`,
                type: 'n8n-nodes-base.httpRequest',
                position: [400 + (index * 200), 100 + (channelIndex * 100)],
                parameters: {
                  url: 'https://api.linkedin.com/v2/messages',
                  method: 'POST'
                }
              })
              break
          }
        })
      })

      const workflow = await this.createWorkflow(name, nodes, {})

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Multi-channel outreach workflow created successfully',
            workflow_id: JSON.parse(workflow.content[0].text!).workflow_id,
            channels: channels,
            sequence_days: sequenceDays,
            total_touchpoints: channels.length * sequenceDays.length,
            setup_instructions: [
              '1. Configure credentials for each communication channel',
              '2. Customize message templates for each touchpoint',
              '3. Set up prospect list and personalization variables',
              '4. Test the sequence with a small group first'
            ]
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to create outreach workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async healthCheck(): Promise<MCPCallToolResult> {
    try {
      const health = await this.makeRequest('/health')
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'healthy',
            n8n_version: health.version || 'unknown',
            client_id: this.clientId,
            base_url: this.config.baseUrl,
            timestamp: new Date().toISOString(),
            capabilities: [
              'workflow_creation',
              'workflow_execution',
              'webhook_triggers',
              'scheduled_executions',
              'sam_ai_optimization'
            ]
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }, null, 2)
        }],
        isError: true
      }
    }
  }
}