/**
 * MCP Server Registry for SAM AI Platform
 * 
 * Centralized management of all MCP servers and tools
 */

import { BrightDataMCPServer } from './bright-data-mcp'
import { ApifyMCPServer } from './apify-mcp'
import { GoogleSearchMCPServer } from './google-search-mcp'
import { UnipileMCPServer } from './unipile-mcp'
import { N8NMCPServer } from './n8n-mcp'
import { ReplyAgentMCPServer } from './reply-agent-mcp'
import { 
  MCPTool, 
  MCPCallToolRequest, 
  MCPCallToolResult,
  BrightDataMCPConfig,
  ApifyMCPConfig,
  GoogleSearchMCPConfig,
  UnipileMCPConfig,
  N8NMCPConfig,
  ApolloMCPConfig,
  ReplyAgentMCPConfig
} from './types'

export interface MCPServerConfig {
  brightData?: BrightDataMCPConfig
  apify?: ApifyMCPConfig
  googleSearch?: GoogleSearchMCPConfig
  unipile?: UnipileMCPConfig
  n8n?: N8NMCPConfig
  apollo?: ApolloMCPConfig
  replyAgent?: ReplyAgentMCPConfig
}

export class MCPRegistry {
  private brightDataServer?: BrightDataMCPServer
  private apifyServer?: ApifyMCPServer
  private googleSearchServer?: GoogleSearchMCPServer
  private unipileServer?: UnipileMCPServer
  private n8nServer?: N8NMCPServer
  private replyAgentServer?: ReplyAgentMCPServer
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

      // Initialize Reply Agent MCP Server
      if (config.replyAgent) {
        this.replyAgentServer = new ReplyAgentMCPServer(config.replyAgent)
        initializedServers.push('Reply Agent MCP')
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
    const server = request.server || this.detectServerFromTool(request.params.name)

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
        return await this.brightDataServer.callTool(request)

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
        return await this.apifyServer.callTool(request)

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
        return await this.googleSearchServer.callTool(request)

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

    // Apify tools
    const apifyTools = [
      'extract_linkedin_profiles',
      'check_extraction_status',
      'get_extraction_results',
      'estimate_extraction_cost',
      'validate_linkedin_url',
      'list_available_actors'
    ]

    // Google Search tools
    const googleSearchTools = [
      'boolean_linkedin_search',
      'company_research_search', 
      'icp_prospect_discovery',
      'verify_search_quota'
    ]

    if (brightDataTools.includes(toolName)) {
      return 'bright-data'
    }
    
    if (apifyTools.includes(toolName)) {
      return 'apify'
    }

    if (googleSearchTools.includes(toolName)) {
      return 'google-search'
    }

    return 'unknown'
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
    
    return servers
  }

  async getServerStatus(): Promise<{
    brightData: { available: boolean; tools: number }
    apify: { available: boolean; tools: number }
    googleSearch: { available: boolean; tools: number }
    total: { servers: number; tools: number }
  }> {
    const brightDataTools = this.brightDataServer ? (await this.brightDataServer.listTools()).tools.length : 0
    const apifyTools = this.apifyServer ? (await this.apifyServer.listTools()).tools.length : 0
    const googleSearchTools = this.googleSearchServer ? (await this.googleSearchServer.listTools()).tools.length : 0

    return {
      brightData: {
        available: !!this.brightDataServer,
        tools: brightDataTools
      },
      apify: {
        available: !!this.apifyServer,
        tools: apifyTools
      },
      googleSearch: {
        available: !!this.googleSearchServer,
        tools: googleSearchTools
      },
      total: {
        servers: this.getAvailableServers().length,
        tools: brightDataTools + apifyTools + googleSearchTools
      }
    }
  }

  // Intelligence orchestration methods
  async researchProspectWithBestSource(request: {
    profileUrls?: string[]
    searchCriteria?: any
    maxResults?: number
    budget?: number
    urgency?: 'low' | 'medium' | 'high'
  }): Promise<MCPCallToolResult> {
    // Smart routing based on requirements
    const volume = request.maxResults || 10
    const budget = request.budget || 100
    
    // // Use Apify for cost-effective smaller volumes
    // if (volume <= 350 && budget < 50) {
    //   if (this.apifyServer && request.profileUrls?.[0]) {
    //     return await this.apifyServer.callTool({
    //       method: 'tools/call',
    //       params: {
    //         name: 'extract_linkedin_profiles',
    //         arguments: {
    //           searchUrl: request.profileUrls[0],
    //           maxResults: volume,
    //           extractEmails: true,
    //           waitForResults: true
    //         }
    //       }
    //     })
    //   }
    // }

    // // Use Bright Data for enterprise volumes or complex research
    // if (this.brightDataServer) {
    //   return await this.brightDataServer.callTool({
    //     method: 'tools/call',
    //     params: {
    //       name: 'research_prospect',
    //       arguments: {
    //         profileUrls: request.profileUrls,
    //         searchCriteria: request.searchCriteria,
    //         depth: request.urgency === 'high' ? 'comprehensive' : 'standard',
    //         maxResults: volume
    //       }
    //     }
    //   })
    // }

    return {
      content: [{
        type: 'text',
        text: 'No suitable MCP servers available for prospect research'
      }],
      isError: true
    }
  }

  async generateIntelligenceReport(prospects: any[], methodology: 'challenger' | 'spin' | 'meddic' = 'meddic'): Promise<MCPCallToolResult> {
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
    } : undefined
  }
}