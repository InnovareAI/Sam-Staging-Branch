/**
 * MCP Server Registry for SAM AI Platform
 * 
 * Centralized management of all MCP servers and tools
 */

import { BrightDataMCPServer } from './bright-data-mcp'
import { ApifyMCPServer } from './apify-mcp'
import { GoogleSearchMCPServer } from './google-search-mcp'
import { WebSearchMCPServer, WebSearchMCPConfig } from './websearch-mcp'
import { UnipileMCPServer } from './unipile-mcp'
import { N8NMCPServer } from './n8n-mcp'
import { ReplyAgentMCPServer } from './reply-agent-mcp'
import { DatabaseMCPServer } from './database-mcp'
import { ReachInboxMCPServer } from './reachinbox-mcp'
import * as TemplateMCP from './template-mcp'
import * as GPT5MCP from './gpt5-mcp'
import { GPT5MCPServer } from './gpt5-mcp'
import * as CampaignOrchestrationMCP from './campaign-orchestration-mcp'
import { 
  MCPTool, 
  MCPCallToolRequest, 
  MCPCallToolResult,
  BrightDataMCPConfig,
  ApifyMCPConfig,
  GoogleSearchMCPConfig,
  UnipileMCPConfig,
  N8NMCPConfig,
  ReachInboxMCPConfig,
  ReplyAgentMCPConfig,
  DatabaseMCPConfig
} from './types'
import { GPT5MCPConfig } from './gpt5-mcp'

export interface MCPServerConfig {
  brightData?: BrightDataMCPConfig
  apify?: ApifyMCPConfig
  googleSearch?: GoogleSearchMCPConfig
  webSearch?: WebSearchMCPConfig
  unipile?: UnipileMCPConfig
  n8n?: N8NMCPConfig
  reachInbox?: ReachInboxMCPConfig
  replyAgent?: ReplyAgentMCPConfig
  database?: DatabaseMCPConfig
  gpt5?: GPT5MCPConfig
}

export class MCPRegistry {
  private brightDataServer?: BrightDataMCPServer
  private apifyServer?: ApifyMCPServer
  private googleSearchServer?: GoogleSearchMCPServer
  private webSearchServer?: WebSearchMCPServer
  private unipileServer?: UnipileMCPServer
  private n8nServer?: N8NMCPServer
  private reachInboxServer?: ReachInboxMCPServer
  private replyAgentServer?: ReplyAgentMCPServer
  private databaseServer?: DatabaseMCPServer
  private gpt5Server?: GPT5MCPServer
  private isInitialized = false

  async initialize(config: MCPServerConfig): Promise<{ success: boolean; message: string; servers: string[] }> {
    try {
      const initializedServers: string[] = []

      // Initialize Bright Data MCP Server
      if (config.brightData) {
        this.brightDataServer = new BrightDataMCPServer(config.brightData)
        initializedServers.push('Bright Data MCP')
      }

      // Initialize Apify MCP Server  
      if (config.apify) {
        this.apifyServer = new ApifyMCPServer(config.apify)
        initializedServers.push('Apify MCP')
      }

      // Initialize Google Search MCP Server
      if (config.googleSearch) {
        this.googleSearchServer = new GoogleSearchMCPServer(config.googleSearch)
        initializedServers.push('Google Search MCP')
      }

      // Initialize WebSearch MCP Server (mock/fallback search)
      if (config.webSearch) {
        this.webSearchServer = new WebSearchMCPServer(config.webSearch)
        initializedServers.push('WebSearch MCP')
      }

      // Initialize Unipile MCP Server
      if (config.unipile) {
        this.unipileServer = new UnipileMCPServer(config.unipile)
        initializedServers.push('Unipile MCP')
      }

      // Initialize N8N MCP Server
      if (config.n8n) {
        this.n8nServer = new N8NMCPServer(config.n8n)
        initializedServers.push('N8N MCP')
      }

      // Initialize ReachInbox MCP Server
      if (config.reachInbox) {
        this.reachInboxServer = new ReachInboxMCPServer(config.reachInbox)
        initializedServers.push('ReachInbox MCP')
      }

      // Initialize Reply Agent MCP Server
      if (config.replyAgent) {
        this.replyAgentServer = new ReplyAgentMCPServer(config.replyAgent)
        initializedServers.push('Reply Agent MCP')
      }

      // Initialize GPT5 MCP Server
      if (config.gpt5) {
        this.gpt5Server = new GPT5MCPServer(config.gpt5)
        initializedServers.push('GPT-5 MCP')
      }

      this.isInitialized = true

      return {
        success: true,
        message: `MCP Registry initialized with ${initializedServers.length} servers`,
        servers: initializedServers
      }
    } catch (error) {
      return {
        success: false,
        message: `MCP Registry initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        servers: []
      }
    }
  }

  async listAllTools(): Promise<{ tools: Array<MCPTool & { server: string }> }> {
    const allTools: Array<MCPTool & { server: string }> = []

    if (this.brightDataServer) {
      const brightDataTools = await this.brightDataServer.listTools()
      brightDataTools.tools.forEach(tool => {
        allTools.push({ ...tool, server: 'bright-data' })
      })
    }

    if (this.apifyServer) {
      const apifyTools = await this.apifyServer.listTools()
      apifyTools.tools.forEach(tool => {
        allTools.push({ ...tool, server: 'apify' })
      })
    }

    if (this.googleSearchServer) {
      const googleSearchTools = await this.googleSearchServer.listTools()
      googleSearchTools.tools.forEach(tool => {
        allTools.push({ ...tool, server: 'google-search' })
      })
    }

    if (this.webSearchServer) {
      const webSearchTools = await this.webSearchServer.listTools()
      webSearchTools.tools.forEach(tool => {
        allTools.push({ ...tool, server: 'websearch' })
      })
    }

    if (this.unipileServer) {
      const unipileTools = await this.unipileServer.listTools()
      unipileTools.tools.forEach(tool => {
        allTools.push({ ...tool, server: 'unipile' })
      })
    }

    if (this.n8nServer) {
      const n8nTools = await this.n8nServer.listTools()
      n8nTools.tools.forEach(tool => {
        allTools.push({ ...tool, server: 'n8n' })
      })
    }

    if (this.reachInboxServer) {
      const reachInboxTools = await this.reachInboxServer.listTools()
      reachInboxTools.tools.forEach(tool => {
        allTools.push({ ...tool, server: 'reachinbox' })
      })
    }

    if (this.replyAgentServer) {
      const replyTools = await this.replyAgentServer.listTools()
      replyTools.tools.forEach(tool => {
        allTools.push({ ...tool, server: 'reply-agent' })
      })
    }

    if (this.gpt5Server) {
      const gpt5Tools = await this.gpt5Server.listTools()
      gpt5Tools.tools.forEach(tool => {
        allTools.push({ ...tool, server: 'gpt5' })
      })
    }

    // Add Sam AI tools (always available)
    const samAITools = [
      // Template tools
      { name: 'mcp__template__create', description: 'Create a new messaging template' },
      { name: 'mcp__template__get_by_criteria', description: 'Get templates by search criteria' },
      { name: 'mcp__template__get_by_id', description: 'Get specific template by ID' },
      { name: 'mcp__template__update', description: 'Update existing template' },
      { name: 'mcp__template__delete', description: 'Delete template (soft delete)' },
      { name: 'mcp__template__track_performance', description: 'Track template performance metrics' },
      { name: 'mcp__template__get_performance', description: 'Get template performance data' },
      { name: 'mcp__template__clone', description: 'Clone existing template with modifications' },
      { name: 'mcp__template__get_top_performers', description: 'Get top performing templates' },
      
      // GPT-5 tools
      { name: 'mcp__gpt5__optimize_template', description: 'Optimize template using GPT-5 AI' },
      { name: 'mcp__gpt5__analyze_performance', description: 'Analyze template performance with GPT-5 insights' },
      { name: 'mcp__gpt5__generate_variations', description: 'Generate A/B test variations with GPT-5' },
      { name: 'mcp__gpt5__personalize_for_prospect', description: 'Personalize template for specific prospect using GPT-5' },
      
      // Campaign orchestration tools
      { name: 'mcp__sam__create_campaign', description: 'Sam creates campaign from conversation' },
      { name: 'mcp__sam__execute_campaign', description: 'Sam executes campaign with personalization' },
      { name: 'mcp__sam__get_campaign_status', description: 'Sam monitors campaign progress' }
    ]

    samAITools.forEach(tool => {
      allTools.push({ 
        name: tool.name,
        description: tool.description,
        inputSchema: { type: 'object', properties: {} },
        server: 'sam-ai'
      })
    })

    return { tools: allTools }
  }

  async callTool(request: MCPCallToolRequest & { server?: string }): Promise<MCPCallToolResult> {
    if (!this.isInitialized) {
      return {
        content: [{
          type: 'text',
          text: 'MCP Registry not initialized'
        }],
        isError: true
      }
    }

    // Auto-detect server based on tool name if not specified
    let server = request.server || this.detectServerFromTool(request.params.name)
    let effectiveRequest: MCPCallToolRequest & { server?: string } = request

    // Fallback mapping when a preferred server is unavailable
    if (server === 'google-search' && !this.googleSearchServer && this.webSearchServer) {
      const tool = request.params.name
      // Use same tool name if supported by WebSearch
      if (['boolean_linkedin_search'].includes(tool)) {
        server = 'websearch'
      }
      // Map comparable tools
      if (tool === 'company_research_search') {
        server = 'websearch'
        effectiveRequest = { ...effectiveRequest, params: { name: 'company_intelligence_search', arguments: request.params.arguments } }
      }
      if (tool === 'icp_prospect_discovery') {
        server = 'websearch'
        const args = effectiveRequest.params.arguments || {}
        effectiveRequest = { ...effectiveRequest, params: { name: 'icp_research_search', arguments: {
          industry: Array.isArray(args.industries) && args.industries.length ? args.industries[0] : (args.industry || 'Technology'),
          jobTitles: args.jobTitles || [],
          companySize: args.companySize || 'any',
          geography: args.location || 'United States',
          maxResults: args.maxResults || 15
        } } }
      }
    }

    switch (server) {
      case 'bright-data':
        if (!this.brightDataServer) {
          return {
            content: [{
              type: 'text',
              text: 'Bright Data MCP server not available'
            }],
            isError: true
          }
        }
        return await this.brightDataServer.callTool(effectiveRequest)

      case 'apify':
        if (!this.apifyServer) {
          return {
            content: [{
              type: 'text',
              text: 'Apify MCP server not available'
            }],
            isError: true
          }
        }
        return await this.apifyServer.callTool(effectiveRequest)

      case 'google-search':
        if (!this.googleSearchServer) {
          return {
            content: [{
              type: 'text',
              text: 'Google Search MCP server not available'
            }],
            isError: true
          }
        }
        return await this.googleSearchServer.callTool(effectiveRequest)

      case 'websearch':
        if (!this.webSearchServer) {
          return {
            content: [{
              type: 'text',
              text: 'WebSearch MCP server not available'
            }],
            isError: true
          }
        }
        return await this.webSearchServer.callTool(effectiveRequest)

      case 'unipile':
        if (!this.unipileServer) {
          return {
            content: [{ type: 'text', text: 'Unipile MCP server not available' }],
            isError: true
          }
        }
        return await this.unipileServer.callTool(effectiveRequest)

      case 'n8n':
        if (!this.n8nServer) {
          return {
            content: [{ type: 'text', text: 'N8N MCP server not available' }],
            isError: true
          }
        }
        return await this.n8nServer.callTool(effectiveRequest)

      case 'reachinbox':
        if (!this.reachInboxServer) {
          return {
            content: [{ type: 'text', text: 'ReachInbox MCP server not available' }],
            isError: true
          }
        }
        return await this.reachInboxServer.callTool(effectiveRequest)

      case 'reply-agent':
        if (!this.replyAgentServer) {
          return {
            content: [{ type: 'text', text: 'Reply Agent MCP server not available' }],
            isError: true
          }
        }
        return await this.replyAgentServer.callTool(effectiveRequest)

      case 'sam-ai':
        return await this.callSamAITool(effectiveRequest)

      default:
        return {
          content: [{
            type: 'text',
            text: `Unknown server: ${server}. Available servers: ${this.getAvailableServers().join(', ')}`
          }],
          isError: true
        }
    }
  }

  private detectServerFromTool(toolName: string): string {
    // Bright Data tools
    const brightDataTools = [
      'research_prospect',
      'analyze_company', 
      'generate_strategic_insights',
      'check_system_health'
    ]

    // Apify tools (updated)
    const apifyTools = [
      'research_linkedin_prospect',
      'search_linkedin_prospects',
      'check_apify_status'
    ]

    // Google Search tools
    const googleSearchTools = [
      'boolean_linkedin_search',
      'company_research_search', 
      'icp_prospect_discovery',
      'verify_search_quota'
    ]

    // WebSearch tools (mock/fallback)
    const webSearchTools = [
      'validate_linkedin_url',
      'boolean_linkedin_search',
      'company_intelligence_search',
      'icp_research_search',
      'validate_search_syntax'
    ]

    // Unipile tools prefix
    const isUnipile = toolName.startsWith('unipile_')

    // N8N tools prefix
    const isN8N = toolName.startsWith('n8n_')

    // Reply Agent tools prefix
    const isReply = toolName.startsWith('reply_agent_')

    // ReachInbox tools prefix
    const isReachInbox = toolName.startsWith('reachinbox_')

    // Sam AI tools (template, GPT-5, campaign orchestration)
    const samTemplateTools = [
      'mcp__template__create',
      'mcp__template__get_by_criteria', 
      'mcp__template__get_by_id',
      'mcp__template__update',
      'mcp__template__delete',
      'mcp__template__track_performance',
      'mcp__template__get_performance',
      'mcp__template__clone',
      'mcp__template__get_top_performers'
    ]

    const samGPT5Tools = [
      'mcp__gpt5__optimize_template',
      'mcp__gpt5__analyze_performance',
      'mcp__gpt5__generate_variations',
      'mcp__gpt5__personalize_for_prospect'
    ]

    const samCampaignTools = [
      'mcp__sam__create_campaign',
      'mcp__sam__execute_campaign',
      'mcp__sam__get_campaign_status'
    ]

    if (brightDataTools.includes(toolName)) {
      return 'bright-data'
    }
    
    if (apifyTools.includes(toolName)) {
      return 'apify'
    }

    if (googleSearchTools.includes(toolName)) {
      return this.googleSearchServer ? 'google-search' : (this.webSearchServer ? 'websearch' : 'unknown')
    }

    if (webSearchTools.includes(toolName)) {
      return 'websearch'
    }

    if (isUnipile) {
      return 'unipile'
    }

    if (isN8N) {
      return 'n8n'
    }

    if (isReply) {
      return 'reply-agent'
    }

    if (isReachInbox) {
      return 'reachinbox'
    }

    if (samTemplateTools.includes(toolName) || samGPT5Tools.includes(toolName) || samCampaignTools.includes(toolName)) {
      return 'sam-ai'
    }

    return 'unknown'
  }

  private async callSamAITool(request: MCPCallToolRequest): Promise<MCPCallToolResult> {
    const toolName = request.params.name
    const args = request.params.arguments || {}

    try {
      // Template MCP tools
      if (toolName === 'mcp__template__create') {
        const result = await TemplateMCP.mcp__template__create(args)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success
        }
      }

      if (toolName === 'mcp__template__get_by_criteria') {
        const result = await TemplateMCP.mcp__template__get_by_criteria(args)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success
        }
      }

      if (toolName === 'mcp__template__get_by_id') {
        const result = await TemplateMCP.mcp__template__get_by_id(args)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success
        }
      }

      if (toolName === 'mcp__template__update') {
        const result = await TemplateMCP.mcp__template__update(args)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success
        }
      }

      if (toolName === 'mcp__template__delete') {
        const result = await TemplateMCP.mcp__template__delete(args)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success
        }
      }

      if (toolName === 'mcp__template__track_performance') {
        const result = await TemplateMCP.mcp__template__track_performance(args)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success
        }
      }

      if (toolName === 'mcp__template__get_performance') {
        const result = await TemplateMCP.mcp__template__get_performance(args)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success
        }
      }

      if (toolName === 'mcp__template__clone') {
        const result = await TemplateMCP.mcp__template__clone(args)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success
        }
      }

      if (toolName === 'mcp__template__get_top_performers') {
        const result = await TemplateMCP.mcp__template__get_top_performers(args)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success
        }
      }

      // GPT-5 MCP tools
      if (toolName === 'mcp__gpt5__optimize_template') {
        const result = await GPT5MCP.mcp__gpt5__optimize_template(args)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success
        }
      }

      if (toolName === 'mcp__gpt5__analyze_performance') {
        const result = await GPT5MCP.mcp__gpt5__analyze_performance(args)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success
        }
      }

      if (toolName === 'mcp__gpt5__generate_variations') {
        const result = await GPT5MCP.mcp__gpt5__generate_variations(args)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success
        }
      }

      if (toolName === 'mcp__gpt5__personalize_for_prospect') {
        const result = await GPT5MCP.mcp__gpt5__personalize_for_prospect(args)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success
        }
      }

      // Campaign Orchestration MCP tools
      if (toolName === 'mcp__sam__create_campaign') {
        const result = await CampaignOrchestrationMCP.mcp__sam__create_campaign(args)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success
        }
      }

      if (toolName === 'mcp__sam__execute_campaign') {
        const result = await CampaignOrchestrationMCP.mcp__sam__execute_campaign(args)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success
        }
      }

      if (toolName === 'mcp__sam__get_campaign_status') {
        const result = await CampaignOrchestrationMCP.mcp__sam__get_campaign_status(args)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success
        }
      }

      return {
        content: [{ type: 'text', text: `Unknown Sam AI tool: ${toolName}` }],
        isError: true
      }

    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `Sam AI tool error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        }],
        isError: true
      }
    }
  }

  private getAvailableServers(): string[] {
    const servers: string[] = []
    
    if (this.brightDataServer) {
      servers.push('bright-data')
    }
    
    if (this.apifyServer) {
      servers.push('apify')
    }

    if (this.googleSearchServer) {
      servers.push('google-search')
    }
    if (this.webSearchServer) {
      servers.push('websearch')
    }
    if (this.unipileServer) {
      servers.push('unipile')
    }
    if (this.n8nServer) {
      servers.push('n8n')
    }
    if (this.reachInboxServer) {
      servers.push('reachinbox')
    }
    if (this.replyAgentServer) {
      servers.push('reply-agent')
    }

    // Sam AI tools are always available (built-in)
    servers.push('sam-ai')
    
    return servers
  }

  async getServerStatus(): Promise<{
    brightData: { available: boolean; tools: number }
    apify: { available: boolean; tools: number }
    googleSearch: { available: boolean; tools: number }
    webSearch: { available: boolean; tools: number }
    unipile: { available: boolean; tools: number }
    n8n: { available: boolean; tools: number }
    reachInbox: { available: boolean; tools: number }
    replyAgent: { available: boolean; tools: number }
    samAI: { available: boolean; tools: number }
    total: { servers: number; tools: number }
  }> {
    const brightDataTools = this.brightDataServer ? (await this.brightDataServer.listTools()).tools.length : 0
    const apifyTools = this.apifyServer ? (await this.apifyServer.listTools()).tools.length : 0
    const googleSearchTools = this.googleSearchServer ? (await this.googleSearchServer.listTools()).tools.length : 0
    const webSearchTools = this.webSearchServer ? (await this.webSearchServer.listTools()).tools.length : 0
    const unipileTools = this.unipileServer ? (await this.unipileServer.listTools()).tools.length : 0
    const n8nTools = this.n8nServer ? (await this.n8nServer.listTools()).tools.length : 0
    const reachInboxTools = this.reachInboxServer ? (await this.reachInboxServer.listTools()).tools.length : 0
    const replyTools = this.replyAgentServer ? (await this.replyAgentServer.listTools()).tools.length : 0
    const samAITools = 16 // 9 template + 4 mistral + 3 campaign tools

    return {
      brightData: { available: !!this.brightDataServer, tools: brightDataTools },
      apify: { available: !!this.apifyServer, tools: apifyTools },
      googleSearch: { available: !!this.googleSearchServer, tools: googleSearchTools },
      webSearch: { available: !!this.webSearchServer, tools: webSearchTools },
      unipile: { available: !!this.unipileServer, tools: unipileTools },
      n8n: { available: !!this.n8nServer, tools: n8nTools },
      reachInbox: { available: !!this.reachInboxServer, tools: reachInboxTools },
      replyAgent: { available: !!this.replyAgentServer, tools: replyTools },
      samAI: { available: true, tools: samAITools },
      total: {
        servers: this.getAvailableServers().length,
        tools: brightDataTools + apifyTools + googleSearchTools + webSearchTools + unipileTools + n8nTools + reachInboxTools + replyTools + samAITools
      }
    }
  }

  // Intelligence orchestration methods
  async researchProspectWithBestSource(request: {
    profileUrls?: string[]
    searchCriteria?: Record<string, unknown>
    maxResults?: number
    budget?: number
    urgency?: 'low' | 'medium' | 'high'
  }): Promise<MCPCallToolResult> {
    // Smart routing based on requirements
    const volume = request.maxResults || 10
    const budget = request.budget || 100

    try {
      // If explicit profile URL(s) provided, prefer Apify lightweight research
      if (request.profileUrls?.length) {
        if (this.apifyServer) {
          return await this.apifyServer.callTool({
            method: 'tools/call',
            params: {
              name: 'research_linkedin_prospect',
              arguments: {
                searchUrl: request.profileUrls[0],
                maxResults: 1,
                extractEmails: true,
                extractPhones: false
              }
            }
          })
        }

        if (this.brightDataServer) {
          return await this.brightDataServer.callTool({
            method: 'tools/call',
            params: {
              name: 'research_prospect',
              arguments: {
                profileUrls: request.profileUrls,
                depth: request.urgency === 'high' ? 'comprehensive' : 'standard',
                maxResults: 1
              }
            }
          })
        }
      }

      // Criteria-based search: choose cost-effective option based on volume/budget
      if (request.searchCriteria) {
        // For small volumes or low budget, use Apify mock search
        if (this.apifyServer && (volume <= 50 || budget < 50)) {
          return await this.apifyServer.callTool({
            method: 'tools/call',
            params: {
              name: 'search_linkedin_prospects',
              arguments: {
                searchCriteria: request.searchCriteria,
                maxResults: volume
              }
            }
          })
        }

        // If Google Search available, use ICP discovery
        if (this.googleSearchServer) {
          return await this.googleSearchServer.callTool({
            method: 'tools/call',
            params: {
              name: 'icp_prospect_discovery',
              arguments: {
                jobTitles: request.searchCriteria.jobTitles || [request.searchCriteria.jobTitle].filter(Boolean),
                industries: request.searchCriteria.industries || [request.searchCriteria.industry].filter(Boolean),
                companySize: request.searchCriteria.companySize || 'any',
                location: request.searchCriteria.location || 'United States',
                maxResults: volume
              }
            }
          })
        }

        // Fallback to WebSearch mock ICP
        if (this.webSearchServer) {
          return await this.webSearchServer.callTool({
            method: 'tools/call',
            params: {
              name: 'icp_research_search',
              arguments: {
                industry: request.searchCriteria.industry || (request.searchCriteria.industries?.[0] || 'Technology'),
                jobTitles: request.searchCriteria.jobTitles || [request.searchCriteria.jobTitle || 'Manager'],
                companySize: request.searchCriteria.companySize || 'any',
                geography: request.searchCriteria.location || 'United States',
                maxResults: volume
              }
            }
          })
        }
      }

      return {
        content: [{ type: 'text', text: 'No suitable MCP servers available for prospect research' }],
        isError: true
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Prospect research routing error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true
      }
    }
  }

  async generateIntelligenceReport(prospects: unknown[], _methodology: 'challenger' | 'spin' | 'meddic' = 'meddic'): Promise<MCPCallToolResult> {
    void _methodology
    // if (!this.brightDataServer) {
    //   return {
    //     content: [{
    //       type: 'text',
    //       text: 'Bright Data MCP required for strategic intelligence generation'
    //     }],
    //     isError: true
    //   }
    // }

    // return await this.brightDataServer.callTool({
    //   method: 'tools/call',
    //   params: {
    //     name: 'generate_strategic_insights',
    //     arguments: {
    //       prospects,
    //       methodology,
    //       conversationContext: 'SAM AI Intelligence Report'
    //     }
    //   }
    // })
    
    return {
      content: [{
        type: 'text',
        text: 'Intelligence report generation not available - Bright Data MCP temporarily disabled'
      }],
      isError: true
    }
  }
}

// Export singleton instance
export const mcpRegistry = new MCPRegistry()

// Configuration helpers
export function createMCPConfig(): MCPServerConfig {
  return {
    brightData: {
      username: process.env.BRIGHT_DATA_USERNAME || 'mock-username',
      password: process.env.BRIGHT_DATA_PASSWORD || 'mock-password',
      endpoint: process.env.BRIGHT_DATA_ENDPOINT || 'brd.superproxy.io',
      port: parseInt(process.env.BRIGHT_DATA_PORT || '22225'),
      organizationId: process.env.ORGANIZATION_ID || 'default-org',
      userId: process.env.USER_ID || 'default-user'
    },
    
    apify: {
      apiToken: process.env.APIFY_API_TOKEN || 'mock-api-token',
      organizationId: process.env.ORGANIZATION_ID || 'default-org', 
      userId: process.env.USER_ID || 'default-user'
    },

    googleSearch: process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID ? {
      googleApiKey: process.env.GOOGLE_API_KEY!,
      googleCseId: process.env.GOOGLE_CSE_ID!,
      serpApiKey: process.env.SERP_API_KEY,
      organizationId: process.env.ORGANIZATION_ID || 'default-org',
      userId: process.env.USER_ID || 'default-user',
      maxResults: 20,
      searchTimeout: 30000
    } : undefined,

    // Always provide WebSearch mock as a safe fallback when Google keys are missing
    webSearch: {
      organizationId: process.env.ORGANIZATION_ID || 'default-org',
      userId: process.env.USER_ID || 'default-user',
      maxResults: 20,
      searchTimeout: 30000
    },

    unipile: process.env.UNIPILE_DSN && process.env.UNIPILE_API_KEY ? {
      dsn: process.env.UNIPILE_DSN,
      apiKey: process.env.UNIPILE_API_KEY,
      clientId: process.env.UNIPILE_CLIENT_ID,
      clientSecret: process.env.UNIPILE_CLIENT_SECRET,
      webhookSecret: process.env.UNIPILE_WEBHOOK_SECRET,
      organizationId: process.env.ORGANIZATION_ID || 'default-org',
      userId: process.env.USER_ID || 'default-user'
    } : undefined,

    n8n: process.env.N8N_API_BASE_URL && process.env.N8N_API_KEY ? {
      baseUrl: process.env.N8N_API_BASE_URL,
      apiKey: process.env.N8N_API_KEY,
      organizationId: process.env.ORGANIZATION_ID || 'default-org',
      userId: process.env.USER_ID || 'default-user'
    } : undefined,

    reachInbox: process.env.REACHINBOX_API_KEY ? {
      apiKey: process.env.REACHINBOX_API_KEY,
      baseUrl: process.env.REACHINBOX_API_URL,
      organizationId: process.env.ORGANIZATION_ID || 'default-org',
      userId: process.env.USER_ID || 'default-user'
    } : undefined
  }
}
