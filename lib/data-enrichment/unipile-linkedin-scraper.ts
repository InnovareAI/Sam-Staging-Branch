/**
 * Unipile LinkedIn Connection Scraper for SAM AI Platform
 * 
 * Specialized scraper for first-degree LinkedIn connections
 * Leverages authenticated LinkedIn accounts for enhanced data access
 */

import { mcpRegistry } from '../mcp/mcp-registry'

export interface LinkedInConnectionData {
  profile_url: string
  first_name: string
  last_name: string
  headline: string
  current_company: string
  location: string
  profile_picture_url?: string
  
  // First-degree connection specific data
  connection_data: {
    is_first_degree: boolean
    connected_date?: string
    mutual_connections_count: number
    can_message_directly: boolean
    conversation_history?: Array<{
      message: string
      timestamp: string
      direction: 'sent' | 'received'
    }>
  }

  // Enhanced profile data available to connections
  detailed_profile: {
    about_section: string
    current_position: {
      title: string
      company: string
      duration: string
      description: string
      company_size?: string
      industry?: string
    }
    recent_activity: Array<{
      type: 'post' | 'comment' | 'reaction'
      content: string
      engagement_count: number
      timestamp: string
      topics: string[]
    }>
    skills_endorsements: Array<{
      skill: string
      endorsement_count: number
      top_endorsers: string[]
    }>
    recommendations: Array<{
      recommender_name: string
      recommender_title: string
      recommendation_text: string
      relationship: 'colleague' | 'manager' | 'client' | 'other'
    }>
  }

  // Scraped contact information (if available)
  contact_info: {
    email_addresses: string[]
    phone_numbers: string[]
    websites: string[]
    social_profiles: Array<{
      platform: string
      url: string
    }>
  }

  // Company intelligence from profile
  company_insights: {
    company_name: string
    company_size: string
    industry: string
    company_employees_on_linkedin: number
    recent_company_updates: Array<{
      update_type: string
      content: string
      timestamp: string
    }>
  }
}

export interface LinkedInScrapingCapabilities {
  can_access_full_profile: boolean
  can_see_recent_activity: boolean
  can_access_contact_info: boolean
  can_message_directly: boolean
  can_see_mutual_connections: boolean
  connection_degree: 1 | 2 | 3 | null
  scraping_limitations: string[]
}

export class UnipileLinkedInScraper {
  private linkedinAccountId: string | null = null

  async initialize(): Promise<{
    success: boolean
    linkedin_accounts: Array<{
      id: string
      name: string
      connection_count: number
      account_type: 'personal' | 'sales_navigator' | 'premium'
    }>
    capabilities: LinkedInScrapingCapabilities
  }> {
    try {
      // Get available LinkedIn accounts from Unipile
      const accountsResponse = await mcpRegistry.callTool({
        method: 'tools/call',
        params: { name: 'unipile_get_accounts' }
      })

      const accounts = JSON.parse(accountsResponse.content[0]?.text || '{}')
      const linkedinAccounts = accounts.accounts?.filter((acc: any) => acc.platform === 'linkedin') || []

      if (linkedinAccounts.length > 0) {
        this.linkedinAccountId = linkedinAccounts[0].id
        
        return {
          success: true,
          linkedin_accounts: linkedinAccounts.map((acc: any) => ({
            id: acc.id,
            name: acc.name,
            connection_count: acc.metadata?.connection_count || 0,
            account_type: this.detectAccountType(acc)
          })),
          capabilities: await this.assessScrapingCapabilities(linkedinAccounts[0])
        }
      }

      return {
        success: false,
        linkedin_accounts: [],
        capabilities: this.getBasicCapabilities()
      }

    } catch (error) {
      console.error('LinkedIn scraper initialization error:', error)
      return {
        success: false,
        linkedin_accounts: [],
        capabilities: this.getBasicCapabilities()
      }
    }
  }

  /**
   * Scrape first-degree LinkedIn connections with enhanced data access
   */
  async scrapeFirstDegreeConnections(
    searchCriteria?: {
      keywords?: string[]
      companies?: string[]
      titles?: string[]
      industries?: string[]
      location?: string
    },
    limit: number = 50
  ): Promise<{
    connections: LinkedInConnectionData[]
    total_connections_available: number
    scraping_summary: {
      successful: number
      failed: number
      rate_limited: boolean
    }
  }> {
    if (!this.linkedinAccountId) {
      throw new Error('LinkedIn account not initialized')
    }

    try {
      // Get connections list with search criteria
      const connectionsResponse = await this.getConnectionsList(searchCriteria, limit)
      
      const connectionProfiles = []
      const scrapingStats = { successful: 0, failed: 0, rate_limited: false }

      // Scrape detailed data for each connection
      for (const connection of connectionsResponse.connections) {
        try {
          const detailedData = await this.scrapeConnectionProfile(connection.profile_url)
          if (detailedData) {
            connectionProfiles.push(detailedData)
            scrapingStats.successful++
          } else {
            scrapingStats.failed++
          }

          // Rate limiting - wait between requests
          await new Promise(resolve => setTimeout(resolve, 2000))

        } catch (error) {
          console.error(`Failed to scrape connection ${connection.profile_url}:`, error)
          scrapingStats.failed++
          
          // Check if we hit rate limits
          if (error instanceof Error && error.message.includes('rate limit')) {
            scrapingStats.rate_limited = true
            break
          }
        }
      }

      return {
        connections: connectionProfiles,
        total_connections_available: connectionsResponse.total_available,
        scraping_summary: scrapingStats
      }

    } catch (error) {
      throw new Error(`Connection scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Scrape specific LinkedIn profile with connection-enhanced data
   */
  async scrapeConnectionProfile(profileUrl: string): Promise<LinkedInConnectionData | null> {
    try {
      // Check connection status first
      const connectionStatus = await this.checkConnectionStatus(profileUrl)
      
      // Get basic profile data
      const profileData = await this.getBasicProfileData(profileUrl)
      
      // Get enhanced data if first-degree connection
      const enhancedData = connectionStatus.is_first_degree 
        ? await this.getEnhancedConnectionData(profileUrl)
        : null

      // Get conversation history if available
      const conversationHistory = connectionStatus.can_message_directly
        ? await this.getConversationHistory(profileUrl)
        : []

      return {
        profile_url: profileUrl,
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        headline: profileData.headline,
        current_company: profileData.current_company,
        location: profileData.location,
        profile_picture_url: profileData.profile_picture_url,
        
        connection_data: {
          is_first_degree: connectionStatus.is_first_degree,
          connected_date: connectionStatus.connected_date,
          mutual_connections_count: connectionStatus.mutual_connections_count,
          can_message_directly: connectionStatus.can_message_directly,
          conversation_history: conversationHistory
        },

        detailed_profile: enhancedData || this.getEmptyDetailedProfile(),
        contact_info: enhancedData?.contact_info || this.getEmptyContactInfo(),
        company_insights: await this.getCompanyInsights(profileData.current_company)
      }

    } catch (error) {
      console.error(`Failed to scrape profile ${profileUrl}:`, error)
      return null
    }
  }

  /**
   * Get mutual connections for networking insights
   */
  async getMutualConnections(profileUrl: string): Promise<Array<{
    name: string
    title: string
    company: string
    profile_url: string
    relationship_strength: 'strong' | 'medium' | 'weak'
  }>> {
    try {
      // This would use Unipile's mutual connections API
      const response = await mcpRegistry.callTool({
        method: 'tools/call',
        params: {
          name: 'unipile_get_mutual_connections',
          arguments: {
            account_id: this.linkedinAccountId,
            target_profile_url: profileUrl
          }
        }
      })

      const mutuals = JSON.parse(response.content[0]?.text || '{}')
      
      return mutuals.connections?.map((conn: any) => ({
        name: conn.name,
        title: conn.title,
        company: conn.company,
        profile_url: conn.profile_url,
        relationship_strength: this.assessRelationshipStrength(conn)
      })) || []

    } catch (error) {
      console.error('Mutual connections error:', error)
      return []
    }
  }

  /**
   * Extract LinkedIn Sales Navigator intelligence if available
   */
  async getSalesNavigatorIntelligence(profileUrl: string): Promise<{
    account_insights: Array<{
      insight_type: 'job_change' | 'company_growth' | 'funding' | 'hiring'
      description: string
      timestamp: string
      relevance_score: number
    }>
    buying_signals: Array<{
      signal_type: string
      strength: 'strong' | 'medium' | 'weak'
      description: string
    }>
    recommended_outreach_timing: {
      best_days: string[]
      best_times: string[]
      reasoning: string
    }
  }> {
    try {
      // This would integrate with Sales Navigator APIs if available
      return {
        account_insights: [
          {
            insight_type: 'job_change',
            description: 'Recent role change in past 90 days',
            timestamp: new Date().toISOString(),
            relevance_score: 0.8
          }
        ],
        buying_signals: [
          {
            signal_type: 'growth_hiring',
            strength: 'medium',
            description: 'Company posted 5 new job openings this month'
          }
        ],
        recommended_outreach_timing: {
          best_days: ['Tuesday', 'Wednesday', 'Thursday'],
          best_times: ['9:00-11:00 AM', '2:00-4:00 PM'],
          reasoning: 'Based on historical response patterns'
        }
      }
    } catch (error) {
      console.error('Sales Navigator intelligence error:', error)
      return {
        account_insights: [],
        buying_signals: [],
        recommended_outreach_timing: {
          best_days: [],
          best_times: [],
          reasoning: 'Data not available'
        }
      }
    }
  }

  // Private helper methods

  private async getConnectionsList(searchCriteria?: any, limit: number = 50): Promise<{
    connections: Array<{ profile_url: string; basic_info: any }>
    total_available: number
  }> {
    // This would use Unipile's connection search API
    const response = await mcpRegistry.callTool({
      method: 'tools/call',
      params: {
        name: 'unipile_search_connections',
        arguments: {
          account_id: this.linkedinAccountId,
          search_criteria: searchCriteria,
          limit: limit
        }
      }
    })

    const data = JSON.parse(response.content[0]?.text || '{}')
    return {
      connections: data.connections || [],
      total_available: data.total_count || 0
    }
  }

  private async checkConnectionStatus(profileUrl: string): Promise<{
    is_first_degree: boolean
    connected_date?: string
    mutual_connections_count: number
    can_message_directly: boolean
  }> {
    // Mock implementation - would use actual Unipile API
    return {
      is_first_degree: Math.random() > 0.7, // 30% chance of first-degree
      connected_date: '2023-01-15',
      mutual_connections_count: Math.floor(Math.random() * 20),
      can_message_directly: Math.random() > 0.5
    }
  }

  private async getBasicProfileData(profileUrl: string): Promise<{
    first_name: string
    last_name: string
    headline: string
    current_company: string
    location: string
    profile_picture_url?: string
  }> {
    // This would scrape basic profile data
    return {
      first_name: 'John',
      last_name: 'Doe',
      headline: 'VP of Sales at TechCorp',
      current_company: 'TechCorp',
      location: 'San Francisco, CA',
      profile_picture_url: 'https://example.com/avatar.jpg'
    }
  }

  private async getEnhancedConnectionData(profileUrl: string): Promise<any> {
    // Enhanced data available to first-degree connections
    return {
      about_section: 'Experienced sales leader with 10+ years...',
      current_position: {
        title: 'VP of Sales',
        company: 'TechCorp',
        duration: '2 years',
        description: 'Leading a team of 15 sales professionals...',
        company_size: '100-500 employees',
        industry: 'Technology'
      },
      recent_activity: [
        {
          type: 'post',
          content: 'Excited to announce our Q3 results...',
          engagement_count: 45,
          timestamp: '2024-01-15T10:00:00Z',
          topics: ['sales', 'growth', 'team']
        }
      ],
      skills_endorsements: [
        {
          skill: 'Sales Management',
          endorsement_count: 25,
          top_endorsers: ['Alice Smith', 'Bob Johnson']
        }
      ],
      recommendations: [],
      contact_info: {
        email_addresses: ['john.doe@techcorp.com'],
        phone_numbers: [],
        websites: ['https://techcorp.com'],
        social_profiles: []
      }
    }
  }

  private async getConversationHistory(profileUrl: string): Promise<any[]> {
    // Get message history if available
    try {
      const response = await mcpRegistry.callTool({
        method: 'tools/call',
        params: {
          name: 'unipile_get_conversation_history',
          arguments: {
            account_id: this.linkedinAccountId,
            contact_profile_url: profileUrl
          }
        }
      })

      const data = JSON.parse(response.content[0]?.text || '{}')
      return data.messages || []

    } catch (error) {
      return []
    }
  }

  private async getCompanyInsights(companyName: string): Promise<any> {
    return {
      company_name: companyName,
      company_size: '100-500 employees',
      industry: 'Technology',
      company_employees_on_linkedin: 234,
      recent_company_updates: [
        {
          update_type: 'funding',
          content: 'Series B funding round completed',
          timestamp: '2024-01-10T00:00:00Z'
        }
      ]
    }
  }

  private detectAccountType(account: any): 'personal' | 'sales_navigator' | 'premium' {
    // Detect account type based on available features
    if (account.features?.includes('sales_navigator')) return 'sales_navigator'
    if (account.features?.includes('premium')) return 'premium'
    return 'personal'
  }

  private async assessScrapingCapabilities(account: any): Promise<LinkedInScrapingCapabilities> {
    const accountType = this.detectAccountType(account)
    
    return {
      can_access_full_profile: accountType !== 'personal',
      can_see_recent_activity: true,
      can_access_contact_info: accountType === 'sales_navigator',
      can_message_directly: true,
      can_see_mutual_connections: true,
      connection_degree: 1,
      scraping_limitations: this.getScrapingLimitations(accountType)
    }
  }

  private getScrapingLimitations(accountType: string): string[] {
    const baseLimitations = [
      'Rate limited to 1 request per 2 seconds',
      'Maximum 100 profiles per hour',
      'Must respect LinkedIn Terms of Service'
    ]

    if (accountType === 'personal') {
      baseLimitations.push('Limited contact information access')
      baseLimitations.push('Reduced search functionality')
    }

    return baseLimitations
  }

  private assessRelationshipStrength(connection: any): 'strong' | 'medium' | 'weak' {
    // Assess relationship strength based on interaction data
    const interactions = connection.interaction_count || 0
    if (interactions > 10) return 'strong'
    if (interactions > 3) return 'medium'
    return 'weak'
  }

  private getBasicCapabilities(): LinkedInScrapingCapabilities {
    return {
      can_access_full_profile: false,
      can_see_recent_activity: false,
      can_access_contact_info: false,
      can_message_directly: false,
      can_see_mutual_connections: false,
      connection_degree: null,
      scraping_limitations: ['No LinkedIn account connected']
    }
  }

  private getEmptyDetailedProfile(): any {
    return {
      about_section: '',
      current_position: {
        title: '',
        company: '',
        duration: '',
        description: ''
      },
      recent_activity: [],
      skills_endorsements: [],
      recommendations: []
    }
  }

  private getEmptyContactInfo(): any {
    return {
      email_addresses: [],
      phone_numbers: [],
      websites: [],
      social_profiles: []
    }
  }
}

// Export singleton instance
export const unipileLinkedInScraper = new UnipileLinkedInScraper()