/**
 * ReachInbox MCP Server for SAM AI Platform
 *
 * Provides mass email campaign orchestration capabilities using the ReachInbox API
 */

import { MCPTool, MCPCallToolRequest, MCPCallToolResult } from './types'

export interface ReachInboxMCPConfig {
  apiKey: string
  baseUrl?: string
  organizationId: string
  userId: string
}

interface ReachInboxAccount {
  id: string
  email: string
  domain?: string
  status?: string
  daily_limit?: number
  warmup_stage?: number
  reputation_score?: number
}

interface LaunchCampaignArguments {
  workspace_id: string
  campaign_name?: string
  prospects: Array<Record<string, unknown>>
  email_accounts: string[]
  schedule?: Record<string, unknown>
  tracking?: Record<string, unknown>
  webhook_url?: string
  metadata?: Record<string, unknown>
}

export class ReachInboxMCPServer {
  private config: ReachInboxMCPConfig
  private baseUrl: string

  constructor(config: ReachInboxMCPConfig) {
    this.config = config
    this.baseUrl = config.baseUrl || 'https://api.reachinbox.ai/api/v1'
  }

  async listTools(): Promise<{ tools: MCPTool[] }> {
    return {
      tools: [
        {
          name: 'reachinbox_list_accounts',
          description: 'List managed ReachInbox email accounts for a workspace',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_id: {
                type: 'string',
                description: 'Workspace identifier assigned by ReachInbox'
              },
              status: {
                type: 'string',
                enum: ['active', 'warming', 'inactive'],
                description: 'Filter accounts by status'
              }
            },
            required: ['workspace_id']
          }
        },
        {
          name: 'reachinbox_launch_campaign',
          description: 'Create and launch an email campaign through ReachInbox',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_id: {
                type: 'string',
                description: 'Workspace identifier assigned by ReachInbox'
              },
              campaign_name: {
                type: 'string',
                description: 'Optional campaign name override'
              },
              prospects: {
                type: 'array',
                description: 'Prospect payloads with personalized fields',
                items: { type: 'object' }
              },
              email_accounts: {
                type: 'array',
                description: 'ReachInbox email account IDs to distribute sending across',
                items: { type: 'string' }
              },
              schedule: {
                type: 'object',
                description: 'Schedule configuration (start date, daily limits, timezone, etc.)'
              },
              tracking: {
                type: 'object',
                description: 'Tracking toggles (open, click, reply, unsubscribe)'
              },
              webhook_url: {
                type: 'string',
                description: 'Webhook endpoint for ReachInbox to send campaign events'
              },
              metadata: {
                type: 'object',
                description: 'Additional metadata to store alongside the campaign'
              }
            },
            required: ['workspace_id', 'prospects', 'email_accounts']
          }
        },
        {
          name: 'reachinbox_get_campaign_stats',
          description: 'Retrieve detailed statistics for a ReachInbox campaign',
          inputSchema: {
            type: 'object',
            properties: {
              campaign_id: {
                type: 'string',
                description: 'ReachInbox campaign ID'
              }
            },
            required: ['campaign_id']
          }
        },
        {
          name: 'reachinbox_campaign_action',
          description: 'Control a ReachInbox campaign (pause, resume, stop)',
          inputSchema: {
            type: 'object',
            properties: {
              campaign_id: {
                type: 'string',
                description: 'ReachInbox campaign ID'
              },
              action: {
                type: 'string',
                enum: ['pause', 'resume', 'stop'],
                description: 'Action to perform on the campaign'
              }
            },
            required: ['campaign_id', 'action']
          }
        },
        {
          name: 'reachinbox_health_check',
          description: 'Verify ReachInbox API connectivity and workspace access',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_id: {
                type: 'string',
                description: 'Optional workspace ID to validate account access'
              }
            },
            required: []
          }
        }
      ]
    }
  }

  async callTool(request: MCPCallToolRequest): Promise<MCPCallToolResult> {
    try {
      switch (request.params.name) {
        case 'reachinbox_list_accounts':
          return await this.listAccounts(
            request.params.arguments?.workspace_id,
            request.params.arguments?.status
          )

        case 'reachinbox_launch_campaign':
          return await this.launchCampaign(request.params.arguments as LaunchCampaignArguments)

        case 'reachinbox_get_campaign_stats':
          return await this.getCampaignStats(request.params.arguments?.campaign_id)

        case 'reachinbox_campaign_action':
          return await this.campaignAction(
            request.params.arguments?.campaign_id,
            request.params.arguments?.action
          )

        case 'reachinbox_health_check':
          return await this.healthCheck(request.params.arguments?.workspace_id)

        default:
          return {
            content: [{
              type: 'text',
              text: `Unknown ReachInbox tool: ${request.params.name}`
            }],
            isError: true
          }
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `ReachInbox MCP error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    const text = await response.text()
    const body = text ? (JSON.parse(text) as T) : ({} as T)

    if (!response.ok) {
      const message = (body as Record<string, unknown>)?.message || response.statusText
      throw new Error(`ReachInbox API error (${response.status}): ${message}`)
    }

    return body
  }

  private async listAccounts(workspaceId?: string, status?: string): Promise<MCPCallToolResult> {
    if (!workspaceId) {
      return {
        content: [{
          type: 'text',
          text: 'workspace_id is required to list ReachInbox accounts'
        }],
        isError: true
      }
    }

    const endpoint = `/workspace/${workspaceId}/accounts`
    const data = await this.makeRequest<{ accounts?: ReachInboxAccount[] }>(endpoint)
    const accounts = (data.accounts || []).filter(account =>
      status ? account.status === status : true
    )

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          workspace_id: workspaceId,
          total_accounts: accounts.length,
          accounts
        }, null, 2)
      }]
    }
  }

  private async launchCampaign(args: LaunchCampaignArguments): Promise<MCPCallToolResult> {
    if (!args.workspace_id || !Array.isArray(args.prospects) || args.prospects.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'workspace_id and prospects array are required to launch a ReachInbox campaign'
        }],
        isError: true
      }
    }

    if (!Array.isArray(args.email_accounts) || args.email_accounts.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'At least one ReachInbox email account ID is required'
        }],
        isError: true
      }
    }

    const payload: Record<string, unknown> = {
      name: args.campaign_name || `SAM AI Campaign ${Date.now()}`,
      workspace_id: args.workspace_id,
      prospects: args.prospects,
      email_accounts: args.email_accounts,
      schedule: args.schedule || {},
      tracking: args.tracking || {},
      sam_ai_integration: true
    }

    if (args.webhook_url) {
      payload.webhook_url = args.webhook_url
    }

    if (args.metadata) {
      payload.metadata = args.metadata
    }

    const result = await this.makeRequest<Record<string, unknown>>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload)
    })

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'ReachInbox campaign launched',
          result
        }, null, 2)
      }]
    }
  }

  private async getCampaignStats(campaignId?: string): Promise<MCPCallToolResult> {
    if (!campaignId) {
      return {
        content: [{
          type: 'text',
          text: 'campaign_id is required to fetch statistics'
        }],
        isError: true
      }
    }

    const stats = await this.makeRequest<Record<string, unknown>>(`/campaigns/${campaignId}/stats`)

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(stats, null, 2)
      }]
    }
  }

  private async campaignAction(campaignId?: string, action?: string): Promise<MCPCallToolResult> {
    if (!campaignId || !action) {
      return {
        content: [{
          type: 'text',
          text: 'campaign_id and action are required'
        }],
        isError: true
      }
    }

    if (!['pause', 'resume', 'stop'].includes(action)) {
      return {
        content: [{
          type: 'text',
          text: `Invalid action "${action}". Valid actions: pause, resume, stop.`
        }],
        isError: true
      }
    }

    const result = await this.makeRequest<Record<string, unknown>>(`/campaigns/${campaignId}/${action}`, {
      method: 'POST'
    })

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: `ReachInbox campaign ${action} executed`,
          result
        }, null, 2)
      }]
    }
  }

  private async healthCheck(workspaceId?: string): Promise<MCPCallToolResult> {
    try {
      const summary: Record<string, unknown> = {
        api_base_url: this.baseUrl,
        organization_id: this.config.organizationId,
        user_id: this.config.userId
      }

      if (workspaceId) {
        const accountsResult = await this.listAccounts(workspaceId)
        const textContent = accountsResult.content.find(item => item.type === 'text')?.text
        summary.accounts_check = textContent ? JSON.parse(textContent) : { message: 'No accounts data returned' }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'ok',
            summary
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error'
          }, null, 2)
        }],
        isError: true
      }
    }
  }
}

export default ReachInboxMCPServer
