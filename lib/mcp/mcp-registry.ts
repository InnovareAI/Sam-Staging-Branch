/**
 * MCP Server Registry for SAM AI Platform
 * 
 * Centralized management of all MCP servers and tools
 */

import { BrightDataMCPServer } from './bright-data-mcp'
import { ApifyMCPServer } from './apify-mcp'
import { 
  MCPTool, 
  MCPCallToolRequest, 
  MCPCallToolResult,
  BrightDataMCPConfig,
  ApifyMCPConfig
} from './types'

export interface MCPServerConfig {
  brightData?: BrightDataMCPConfig
  apify?: ApifyMCPConfig
}

export class MCPRegistry {
  private brightDataServer?: BrightDataMCPServer
  private apifyServer?: ApifyMCPServer
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

    if (brightDataTools.includes(toolName)) {
      return 'bright-data'
    }
    
    if (apifyTools.includes(toolName)) {
      return 'apify'
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
    
    return servers
  }

  async getServerStatus(): Promise<{
    brightData: { available: boolean; tools: number }
    apify: { available: boolean; tools: number }
    total: { servers: number; tools: number }
  }> {
    const brightDataTools = this.brightDataServer ? (await this.brightDataServer.listTools()).tools.length : 0
    const apifyTools = this.apifyServer ? (await this.apifyServer.listTools()).tools.length : 0

    return {
      brightData: {
        available: !!this.brightDataServer,
        tools: brightDataTools
      },
      apify: {
        available: !!this.apifyServer,
        tools: apifyTools
      },
      total: {
        servers: this.getAvailableServers().length,
        tools: brightDataTools + apifyTools
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
    
    // Use Apify for cost-effective smaller volumes
    if (volume <= 350 && budget < 50) {
      if (this.apifyServer && request.profileUrls?.[0]) {
        return await this.apifyServer.callTool({
          method: 'tools/call',
          params: {
            name: 'extract_linkedin_profiles',
            arguments: {
              searchUrl: request.profileUrls[0],
              maxResults: volume,
              extractEmails: true,
              waitForResults: true
            }
          }
        })
      }
    }

    // Use Bright Data for enterprise volumes or complex research
    if (this.brightDataServer) {
      return await this.brightDataServer.callTool({
        method: 'tools/call',
        params: {
          name: 'research_prospect',
          arguments: {
            profileUrls: request.profileUrls,
            searchCriteria: request.searchCriteria,
            depth: request.urgency === 'high' ? 'comprehensive' : 'standard',
            maxResults: volume
          }
        }
      })
    }

    return {
      content: [{
        type: 'text',
        text: 'No suitable MCP servers available for prospect research'
      }],
      isError: true
    }
  }

  async generateIntelligenceReport(prospects: any[], methodology: 'challenger' | 'spin' | 'meddic' = 'meddic'): Promise<MCPCallToolResult> {
    if (!this.brightDataServer) {
      return {
        content: [{
          type: 'text',
          text: 'Bright Data MCP required for strategic intelligence generation'
        }],
        isError: true
      }
    }

    return await this.brightDataServer.callTool({
      method: 'tools/call',
      params: {
        name: 'generate_strategic_insights',
        arguments: {
          prospects,
          methodology,
          conversationContext: 'SAM AI Intelligence Report'
        }
      }
    })
  }
}

// Export singleton instance
export const mcpRegistry = new MCPRegistry()

// Configuration helpers
export function createMCPConfig(): MCPServerConfig {
  return {
    brightData: process.env.BRIGHT_DATA_USERNAME ? {
      username: process.env.BRIGHT_DATA_USERNAME!,
      password: process.env.BRIGHT_DATA_PASSWORD!,
      endpoint: process.env.BRIGHT_DATA_ENDPOINT || 'brd.superproxy.io',
      port: parseInt(process.env.BRIGHT_DATA_PORT || '22225'),
      organizationId: process.env.ORGANIZATION_ID || 'default-org',
      userId: process.env.USER_ID || 'default-user'
    } : undefined,
    
    apify: process.env.APIFY_API_TOKEN ? {
      apiToken: process.env.APIFY_API_TOKEN!,
      organizationId: process.env.ORGANIZATION_ID || 'default-org', 
      userId: process.env.USER_ID || 'default-user'
    } : undefined
  }
}