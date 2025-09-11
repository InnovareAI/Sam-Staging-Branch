/**
 * Apify MCP Server for SAM AI Platform
 * 
 * Provides cost-effective LinkedIn data extraction through Model Context Protocol (MCP)
 */

import { 
  MCPTool, 
  MCPCallToolRequest, 
  MCPCallToolResult, 
  ApifyMCPConfig,
  ApifyProspectRequest
} from './types'

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
        name: 'extract_linkedin_profiles',
        description: 'Extract LinkedIn profiles using Apify actors with smart cost optimization',
        inputSchema: {
          type: 'object',
          properties: {
            searchUrl: {
              type: 'string',
              description: 'LinkedIn search URL or profile URL'
            },
            maxResults: {
              type: 'number',
              maximum: 50000,
              description: 'Maximum number of profiles to extract'
            },
            extractEmails: {
              type: 'boolean',
              description: 'Attempt to extract email addresses'
            },
            extractPhones: {
              type: 'boolean',
              description: 'Attempt to extract phone numbers'
            },
            waitForResults: {
              type: 'boolean',
              description: 'Wait for extraction to complete (synchronous mode)'
            }
          },
          required: ['searchUrl']
        }
      },
      {
        name: 'check_extraction_status',
        description: 'Check the status of a running Apify extraction',
        inputSchema: {
          type: 'object',
          properties: {
            runId: {
              type: 'string',
              description: 'Apify run ID to check'
            }
          },
          required: ['runId']
        }
      },
      {
        name: 'get_extraction_results',
        description: 'Get results from a completed Apify extraction',
        inputSchema: {
          type: 'object',
          properties: {
            runId: {
              type: 'string',
              description: 'Apify run ID to get results for'
            }
          },
          required: ['runId']
        }
      },
      {
        name: 'estimate_extraction_cost',
        description: 'Estimate cost and time for LinkedIn extraction',
        inputSchema: {
          type: 'object',
          properties: {
            searchUrl: {
              type: 'string',
              description: 'LinkedIn search URL'
            },
            maxResults: {
              type: 'number',
              description: 'Number of profiles to extract'
            }
          },
          required: ['searchUrl', 'maxResults']
        }
      },
      {
        name: 'validate_linkedin_url',
        description: 'Validate and classify LinkedIn URL',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'LinkedIn URL to validate'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'list_available_actors',
        description: 'List available Apify actors for LinkedIn extraction',
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
        case 'extract_linkedin_profiles':
          return await this.extractLinkedInProfiles(request.params.arguments as ApifyProspectRequest)
        
        case 'check_extraction_status':
          return await this.checkExtractionStatus(request.params.arguments as { runId: string })
        
        case 'get_extraction_results':
          return await this.getExtractionResults(request.params.arguments as { runId: string })
        
        case 'estimate_extraction_cost':
          return await this.estimateExtractionCost(request.params.arguments as { searchUrl: string, maxResults: number })
        
        case 'validate_linkedin_url':
          return await this.validateLinkedInUrl(request.params.arguments as { url: string })
        
        case 'list_available_actors':
          return await this.listAvailableActors()
        
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
          text: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async extractLinkedInProfiles(request: ApifyProspectRequest): Promise<MCPCallToolResult> {
    try {
      // Import Apify service dynamically
      const { ApifyMcpService } = await import('../services/apifyMcp')
      
      const apifyService = new ApifyMcpService()
      
      // Validate URL first
      const validation = apifyService.validateLinkedInUrl(request.searchUrl)
      if (!validation.isValid) {
        return {
          content: [{
            type: 'text',
            text: `Invalid LinkedIn URL: ${validation.errors.join(', ')}`
          }],
          isError: true
        }
      }

      // Check daily quota
      const quotaCheck = apifyService.checkDailyQuota(request.maxResults || 100)
      if (!quotaCheck.canProceed) {
        return {
          content: [{
            type: 'text',
            text: `Daily quota exceeded. Recommended: ${quotaCheck.recommendedActor}`
          }],
          isError: true
        }
      }

      // Execute extraction
      const result = await apifyService.extractLinkedInProfiles(request.searchUrl, {
        maxResults: request.maxResults,
        extractEmails: request.extractEmails,
        extractPhones: request.extractPhones,
        waitForResults: request.waitForResults
      })

      if (!result.success) {
        return {
          content: [{
            type: 'text',
            text: `Extraction failed: ${result.errors.join(', ')}`
          }],
          isError: true
        }
      }

      // Convert to SAM AI format
      const prospects = apifyService.convertToProspects(result.data)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            runId: result.runId,
            extractedCount: result.data.length,
            prospects: prospects.slice(0, 10), // Sample first 10 for response
            totalProspects: prospects.length,
            stats: result.stats,
            quotaInfo: quotaCheck,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      }

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `LinkedIn extraction error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async checkExtractionStatus(request: { runId: string }): Promise<MCPCallToolResult> {
    try {
      const { ApifyMcpService } = await import('../services/apifyMcp')
      const apifyService = new ApifyMcpService()
      
      const status = await apifyService.getRunStatus(request.runId)
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            runId: request.runId,
            status: status.status,
            stats: status.stats,
            error: status.error,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Status check error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async getExtractionResults(request: { runId: string }): Promise<MCPCallToolResult> {
    try {
      const { ApifyMcpService } = await import('../services/apifyMcp')
      const apifyService = new ApifyMcpService()
      
      const results = await apifyService.getRunResults(request.runId)
      
      if (!results.success) {
        return {
          content: [{
            type: 'text',
            text: `Failed to get results: ${results.error}`
          }],
          isError: true
        }
      }

      const prospects = apifyService.convertToProspects(results.data)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            runId: request.runId,
            success: true,
            extractedCount: results.data.length,
            prospects: prospects.slice(0, 20), // First 20 for response
            totalProspects: prospects.length,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Results retrieval error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async estimateExtractionCost(request: { searchUrl: string, maxResults: number }): Promise<MCPCallToolResult> {
    try {
      const { ApifyMcpService } = await import('../services/apifyMcp')
      const apifyService = new ApifyMcpService()
      
      const estimate = apifyService.estimateExtraction(request.searchUrl, request.maxResults)
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            searchUrl: request.searchUrl,
            maxResults: request.maxResults,
            estimatedCost: estimate.estimatedCost,
            estimatedTimeMinutes: estimate.estimatedTimeMinutes,
            recommendedActor: estimate.recommendedActor,
            dailyCapacity: estimate.dailyCapacity,
            monthlyBudget: estimate.monthlyBudget,
            resultLimit: estimate.resultLimit,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Cost estimation error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async validateLinkedInUrl(request: { url: string }): Promise<MCPCallToolResult> {
    try {
      const { ApifyMcpService } = await import('../services/apifyMcp')
      const apifyService = new ApifyMcpService()
      
      const validation = apifyService.validateLinkedInUrl(request.url)
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            url: request.url,
            isValid: validation.isValid,
            urlType: validation.urlType,
            errors: validation.errors,
            recommendations: this.getUrlRecommendations(validation.urlType),
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `URL validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async listAvailableActors(): Promise<MCPCallToolResult> {
    try {
      const { ApifyMcpService } = await import('../services/apifyMcp')
      const apifyService = new ApifyMcpService()
      
      const actors = await apifyService.getAvailableActors()
      
      if (actors.error) {
        return {
          content: [{
            type: 'text',
            text: `Failed to list actors: ${actors.error}`
          }],
          isError: true
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            availableActors: actors.actors,
            recommendations: {
              enterprise: 'Apollo Database Scraper - $1.20/1000 contacts, unlimited daily capacity',
              standard: 'LinkedIn Profile Scraper - 350 profiles/day limit',
              fallback: 'Community actors available for backup'
            },
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Actor listing error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private getUrlRecommendations(urlType: string): string[] {
    switch (urlType) {
      case 'search':
        return [
          'Use search URLs for bulk prospect discovery',
          'Consider filtering by job title and location',
          'Monitor daily limits for LinkedIn searches'
        ]
      case 'profile':
        return [
          'Profile URLs are good for detailed individual research',
          'Combine multiple profiles for batch processing',
          'Use for validation of search results'
        ]
      case 'company':
        return [
          'Company URLs provide organizational intelligence',
          'Good for account-based marketing research',
          'Extract employee lists for prospect identification'
        ]
      default:
        return [
          'Ensure URL is from linkedin.com',
          'Use search URLs for prospect discovery',
          'Use profile URLs for individual research'
        ]
    }
  }
}