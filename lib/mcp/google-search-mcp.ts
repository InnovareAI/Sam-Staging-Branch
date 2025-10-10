/**
 * Google Search MCP Server for SAM AI Platform
 * 
 * REAL IMPLEMENTATION - Production Ready
 * 
 * Provides Boolean search capabilities using Google Custom Search API
 * and SerpAPI for LinkedIn profile discovery and ICP building
 */

import { MCPTool, MCPCallToolRequest, MCPCallToolResult } from './types'

export interface GoogleSearchMCPConfig {
  // Google Custom Search API
  googleApiKey: string
  googleCseId: string
  
  // SerpAPI for advanced searches (optional)
  serpApiKey?: string
  
  organizationId: string
  userId: string
  maxResults?: number
  searchTimeout?: number
}

export interface SearchResult {
  title: string
  link: string
  snippet: string
  displayLink?: string
  formattedUrl?: string
  htmlTitle?: string
  htmlSnippet?: string
}

export interface LinkedInProfile {
  name: string
  title: string
  company: string
  location: string
  profileUrl: string
  snippet: string
  relevanceScore: number
}

export class GoogleSearchMCPServer {
  private config: GoogleSearchMCPConfig
  private googleBaseUrl = 'https://www.googleapis.com/customsearch/v1'
  private serpApiBaseUrl = 'https://serpapi.com/search'

  constructor(config: GoogleSearchMCPConfig) {
    this.config = {
      maxResults: 20,
      searchTimeout: 30000,
      ...config
    }

    if (!this.config.googleApiKey) {
      console.warn('Google API key not provided - Google Custom Search will not work')
    }
    
    if (!this.config.serpApiKey) {
      console.warn('SerpAPI key not provided - SerpAPI searches will not work')
    }
  }

  async listTools(): Promise<{ tools: MCPTool[] }> {
    return {
      tools: [
        {
          name: 'boolean_linkedin_search',
          description: 'Search for LinkedIn profiles using Boolean operators and site filtering',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Boolean search query (e.g., "VP Sales" OR "Director Sales" site:linkedin.com/in)'
              },
              location: {
                type: 'string',
                description: 'Geographic filter (e.g., "San Francisco", "United States")',
                default: 'United States'
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of profiles to return (1-100)',
                minimum: 1,
                maximum: 100,
                default: 20
              },
              useAdvanced: {
                type: 'boolean',
                description: 'Use SerpAPI for more detailed results (costs more)',
                default: false
              }
            },
            required: ['query']
          }
        },
        {
          name: 'company_research_search',
          description: 'Search for company information and intelligence',
          inputSchema: {
            type: 'object',
            properties: {
              companyName: {
                type: 'string',
                description: 'Company name to research'
              },
              searchType: {
                type: 'string',
                enum: ['overview', 'technology', 'news', 'funding', 'competitors', 'jobs'],
                description: 'Type of company information to find',
                default: 'overview'
              },
              maxResults: {
                type: 'number',
                description: 'Maximum results to return',
                minimum: 1,
                maximum: 50,
                default: 15
              }
            },
            required: ['companyName']
          }
        },
        {
          name: 'icp_prospect_discovery',
          description: 'Discover prospects matching Ideal Customer Profile criteria',
          inputSchema: {
            type: 'object',
            properties: {
              jobTitles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Target job titles (e.g., ["VP Sales", "Chief Revenue Officer"])'
              },
              industries: {
                type: 'array',
                items: { type: 'string' },
                description: 'Target industries (e.g., ["SaaS", "Technology", "Healthcare"])'
              },
              companySize: {
                type: 'string',
                enum: ['startup', 'small', 'medium', 'enterprise', 'any'],
                description: 'Target company size range',
                default: 'any'
              },
              location: {
                type: 'string',
                description: 'Geographic focus area',
                default: 'United States'
              },
              excludeCompanies: {
                type: 'array',
                items: { type: 'string' },
                description: 'Companies to exclude from results (competitors, existing customers)'
              },
              maxResults: {
                type: 'number',
                description: 'Maximum prospects to return',
                minimum: 5,
                maximum: 100,
                default: 30
              }
            },
            required: ['jobTitles', 'industries']
          }
        },
        {
          name: 'verify_search_quota',
          description: 'Check remaining search quota and costs',
          inputSchema: {
            type: 'object',
            properties: {
              service: {
                type: 'string',
                enum: ['google', 'serpapi', 'all'],
                description: 'Which service quota to check',
                default: 'all'
              }
            }
          }
        }
      ]
    }
  }

  async callTool(request: MCPCallToolRequest): Promise<MCPCallToolResult> {
    const { name, arguments: args } = request.params

    try {
      switch (name) {
        case 'boolean_linkedin_search':
          return await this.executeBooleanLinkedInSearch(args)
        
        case 'company_research_search':
          return await this.executeCompanyResearchSearch(args)
        
        case 'icp_prospect_discovery':
          return await this.executeICPProspectDiscovery(args)
        
        case 'verify_search_quota':
          return await this.verifySearchQuota(args)

        default:
          return {
            content: [{
              type: 'text',
              text: `Unknown tool: ${name}`
            }],
            isError: true
          }
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Google Search MCP error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async executeBooleanLinkedInSearch(args: any): Promise<MCPCallToolResult> {
    const { query, location = 'United States', maxResults = 20, useAdvanced = false } = args

    // Optimize query for LinkedIn searches
    const optimizedQuery = this.optimizeLinkedInQuery(query)
    
    try {
      let results: SearchResult[]
      
      if (useAdvanced && this.config.serpApiKey) {
        results = await this.searchWithSerpAPI(optimizedQuery, maxResults, location)
      } else if (this.config.googleApiKey && this.config.googleCseId) {
        results = await this.searchWithGoogleCSE(optimizedQuery, maxResults)
      } else {
        return {
          content: [{
            type: 'text',
            text: 'No search API keys configured. Please add GOOGLE_API_KEY + GOOGLE_CSE_ID or SERP_API_KEY'
          }],
          isError: true
        }
      }

      // Extract and score LinkedIn profiles
      const profiles = this.extractLinkedInProfiles(results)
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query: optimizedQuery,
            location,
            totalResults: profiles.length,
            searchService: useAdvanced ? 'SerpAPI' : 'Google CSE',
            profiles,
            cost: this.calculateSearchCost(useAdvanced, maxResults),
            timestamp: new Date().toISOString()
          }, null, 2)
        }],
        isError: false
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `LinkedIn search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async executeCompanyResearchSearch(args: any): Promise<MCPCallToolResult> {
    const { companyName, searchType = 'overview', maxResults = 15 } = args

    const searchQuery = this.buildCompanySearchQuery(companyName, searchType)
    
    try {
      const results = await this.searchWithGoogleCSE(searchQuery, maxResults)
      
      const companyIntelligence = {
        company: companyName,
        searchType,
        query: searchQuery,
        results: results.map(r => ({
          title: r.title,
          url: r.link,
          snippet: r.snippet,
          source: r.displayLink
        })),
        insights: this.extractCompanyInsights(results, searchType),
        lastUpdated: new Date().toISOString(),
        cost: this.calculateSearchCost(false, maxResults)
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(companyIntelligence, null, 2)
        }],
        isError: false
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Company research failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async executeICPProspectDiscovery(args: any): Promise<MCPCallToolResult> {
    const { 
      jobTitles, 
      industries, 
      companySize = 'any',
      location = 'United States',
      excludeCompanies = [],
      maxResults = 30
    } = args

    try {
      const prospectResults = []
      
      // Search for each job title + industry combination
      for (const title of jobTitles) {
        for (const industry of industries) {
          const query = this.buildICPSearchQuery(title, industry, companySize, location, excludeCompanies)
          const searchResults = await this.searchWithGoogleCSE(query, Math.ceil(maxResults / (jobTitles.length * industries.length)))
          
          const profiles = this.extractLinkedInProfiles(searchResults)
          prospectResults.push(...profiles)
        }
      }

      // Remove duplicates and rank by relevance
      const uniqueProspects = this.deduplicateAndRankProspects(prospectResults, { jobTitles, industries, companySize })
      const topProspects = uniqueProspects.slice(0, maxResults)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            icpCriteria: { jobTitles, industries, companySize, location },
            totalFound: uniqueProspects.length,
            returnedResults: topProspects.length,
            prospects: topProspects,
            searchCost: this.calculateSearchCost(false, jobTitles.length * industries.length * 10),
            timestamp: new Date().toISOString()
          }, null, 2)
        }],
        isError: false
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `ICP prospect discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async verifySearchQuota(args: any): Promise<MCPCallToolResult> {
    const { service = 'all' } = args
    
    const quotaInfo = {
      google: {
        available: !!this.config.googleApiKey && !!this.config.googleCseId,
        freeQuota: '100 searches/day',
        paidQuota: '10,000 searches/day',
        cost: '$5 per 1,000 searches after free tier'
      },
      serpapi: {
        available: !!this.config.serpApiKey,
        note: 'Check SerpAPI dashboard for current quota',
        cost: 'Varies by plan - see serpapi.com/pricing'
      },
      recommendation: this.config.googleApiKey ? 
        'Google CSE recommended for high-volume, cost-effective searches' :
        'SerpAPI recommended for detailed results and advanced features'
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(quotaInfo, null, 2)
      }],
      isError: false
    }
  }

  // Real API implementation methods

  private async searchWithGoogleCSE(query: string, maxResults: number): Promise<SearchResult[]> {
    if (!this.config.googleApiKey || !this.config.googleCseId) {
      throw new Error('Google Custom Search API key or CSE ID not configured')
    }

    const url = new URL(this.googleBaseUrl)
    url.searchParams.set('key', this.config.googleApiKey)
    url.searchParams.set('cx', this.config.googleCseId)
    url.searchParams.set('q', query)
    url.searchParams.set('num', Math.min(maxResults, 10).toString())

    const response = await fetch(url.toString())

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || 'Unknown error'

      // Enhanced error messages for common issues
      if (response.status === 429) {
        throw new Error(
          `Google CSE daily quota exceeded (100 free searches/day). ` +
          `To enable unlimited searches, upgrade at: https://console.cloud.google.com/apis/api/customsearch.googleapis.com ` +
          `Error: ${errorMessage}`
        )
      } else if (response.status === 403) {
        throw new Error(
          `Google CSE API access denied. Please verify API key has Custom Search API enabled. ` +
          `Configure at: https://console.cloud.google.com/apis/credentials ` +
          `Error: ${errorMessage}`
        )
      } else {
        throw new Error(`Google CSE API error: ${response.status} - ${errorMessage}`)
      }
    }

    const data = await response.json()
    return data.items || []
  }

  private async searchWithSerpAPI(query: string, maxResults: number, location: string): Promise<SearchResult[]> {
    if (!this.config.serpApiKey) {
      throw new Error('SerpAPI key not configured')
    }

    const url = new URL(this.serpApiBaseUrl)
    url.searchParams.set('api_key', this.config.serpApiKey)
    url.searchParams.set('q', query)
    url.searchParams.set('location', location)
    url.searchParams.set('num', Math.min(maxResults, 100).toString())
    url.searchParams.set('engine', 'google')

    const response = await fetch(url.toString())
    
    if (!response.ok) {
      throw new Error(`SerpAPI error: ${response.status}`)
    }

    const data = await response.json()
    return data.organic_results || []
  }

  // Helper methods for query optimization and data extraction

  private optimizeLinkedInQuery(query: string): string {
    // Add LinkedIn site filter if not present
    if (!query.includes('site:linkedin.com')) {
      query = `${query} site:linkedin.com/in/`
    }
    
    // Optimize Boolean operators
    query = query.replace(/\bAND\b/g, '+')
    query = query.replace(/\bNOT\b/g, '-')
    
    return query
  }

  private buildCompanySearchQuery(companyName: string, searchType: string): string {
    const baseQuery = `"${companyName}"`
    
    const searchModifiers: Record<string, string> = {
      overview: 'company profile about',
      technology: 'technology stack engineering blog',
      news: 'news funding acquisition partnership',
      funding: 'funding series investment valuation',
      competitors: 'competitors vs alternative',
      jobs: 'careers jobs hiring'
    }

    return `${baseQuery} ${searchModifiers[searchType] || searchModifiers.overview}`
  }

  private buildICPSearchQuery(
    jobTitle: string, 
    industry: string, 
    companySize: string,
    location: string,
    excludeCompanies: string[]
  ): string {
    let query = `"${jobTitle}" ${industry} ${location} site:linkedin.com/in/`
    
    if (companySize !== 'any') {
      const sizeFilters = {
        startup: '1-50 employees',
        small: '50-200 employees', 
        medium: '200-1000 employees',
        enterprise: '1000+ employees'
      }
      query += ` "${sizeFilters[companySize as keyof typeof sizeFilters]}"`
    }

    // Exclude competitors/existing customers
    if (excludeCompanies.length > 0) {
      const exclusions = excludeCompanies.map(company => `-"${company}"`).join(' ')
      query += ` ${exclusions}`
    }

    return query
  }

  private extractLinkedInProfiles(results: SearchResult[]): LinkedInProfile[] {
    return results
      .filter(r => r.link.includes('linkedin.com/in/'))
      .map(r => {
        // Parse LinkedIn profile information from title and snippet
        const titleParts = r.title.split(' - ')
        const name = titleParts[0] || 'Unknown'
        const titleCompany = titleParts[1] || ''
        
        // Extract title and company from title or snippet
        const [title, company] = this.parseLinkedInTitleCompany(titleCompany, r.snippet)
        
        return {
          name: name.trim(),
          title: title || 'Unknown Title',
          company: company || 'Unknown Company',
          location: this.extractLocation(r.snippet),
          profileUrl: r.link,
          snippet: r.snippet,
          relevanceScore: this.calculateRelevanceScore(r, { name, title, company })
        }
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  private parseLinkedInTitleCompany(titleCompany: string, snippet: string): [string, string] {
    // Try to extract title and company from LinkedIn profile text
    const atMatch = titleCompany.match(/^(.+?)\s+at\s+(.+)$/)
    if (atMatch) {
      return [atMatch[1].trim(), atMatch[2].trim()]
    }

    // Fallback to snippet parsing
    const snippetMatch = snippet.match(/(\w+[\w\s]*?)\s+at\s+([^.]+)/)
    if (snippetMatch) {
      return [snippetMatch[1].trim(), snippetMatch[2].trim()]
    }

    return [titleCompany, '']
  }

  private extractLocation(snippet: string): string {
    // Common location patterns in LinkedIn snippets
    const locationMatch = snippet.match(/(?:Greater|Metro)?\s*([A-Z][a-z\s]+(?:Area|Bay)?),?\s*([A-Z]{2}|[A-Z][a-z]+)/)
    return locationMatch ? `${locationMatch[1].trim()}, ${locationMatch[2].trim()}` : 'Unknown Location'
  }

  private calculateRelevanceScore(result: SearchResult, profile: { name: string, title: string, company: string }): number {
    let score = 0.5 // Base score
    
    // Higher score for complete profiles
    if (profile.title && profile.title !== 'Unknown Title') score += 0.2
    if (profile.company && profile.company !== 'Unknown Company') score += 0.2
    
    // LinkedIn profile completeness indicators
    if (result.snippet.includes('years of experience')) score += 0.1
    if (result.snippet.includes('skills') || result.snippet.includes('expertise')) score += 0.1
    
    return Math.min(score, 1.0)
  }

  private extractCompanyInsights(results: SearchResult[], searchType: string): string[] {
    const insights = []
    
    for (const result of results.slice(0, 3)) {
      if (searchType === 'funding' && result.snippet.includes('million')) {
        insights.push(`Recent funding activity mentioned: ${result.snippet.substring(0, 100)}...`)
      } else if (searchType === 'technology' && (result.snippet.includes('API') || result.snippet.includes('platform'))) {
        insights.push(`Technology focus: ${result.snippet.substring(0, 100)}...`)
      } else if (searchType === 'news') {
        insights.push(`Recent news: ${result.snippet.substring(0, 100)}...`)
      }
    }

    return insights.length > 0 ? insights : ['No specific insights extracted from search results']
  }

  private deduplicateAndRankProspects(prospects: LinkedInProfile[], criteria: any): LinkedInProfile[] {
    // Remove duplicates based on profile URL
    const unique = prospects.filter((prospect, index, self) => 
      index === self.findIndex(p => p.profileUrl === prospect.profileUrl)
    )

    // Rank by relevance to ICP criteria
    return unique.sort((a, b) => {
      let scoreA = a.relevanceScore
      let scoreB = b.relevanceScore
      
      // Boost score for exact job title matches
      if (criteria.jobTitles.some((title: string) => a.title.toLowerCase().includes(title.toLowerCase()))) {
        scoreA += 0.3
      }
      if (criteria.jobTitles.some((title: string) => b.title.toLowerCase().includes(title.toLowerCase()))) {
        scoreB += 0.3
      }

      return scoreB - scoreA
    })
  }

  private calculateSearchCost(useAdvanced: boolean, queryCount: number): string {
    if (useAdvanced) {
      return 'SerpAPI - check dashboard for current pricing'
    } else {
      // For ICP building, we typically use 10-50 searches/day = FREE
      if (queryCount <= 100) {
        return 'FREE - Google Custom Search (under daily limit)'
      } else {
        const paidQueries = queryCount - 100
        const cost = (paidQueries / 1000) * 5
        return `Google CSE: 100 free + ${paidQueries} paid (~$${cost.toFixed(2)})`
      }
    }
  }
}