/**
 * Apify MCP Server for SAM AI Platform
 *
 * Provides LinkedIn research utilities by running Apify actors. Requires an
 * Apify API token and, optionally, a default actor ID supplied via
 * environment variables or MCP configuration.
 */

import {
  MCPTool,
  MCPCallToolRequest,
  MCPCallToolResult,
  ApifyMCPConfig,
  ApifyProspectRequest
} from './types'

const DEFAULT_APIFY_BASE_URL = 'https://api.apify.com'

export class ApifyMCPServer {
  private config: ApifyMCPConfig
  private tools: MCPTool[]

  constructor(config: ApifyMCPConfig) {
    this.config = config
    this.tools = this.initializeTools()
  }

  private initializeTools(): MCPTool[] {
    return [
      {
        name: 'research_linkedin_prospect',
        description: 'Run an Apify actor to scrape/enrich specific LinkedIn profiles',
        inputSchema: {
          type: 'object',
          properties: {
            actorId: {
              type: 'string',
              description: 'Apify actor ID to execute (defaults to APIFY_DEFAULT_ACTOR_ID)'
            },
            searchUrl: {
              type: 'string',
              description: 'LinkedIn profile or search URL provided to the actor input'
            },
            input: {
              type: 'object',
              description: 'Raw input object passed to the actor'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to fetch'
            },
            waitForResults: {
              type: 'boolean',
              description: 'Whether to wait synchronously for actor completion',
              default: true
            }
          },
          required: []
        }
      },
      {
        name: 'search_linkedin_prospects',
        description: 'Use an Apify actor to search for prospects by criteria',
        inputSchema: {
          type: 'object',
          properties: {
            actorId: {
              type: 'string',
              description: 'Apify actor ID to execute for prospect search'
            },
            searchCriteria: {
              type: 'object',
              description: 'Structured search criteria forwarded to the actor input'
            },
            input: {
              type: 'object',
              description: 'Raw actor input (overrides searchCriteria)'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to fetch'
            },
            waitForResults: {
              type: 'boolean',
              description: 'Whether to wait synchronously for actor completion',
              default: true
            }
          },
          required: ['searchCriteria']
        }
      },
      {
        name: 'check_apify_status',
        description: 'Check Apify account information and current usage limits',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ]
  }

  async listTools(): Promise<{ tools: MCPTool[] }> {
    return { tools: this.tools }
  }

  async callTool(request: MCPCallToolRequest): Promise<MCPCallToolResult> {
    try {
      switch (request.params.name) {
        case 'research_linkedin_prospect':
          return await this.researchLinkedInProspect(request.params.arguments as ApifyProspectRequest)
        case 'search_linkedin_prospects':
          return await this.searchLinkedInProspects(request.params.arguments as ApifyProspectRequest)
        case 'check_apify_status':
          return await this.checkApifyStatus()
        default:
          return {
            content: [{
              type: 'text',
              text: `Unknown Apify tool: ${request.params.name}`
            }],
            isError: true
          }
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Apify MCP error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async researchLinkedInProspect(request: ApifyProspectRequest): Promise<MCPCallToolResult> {
    const actorId = request.actorId || this.config.defaultActorId

    if (!actorId) {
      return {
        content: [{
          type: 'text',
          text: 'Apify actorId is required (provide in request or configure APIFY_DEFAULT_ACTOR_ID).'
        }],
        isError: true
      }
    }

    const input = request.input ?? this.buildProspectInput(request)
    const datasetItems = await this.runActorAndFetchDataset(actorId, input, request.maxResults, request.waitForResults)

    const result = {
      success: true,
      actorId,
      itemCount: datasetItems.items.length,
      run: datasetItems.run,
      items: datasetItems.items,
      timestamp: new Date().toISOString()
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    }
  }

  private async searchLinkedInProspects(request: ApifyProspectRequest): Promise<MCPCallToolResult> {
    const actorId = request.actorId || this.config.defaultActorId

    if (!actorId) {
      return {
        content: [{
          type: 'text',
          text: 'Apify actorId is required to search prospects. Set APIFY_DEFAULT_ACTOR_ID or pass actorId.'
        }],
        isError: true
      }
    }

    const input = request.input ?? { searchCriteria: request.searchCriteria, maxResults: request.maxResults }
    const datasetItems = await this.runActorAndFetchDataset(actorId, input, request.maxResults, request.waitForResults)

    const result = {
      success: true,
      actorId,
      itemCount: datasetItems.items.length,
      run: datasetItems.run,
      items: datasetItems.items,
      timestamp: new Date().toISOString()
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    }
  }

  private async checkApifyStatus(): Promise<MCPCallToolResult> {
    const response = await fetch(`${this.getBaseUrl()}/v2/me?token=${this.getApiToken()}`)
    if (!response.ok) {
      const body = await response.text()
      return {
        content: [{
          type: 'text',
          text: `Apify status check failed (${response.status}): ${body || 'unknown error'}`
        }],
        isError: true
      }
    }

    const data = await response.json()
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          user: data?.data?.username ?? 'unknown',
          availableCreditsUsd: data?.data?.availableMonthlyUsageUsd,
          limits: data?.data?.limits,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    }
  }

  private buildProspectInput(request: ApifyProspectRequest): Record<string, unknown> {
    const input: Record<string, unknown> = {}

    if (request.searchUrl) {
      input.search = request.searchUrl
    }

    if (typeof request.extractEmails === 'boolean') {
      input.extractEmails = request.extractEmails
    }

    if (typeof request.extractPhones === 'boolean') {
      input.extractPhones = request.extractPhones
    }

    if (typeof request.maxResults === 'number') {
      input.maxResults = request.maxResults
    }

    return input
  }

  private async runActorAndFetchDataset(
    actorId: string,
    input: Record<string, unknown>,
    limit?: number,
    waitForResults = true
  ): Promise<{ run: Record<string, unknown>; items: any[] }> {
    const run = await this.runActor(actorId, input, waitForResults)

    if (!waitForResults) {
      return {
        run,
        items: []
      }
    }

    const datasetId = run?.data?.defaultDatasetId || run?.data?.datasetId || run?.data?.outputDatasetId
    if (!datasetId) {
      throw new Error('Apify run did not return a dataset ID. Ensure the actor outputs to a dataset.')
    }

    const items = await this.fetchDatasetItems(datasetId, limit)
    return { run, items }
  }

  private async runActor(actorId: string, input: Record<string, unknown>, waitForResults: boolean): Promise<Record<string, unknown>> {
    const query = new URLSearchParams({ token: this.getApiToken() })
    if (waitForResults) {
      query.set('wait', 'true')
      query.set('build', 'latest')
    }

    const response = await fetch(`${this.getBaseUrl()}/v2/acts/${actorId}/runs?${query.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(input ?? {})
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Apify actor run failed (${response.status}): ${errorBody || 'unknown error'}`)
    }

    const data = await response.json()

    const status = data?.data?.status || data?.status
    if (waitForResults && status && status !== 'SUCCEEDED') {
      throw new Error(`Apify actor run finished with status ${status}`)
    }

    return data
  }

  private async fetchDatasetItems(datasetId: string, limit?: number): Promise<any[]> {
    const query = new URLSearchParams({ token: this.getApiToken(), format: 'json' })
    if (limit) {
      query.set('limit', String(limit))
    }

    const response = await fetch(`${this.getBaseUrl()}/v2/datasets/${datasetId}/items?${query.toString()}`)
    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Failed to fetch Apify dataset items (${response.status}): ${errorBody || 'unknown error'}`)
    }

    const text = await response.text()
    const trimmed = text.trim()
    if (!trimmed) {
      return []
    }

    try {
      return JSON.parse(trimmed)
    } catch (error) {
      const lines = trimmed.split('\n').map(line => line.trim()).filter(Boolean)
      return lines.map(line => JSON.parse(line))
    }
  }

  private getApiToken(): string {
    const token = this.config.apiToken || process.env.APIFY_API_TOKEN
    if (!token) {
      throw new Error('APIFY_API_TOKEN is not configured. Provide a valid Apify token to use this tool.')
    }
    return token
  }

  private getBaseUrl(): string {
    return this.config.baseUrl || process.env.APIFY_API_BASE_URL || DEFAULT_APIFY_BASE_URL
  }
}
