/**
 * Bright Data MCP Server for SAM AI Platform
 *
 * Provides enterprise-grade LinkedIn prospect intelligence via Bright Data's
 * Data Collector API. Requires a Bright Data API token and, optionally,
 * default collector configuration supplied through environment variables.
 */

import {
  MCPTool,
  MCPCallToolRequest,
  MCPCallToolResult,
  BrightDataMCPConfig,
  BrightDataProspectRequest
} from './types'
import { AutoIPAssignmentService } from '@/lib/services/auto-ip-assignment'

const DEFAULT_BASE_URL = 'https://api.brightdata.com'
const DEFAULT_WAIT_SECONDS = 60
const POLL_INTERVAL_MS = 2500

export class BrightDataMCPServer {
  private config: BrightDataMCPConfig
  private tools: MCPTool[]
  private autoIPService: AutoIPAssignmentService

  constructor(config: BrightDataMCPConfig) {
    this.config = config
    this.autoIPService = new AutoIPAssignmentService()
    this.tools = this.initializeTools()
  }

  private initializeTools(): MCPTool[] {
    return [
      {
        name: 'research_prospect',
        description: 'Run a Bright Data collector to research LinkedIn prospects',
        inputSchema: {
          type: 'object',
          properties: {
            collectorId: {
              type: 'string',
              description: 'Bright Data collector ID (overrides default)'
            },
            datasetId: {
              type: 'string',
              description: 'Existing dataset ID to fetch instead of launching a new run'
            },
            profileUrls: {
              type: 'array',
              items: { type: 'string' },
              description: 'LinkedIn profile URLs to enrich'
            },
            searchCriteria: {
              type: 'object',
              properties: {
                jobTitles: { type: 'array', items: { type: 'string' } },
                companies: { type: 'array', items: { type: 'string' } },
                industries: { type: 'array', items: { type: 'string' } },
                locations: { type: 'array', items: { type: 'string' } },
                keywords: { type: 'array', items: { type: 'string' } }
              },
              description: 'Structured search criteria for the collector payload'
            },
            payload: {
              type: 'object',
              description: 'Raw payload object to send to the collector (overrides auto-generated payload)'
            },
            depth: {
              type: 'string',
              enum: ['quick', 'standard', 'comprehensive'],
              description: 'Collector-specific depth preference'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to request or fetch'
            },
            waitForResultsSeconds: {
              type: 'number',
              description: 'How long to wait for dataset to finish before timing out'
            }
          },
          required: ['depth']
        }
      },
      {
        name: 'analyze_company',
        description: 'Run company-oriented collectors (requires collectorId)',
        inputSchema: {
          type: 'object',
          properties: {
            collectorId: { type: 'string' },
            payload: { type: 'object' },
            waitForResultsSeconds: { type: 'number' }
          },
          required: ['collectorId']
        }
      },
      {
        name: 'generate_strategic_insights',
        description: 'Summarize existing prospect data with selected methodology',
        inputSchema: {
          type: 'object',
          properties: {
            prospects: { type: 'array' },
            methodology: { type: 'string', enum: ['challenger', 'spin', 'meddic'] },
            conversationContext: { type: 'string' }
          },
          required: ['prospects', 'methodology']
        }
      },
      {
        name: 'check_system_health',
        description: 'Verify Bright Data API connectivity and collector availability',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'auto_assign_proxy_location',
        description: 'Assign optimal Bright Data proxy location based on detected user location',
        inputSchema: {
          type: 'object',
          properties: {
            linkedinProfileLocation: {
              type: 'string',
              description: 'Override location determination with LinkedIn profile location'
            },
            forceRegenerate: {
              type: 'boolean',
              description: 'Force regeneration of proxy configuration even if cached'
            }
          },
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
        case 'research_prospect':
          return await this.researchProspect(request.params.arguments as BrightDataProspectRequest)
        case 'analyze_company':
          return await this.researchProspect({
            ...(request.params.arguments as Record<string, unknown>),
            depth: 'standard'
          } as BrightDataProspectRequest)
        case 'generate_strategic_insights':
          return await this.generateStrategicInsights(request.params.arguments as any)
        case 'check_system_health':
          return await this.checkSystemHealth()
        case 'auto_assign_proxy_location':
          return await this.autoAssignProxyLocation(request.params.arguments as any)
        default:
          return {
            content: [{
              type: 'text',
              text: `Unknown tool: ${request.params.name}`
            }],
            isError: true
          }
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Bright Data MCP error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async researchProspect(request: BrightDataProspectRequest): Promise<MCPCallToolResult> {
    const apiToken = this.getApiToken()
    const collectorId = request.collectorId || this.config.defaultCollectorId
    let datasetId = request.datasetId
    let runInfo: Record<string, unknown> | undefined

    if (!datasetId) {
      if (!collectorId) {
        return {
          content: [{
            type: 'text',
            text: 'Bright Data collectorId is required (provide in request or configure BRIGHT_DATA_DEFAULT_COLLECTOR_ID).'
          }],
          isError: true
        }
      }

      const payload = request.payload ?? this.buildCollectorPayload(request)
      runInfo = await this.runCollector(apiToken, collectorId, payload, request.maxResults)
      datasetId = runInfo.datasetId as string | undefined

      if (!datasetId) {
        return {
          content: [{
            type: 'text',
            text: 'Bright Data collector run did not return a dataset_id. Check collector configuration.'
          }],
          isError: true
        }
      }
    }

    const waitSeconds = request.waitForResultsSeconds ?? this.config.defaultWaitSeconds ?? DEFAULT_WAIT_SECONDS
    const items = await this.fetchDatasetItems(apiToken, datasetId, waitSeconds, request.maxResults)

    const result = {
      success: true,
      source: 'bright_data',
      datasetId,
      collectorId: collectorId ?? 'n/a',
      itemCount: items.length,
      items,
      runInfo,
      timestamp: new Date().toISOString()
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    }
  }

  private buildCollectorPayload(request: BrightDataProspectRequest): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      profileUrls: request.profileUrls,
      searchCriteria: request.searchCriteria,
      depth: request.depth,
      maxResults: request.maxResults
    }

    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined || payload[key] === null) {
        delete payload[key]
      }
    })

    return payload
  }

  private async runCollector(
    apiToken: string,
    collectorId: string,
    payload: Record<string, unknown>,
    maxResults?: number
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = {
      format: 'json',
      limit: maxResults,
      payload
    }

    const response = await fetch(`${this.getBaseUrl()}/dca/dataset?id=${collectorId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Bright Data collector run failed (${response.status}): ${errorBody || 'unknown error'}`)
    }

    const data = await response.json() as Record<string, unknown>
    if (!data.dataset_id && !data.datasetId) {
      throw new Error('Bright Data API response did not include a dataset identifier.')
    }

    return {
      ...data,
      datasetId: data.dataset_id ?? data.datasetId
    }
  }

  private async fetchDatasetItems(
    apiToken: string,
    datasetId: string,
    waitSeconds: number,
    limit?: number
  ): Promise<any[]> {
    const timeoutAt = Date.now() + waitSeconds * 1000
    let lastError: string | undefined

    while (Date.now() < timeoutAt) {
      const query = new URLSearchParams({ format: 'json' })
      if (limit) {
        query.set('limit', String(limit))
      }

      const response = await fetch(`${this.getBaseUrl()}/datasets/v1/${datasetId}/items?${query.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      })

      if (response.ok) {
        const text = await response.text()
        const trimmed = text.trim()

        if (!trimmed) {
          await this.delay(POLL_INTERVAL_MS)
          continue
        }

        try {
          return this.parseItemsResponse(trimmed)
        } catch (error) {
          lastError = `Failed to parse dataset items: ${error instanceof Error ? error.message : String(error)}`
          break
        }
      }

      if (response.status === 404 || response.status === 425) {
        // Dataset not ready yet
        await this.delay(POLL_INTERVAL_MS)
        continue
      }

      const body = await response.text()
      lastError = `Dataset fetch failed (${response.status}): ${body || 'unknown error'}`
      break
    }

    throw new Error(lastError || 'Timed out waiting for Bright Data dataset to finish processing.')
  }

  private parseItemsResponse(payload: string): any[] {
    try {
      const parsed = JSON.parse(payload)
      if (Array.isArray(parsed)) {
        return parsed
      }
      return [parsed]
    } catch (error) {
      const lines = payload.split('\n').map(line => line.trim()).filter(Boolean)
      if (!lines.length) {
        throw error
      }
      return lines.map(line => JSON.parse(line))
    }
  }

  private async checkSystemHealth(): Promise<MCPCallToolResult> {
    const apiToken = this.getApiToken()
    const response = await fetch(`${this.getBaseUrl()}/dca/collectors?limit=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    })

    if (!response.ok) {
      const body = await response.text()
      return {
        content: [{
          type: 'text',
          text: `Bright Data health check failed (${response.status}): ${body || 'unknown error'}`
        }],
        isError: true
      }
    }

    const data = await response.json()
    const collectors = Array.isArray(data) ? data : (data?.collectors ?? data?.items ?? [])

    const result = {
      success: true,
      collectorCount: Array.isArray(collectors) ? collectors.length : 0,
      sampleCollectors: (collectors as any[]).slice(0, 3).map(collector => ({
        id: collector?.id ?? collector?._id ?? 'unknown',
        name: collector?.name ?? 'unknown',
        status: collector?.status ?? collector?.state ?? 'unknown'
      })),
      timestamp: new Date().toISOString()
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    }
  }

  private async autoAssignProxyLocation(request: { linkedinProfileLocation?: string; forceRegenerate?: boolean }): Promise<MCPCallToolResult> {
    try {
      const userLocation = await this.autoIPService.detectUserLocation()
      const proxyConfig = await this.autoIPService.generateOptimalProxyConfig(
        userLocation || undefined,
        request.linkedinProfileLocation
      )

      const connectivityTest = await this.autoIPService.testProxyConnectivity(proxyConfig)

      const result = {
        success: true,
        proxyConfig: {
          country: proxyConfig.country,
          state: proxyConfig.state,
          city: proxyConfig.city,
          confidence: proxyConfig.confidence,
          sessionId: proxyConfig.sessionId
        },
        userLocation,
        connectivityTest,
        recommendations: {
          optimalLocation: `${proxyConfig.country}${proxyConfig.state ? `/${proxyConfig.state}` : ''}`,
          alternativeLocations: this.autoIPService.getAvailableLocations()
            .filter(loc => loc.country !== proxyConfig.country)
            .slice(0, 3)
            .map(loc => loc.displayName)
        },
        timestamp: new Date().toISOString()
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Auto proxy assignment error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async generateStrategicInsights(request: { prospects: any[]; methodology: string; conversationContext?: string }): Promise<MCPCallToolResult> {
    const insights = {
      methodology: request.methodology,
      insights: this.generateInsightsByMethodology(request.prospects, request.methodology),
      conversationStarters: this.generateConversationStarters(request.prospects, request.methodology),
      nextActions: this.generateNextActions(request.prospects, request.methodology),
      timestamp: new Date().toISOString()
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(insights, null, 2)
      }]
    }
  }

  private generateInsightsByMethodology(prospects: any[], methodology: string): any[] {
    if (!Array.isArray(prospects) || !prospects.length) {
      return []
    }

    switch (methodology) {
      case 'challenger':
        return prospects.slice(0, 3).map(prospect => ({
          type: 'opportunity',
          insight: `Challenge the status quo at ${prospect.company ?? 'their company'} with a differentiated POV`,
          evidence: [prospect.title, prospect.industry].filter(Boolean),
          confidence: 0.7
        }))
      case 'spin':
        return prospects.slice(0, 3).map(prospect => ({
          type: 'pain_point',
          insight: `Explore implications of current process for ${prospect.company ?? 'their organization'}.`,
          question: `How is ${prospect.title ?? 'your team'} measuring success today?`,
          confidence: 0.65
        }))
      case 'meddic':
        return prospects.slice(0, 3).map(prospect => ({
          type: 'qualification',
          metric: 'Pipeline coverage',
          decisionCriteria: prospect.industry,
          suggestedChampion: `${prospect.full_name ?? prospect.name ?? 'Prospect'}`,
          confidence: 0.6
        }))
      default:
        return []
    }
  }

  private generateConversationStarters(prospects: any[], methodology: string): string[] {
    if (!Array.isArray(prospects) || !prospects.length) {
      return []
    }

    const firstProspect = prospects[0]
    const company = firstProspect.company ?? 'your organization'

    switch (methodology) {
      case 'challenger':
        return [`I noticed ${company} is investing heavily in growth—how are you balancing personalization with volume right now?`]
      case 'spin':
        return [`What happens to pipeline if ${company} doubles outbound volume without additional enablement?`]
      case 'meddic':
        return [`Who ultimately signs off on new sales tooling at ${company}, and what KPIs matter most to them?`]
      default:
        return []
    }
  }

  private generateNextActions(prospects: any[], methodology: string): string[] {
    if (!Array.isArray(prospects) || !prospects.length) {
      return []
    }

    switch (methodology) {
      case 'challenger':
        return ['Craft tailored POV deck referencing recent strategic shifts.']
      case 'spin':
        return ['Prepare discovery call focused on situational and implication questions.']
      case 'meddic':
        return ['Map economic buyer, champion, and metrics with CRM notes.']
      default:
        return []
    }
  }

  private getApiToken(): string {
    const token = this.config.apiToken || process.env.BRIGHT_DATA_API_TOKEN
    if (!token) {
      throw new Error('BRIGHT_DATA_API_TOKEN is not configured. Provide a valid Bright Data API token to use this tool.')
    }
    return token
  }

  private getBaseUrl(): string {
    return this.config.baseUrl || process.env.BRIGHT_DATA_API_BASE_URL || DEFAULT_BASE_URL
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
