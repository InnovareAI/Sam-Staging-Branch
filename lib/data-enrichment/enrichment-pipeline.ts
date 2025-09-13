/**
 * Data Enrichment Pipeline for SAM AI Platform
 * 
 * Comprehensive prospect and company intelligence gathering
 * Includes LinkedIn personal data, website analysis, and service fit scoring
 */

import { mcpRegistry } from '../mcp/mcp-registry'
import { salesThinkTool } from '../ai/think-tool-integration'

export interface BaseProspectData {
  linkedin_url?: string
  first_name?: string
  last_name?: string
  company_name?: string
  website_url?: string
  email_address?: string
  job_title?: string
  source: 'manual' | 'import' | 'scraping' | 'api'
}

export interface EnrichedProspectData extends BaseProspectData {
  // LinkedIn Personal Data
  linkedin_profile: {
    about_section?: string
    current_position: {
      title: string
      company: string
      duration: string
      description?: string
    }
    experience_summary: Array<{
      title: string
      company: string
      duration: string
      key_achievements?: string[]
    }>
    education: Array<{
      school: string
      degree: string
      field: string
      years: string
    }>
    skills: string[]
    connections_count?: number
    mutual_connections?: Array<{
      name: string
      title: string
      company: string
    }>
    activity_insights: {
      recent_posts: Array<{
        content: string
        engagement: number
        date: string
      }>
      engagement_topics: string[]
      posting_frequency: 'high' | 'medium' | 'low'
    }
  }

  // Company Website Data
  website_intelligence: {
    seo_data: {
      title: string
      meta_description: string
      keywords: string[]
      organic_traffic_estimate: number
      domain_authority: number
      backlinks_count: number
    }
    products_services: Array<{
      name: string
      description: string
      category: string
      pricing_model?: string
    }>
    recent_blog_posts: Array<{
      title: string
      url: string
      published_date: string
      summary: string
      topics: string[]
    }>
    technology_stack: {
      cms: string
      analytics: string[]
      marketing_tools: string[]
      sales_tools: string[]
      development_frameworks: string[]
    }
    company_size_indicators: {
      team_page_count?: number
      job_postings_count?: number
      press_mentions_count?: number
      estimated_employees: number
    }
    business_intelligence: {
      industry_category: string
      target_market: string[]
      value_proposition: string
      competitive_positioning: string
      growth_indicators: Array<{
        metric: string
        trend: 'growing' | 'stable' | 'declining'
        evidence: string
      }>
    }
  }

  // Service Fit Analysis
  service_fit_analysis: {
    icp_score: number // 0-1 scale
    fit_reasoning: string[]
    pain_points_identified: Array<{
      pain_point: string
      evidence: string[]
      confidence: number
      urgency: 'high' | 'medium' | 'low'
    }>
    buying_signals: Array<{
      signal_type: 'budget' | 'authority' | 'need' | 'timing'
      indicator: string
      strength: 'strong' | 'medium' | 'weak'
    }>
    recommended_approach: {
      messaging_angle: string
      key_value_props: string[]
      conversation_starters: string[]
      objection_preemption: string[]
    }
    competitive_threats: Array<{
      competitor: string
      threat_level: 'high' | 'medium' | 'low'
      differentiation_strategy: string
    }>
  }

  // Enrichment Metadata
  enrichment_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'approved' | 'rejected'
  enrichment_timestamp: string
  data_sources: string[]
  confidence_score: number
  manual_review_required: boolean
  estimated_scraping_cost: number
}

export interface DataScrapingQuota {
  user_id: string
  workspace_id: string
  monthly_limit: number
  current_usage: number
  reset_date: string
  overage_allowed: boolean
  overage_cost_per_scrape: number
}

export class DataEnrichmentPipeline {
  private quotaManager: QuotaManager
  private linkedInScraper: LinkedInDataScraper
  private websiteAnalyzer: WebsiteIntelligenceAnalyzer
  private serviceFitAnalyzer: ServiceFitAnalyzer

  constructor() {
    this.quotaManager = new QuotaManager()
    this.linkedInScraper = new LinkedInDataScraper()
    this.websiteAnalyzer = new WebsiteIntelligenceAnalyzer()
    this.serviceFitAnalyzer = new ServiceFitAnalyzer()
  }

  /**
   * Main enrichment pipeline entry point
   */
  async enrichProspectData(
    baseData: BaseProspectData,
    userId: string,
    workspaceId: string,
    enrichmentDepth: 'basic' | 'standard' | 'comprehensive' = 'standard'
  ): Promise<{
    enriched_data?: EnrichedProspectData
    quota_status: DataScrapingQuota
    approval_required: boolean
    estimated_cost: number
    error?: string
  }> {
    try {
      // Check quota availability
      const quotaCheck = await this.quotaManager.checkQuota(userId, workspaceId, enrichmentDepth)
      if (!quotaCheck.allowed) {
        return {
          quota_status: quotaCheck.quota,
          approval_required: false,
          estimated_cost: quotaCheck.estimated_cost,
          error: 'Monthly scraping quota exceeded'
        }
      }

      // Reserve quota
      await this.quotaManager.reserveQuota(userId, workspaceId, quotaCheck.estimated_cost)

      // Start enrichment pipeline
      const enrichedData: EnrichedProspectData = {
        ...baseData,
        linkedin_profile: {} as any,
        website_intelligence: {} as any,
        service_fit_analysis: {} as any,
        enrichment_status: 'in_progress',
        enrichment_timestamp: new Date().toISOString(),
        data_sources: [],
        confidence_score: 0,
        manual_review_required: false,
        estimated_scraping_cost: quotaCheck.estimated_cost
      }

      // Step 1: LinkedIn Profile Enrichment
      if (baseData.linkedin_url) {
        console.log('Enriching LinkedIn profile data...')
        enrichedData.linkedin_profile = await this.linkedInScraper.scrapeProfile(
          baseData.linkedin_url,
          enrichmentDepth
        )
        enrichedData.data_sources.push('linkedin')
      }

      // Step 2: Website Intelligence
      if (baseData.website_url) {
        console.log('Analyzing website intelligence...')
        enrichedData.website_intelligence = await this.websiteAnalyzer.analyzeWebsite(
          baseData.website_url,
          enrichmentDepth
        )
        enrichedData.data_sources.push('website_analysis')
      }

      // Step 3: Service Fit Analysis
      console.log('Computing service fit analysis...')
      enrichedData.service_fit_analysis = await this.serviceFitAnalyzer.analyzeServiceFit(
        enrichedData,
        enrichmentDepth
      )

      // Calculate overall confidence and determine if manual review needed
      enrichedData.confidence_score = this.calculateOverallConfidence(enrichedData)
      enrichedData.manual_review_required = this.requiresManualReview(enrichedData)
      enrichedData.enrichment_status = enrichedData.manual_review_required ? 'pending' : 'completed'

      // Confirm quota usage
      await this.quotaManager.confirmQuotaUsage(userId, workspaceId, quotaCheck.estimated_cost)

      return {
        enriched_data: enrichedData,
        quota_status: await this.quotaManager.getQuotaStatus(userId, workspaceId),
        approval_required: enrichedData.manual_review_required,
        estimated_cost: quotaCheck.estimated_cost
      }

    } catch (error) {
      // Release reserved quota on error
      await this.quotaManager.releaseReservedQuota(userId, workspaceId)
      
      return {
        quota_status: await this.quotaManager.getQuotaStatus(userId, workspaceId),
        approval_required: false,
        estimated_cost: 0,
        error: error instanceof Error ? error.message : 'Enrichment failed'
      }
    }
  }

  /**
   * Batch enrichment for multiple prospects
   */
  async enrichProspectBatch(
    prospects: BaseProspectData[],
    userId: string,
    workspaceId: string,
    enrichmentDepth: 'basic' | 'standard' | 'comprehensive' = 'standard'
  ): Promise<{
    enriched_prospects: EnrichedProspectData[]
    failed_prospects: Array<{ prospect: BaseProspectData; error: string }>
    quota_status: DataScrapingQuota
    batch_summary: {
      total: number
      successful: number
      failed: number
      pending_approval: number
    }
  }> {
    const results: EnrichedProspectData[] = []
    const failures: Array<{ prospect: BaseProspectData; error: string }> = []

    for (const prospect of prospects) {
      try {
        const result = await this.enrichProspectData(prospect, userId, workspaceId, enrichmentDepth)
        
        if (result.enriched_data) {
          results.push(result.enriched_data)
        } else if (result.error) {
          failures.push({ prospect, error: result.error })
        }

        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        failures.push({ 
          prospect, 
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const quotaStatus = await this.quotaManager.getQuotaStatus(userId, workspaceId)

    return {
      enriched_prospects: results,
      failed_prospects: failures,
      quota_status: quotaStatus,
      batch_summary: {
        total: prospects.length,
        successful: results.filter(p => p.enrichment_status === 'completed').length,
        failed: failures.length,
        pending_approval: results.filter(p => p.manual_review_required).length
      }
    }
  }

  private calculateOverallConfidence(data: EnrichedProspectData): number {
    let confidence = 0.5 // baseline
    let factors = 0

    // LinkedIn data quality
    if (data.linkedin_profile?.about_section) {
      confidence += 0.15
      factors++
    }
    if (data.linkedin_profile?.current_position?.description) {
      confidence += 0.1
      factors++
    }

    // Website data quality
    if (data.website_intelligence?.products_services?.length > 0) {
      confidence += 0.15
      factors++
    }
    if (data.website_intelligence?.recent_blog_posts?.length > 0) {
      confidence += 0.1
      factors++
    }

    // Service fit indicators
    if (data.service_fit_analysis?.icp_score > 0.7) {
      confidence += 0.2
      factors++
    }

    return Math.min(confidence, 1.0)
  }

  private requiresManualReview(data: EnrichedProspectData): boolean {
    // High-value prospects always require review
    if (data.service_fit_analysis?.icp_score > 0.8) return true
    
    // Low confidence requires review
    if (data.confidence_score < 0.6) return true
    
    // Competitive threats require review
    if (data.service_fit_analysis?.competitive_threats?.some(t => t.threat_level === 'high')) return true
    
    // High-urgency pain points require review
    if (data.service_fit_analysis?.pain_points_identified?.some(p => p.urgency === 'high')) return true

    return false
  }
}

export class QuotaManager {
  async checkQuota(
    userId: string, 
    workspaceId: string, 
    enrichmentDepth: string
  ): Promise<{
    allowed: boolean
    quota: DataScrapingQuota
    estimated_cost: number
  }> {
    // Get current quota status from database
    const quota = await this.getQuotaStatus(userId, workspaceId)
    
    // Calculate cost based on enrichment depth
    const cost = this.calculateEnrichmentCost(enrichmentDepth)
    
    return {
      allowed: quota.current_usage + cost <= quota.monthly_limit,
      quota,
      estimated_cost: cost
    }
  }

  async getQuotaStatus(userId: string, workspaceId: string): Promise<DataScrapingQuota> {
    // This would query your database - mock implementation
    return {
      user_id: userId,
      workspace_id: workspaceId,
      monthly_limit: 2000,
      current_usage: 450, // Example current usage
      reset_date: this.getNextMonthFirstDay(),
      overage_allowed: true,
      overage_cost_per_scrape: 0.05
    }
  }

  async reserveQuota(userId: string, workspaceId: string, cost: number): Promise<void> {
    // Reserve quota in database to prevent race conditions
    console.log(`Reserving ${cost} quota units for user ${userId}`)
  }

  async confirmQuotaUsage(userId: string, workspaceId: string, cost: number): Promise<void> {
    // Confirm quota usage and update current_usage
    console.log(`Confirming ${cost} quota units usage for user ${userId}`)
  }

  async releaseReservedQuota(userId: string, workspaceId: string): Promise<void> {
    // Release any reserved quota on error
    console.log(`Releasing reserved quota for user ${userId}`)
  }

  private calculateEnrichmentCost(depth: string): number {
    const costs = {
      'basic': 1,      // LinkedIn + basic website
      'standard': 3,   // + SEO data + blog posts
      'comprehensive': 5 // + full tech stack + competitive analysis
    }
    return costs[depth as keyof typeof costs] || 3
  }

  private getNextMonthFirstDay(): string {
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return nextMonth.toISOString()
  }
}

export class LinkedInDataScraper {
  async scrapeProfile(linkedinUrl: string, depth: string): Promise<any> {
    try {
      // Use Unipile MCP for first-degree connections if available
      const connectionData = await this.checkFirstDegreeConnection(linkedinUrl)
      
      // Use Bright Data MCP for comprehensive scraping
      const profileData = await mcpRegistry.callTool({
        method: 'tools/call',
        params: {
          name: 'research_prospect',
          arguments: {
            profileUrls: [linkedinUrl],
            depth: depth === 'comprehensive' ? 'comprehensive' : 'standard'
          }
        },
        server: 'bright-data'
      })

      return this.parseLinkedInData(profileData, connectionData)

    } catch (error) {
      console.error('LinkedIn scraping error:', error)
      return this.getEmptyLinkedInProfile()
    }
  }

  private async checkFirstDegreeConnection(linkedinUrl: string): Promise<any> {
    try {
      // Check if user has first-degree connection through Unipile
      const accounts = await mcpRegistry.callTool({
        method: 'tools/call',
        params: { name: 'unipile_get_accounts' }
      })

      // Look for LinkedIn accounts
      const linkedinAccounts = JSON.parse(accounts.content[0].text || '{}')
        .accounts?.filter((acc: any) => acc.platform === 'linkedin') || []

      if (linkedinAccounts.length > 0) {
        // Check for mutual connections or conversation history
        return await this.getMutualConnectionData(linkedinUrl, linkedinAccounts[0].id)
      }

      return null
    } catch (error) {
      console.error('First-degree connection check error:', error)
      return null
    }
  }

  private async getMutualConnectionData(profileUrl: string, accountId: string): Promise<any> {
    // This would use Unipile's connection API to get mutual connections
    // For now, return mock data structure
    return {
      is_first_degree: false,
      mutual_connections: [],
      conversation_history: [],
      can_message_directly: false
    }
  }

  private parseLinkedInData(profileData: any, connectionData: any): any {
    // Parse the response from Bright Data MCP
    try {
      const parsed = JSON.parse(profileData.content[0]?.text || '{}')
      
      return {
        about_section: parsed.about || '',
        current_position: {
          title: parsed.current_title || '',
          company: parsed.current_company || '',
          duration: parsed.current_duration || '',
          description: parsed.current_description || ''
        },
        experience_summary: parsed.experience || [],
        education: parsed.education || [],
        skills: parsed.skills || [],
        connections_count: parsed.connections_count || 0,
        mutual_connections: connectionData?.mutual_connections || [],
        activity_insights: {
          recent_posts: parsed.recent_posts || [],
          engagement_topics: parsed.topics || [],
          posting_frequency: this.assessPostingFrequency(parsed.recent_posts || [])
        }
      }
    } catch (error) {
      return this.getEmptyLinkedInProfile()
    }
  }

  private assessPostingFrequency(posts: any[]): 'high' | 'medium' | 'low' {
    if (posts.length > 10) return 'high'
    if (posts.length > 3) return 'medium'
    return 'low'
  }

  private getEmptyLinkedInProfile(): any {
    return {
      about_section: '',
      current_position: { title: '', company: '', duration: '', description: '' },
      experience_summary: [],
      education: [],
      skills: [],
      connections_count: 0,
      mutual_connections: [],
      activity_insights: {
        recent_posts: [],
        engagement_topics: [],
        posting_frequency: 'low' as const
      }
    }
  }
}

export class WebsiteIntelligenceAnalyzer {
  async analyzeWebsite(websiteUrl: string, depth: string): Promise<any> {
    try {
      // Use multiple MCPs for comprehensive website analysis
      const [seoData, contentData, techData] = await Promise.all([
        this.getSEOData(websiteUrl),
        this.getContentData(websiteUrl, depth),
        this.getTechnologyStack(websiteUrl)
      ])

      return {
        seo_data: seoData,
        products_services: contentData.products_services,
        recent_blog_posts: contentData.blog_posts,
        technology_stack: techData,
        company_size_indicators: await this.getCompanySizeIndicators(websiteUrl),
        business_intelligence: await this.getBusinessIntelligence(contentData, seoData)
      }

    } catch (error) {
      console.error('Website analysis error:', error)
      return this.getEmptyWebsiteIntelligence()
    }
  }

  private async getSEOData(websiteUrl: string): Promise<any> {
    try {
      const response = await mcpRegistry.callTool({
        method: 'tools/call',
        params: {
          name: 'company_intelligence_search',
          arguments: {
            query: `site:${websiteUrl} SEO analysis`,
            searchType: 'company_intelligence',
            maxResults: 5
          }
        },
        server: 'websearch'
      })

      // Parse SEO data from search results
      const results = JSON.parse(response.content[0]?.text || '{}')
      
      return {
        title: 'Website Title', // Would extract from actual scraping
        meta_description: 'Website description',
        keywords: ['keyword1', 'keyword2'],
        organic_traffic_estimate: 10000,
        domain_authority: 45,
        backlinks_count: 1200
      }
    } catch (error) {
      return {
        title: '',
        meta_description: '',
        keywords: [],
        organic_traffic_estimate: 0,
        domain_authority: 0,
        backlinks_count: 0
      }
    }
  }

  private async getContentData(websiteUrl: string, depth: string): Promise<any> {
    // Use Bright Data for content scraping
    try {
      const response = await mcpRegistry.callTool({
        method: 'tools/call',
        params: {
          name: 'analyze_company',
          arguments: {
            website: websiteUrl,
            depth: depth === 'comprehensive' ? 'deep' : 'standard'
          }
        },
        server: 'bright-data'
      })

      const data = JSON.parse(response.content[0]?.text || '{}')
      
      return {
        products_services: data.products || [],
        blog_posts: data.blog_posts || []
      }
    } catch (error) {
      return {
        products_services: [],
        blog_posts: []
      }
    }
  }

  private async getTechnologyStack(websiteUrl: string): Promise<any> {
    // This would use a service like BuiltWith or Wappalyzer
    return {
      cms: 'WordPress',
      analytics: ['Google Analytics'],
      marketing_tools: ['HubSpot', 'Mailchimp'],
      sales_tools: ['Salesforce'],
      development_frameworks: ['React', 'Node.js']
    }
  }

  private async getCompanySizeIndicators(websiteUrl: string): Promise<any> {
    return {
      team_page_count: 25,
      job_postings_count: 5,
      press_mentions_count: 12,
      estimated_employees: 50
    }
  }

  private async getBusinessIntelligence(contentData: any, seoData: any): Promise<any> {
    return {
      industry_category: 'Technology',
      target_market: ['SMB', 'Enterprise'],
      value_proposition: 'Automate business processes',
      competitive_positioning: 'Premium solution',
      growth_indicators: [
        {
          metric: 'Blog posting frequency',
          trend: 'growing' as const,
          evidence: 'Monthly blog posts increasing'
        }
      ]
    }
  }

  private getEmptyWebsiteIntelligence(): any {
    return {
      seo_data: {
        title: '',
        meta_description: '',
        keywords: [],
        organic_traffic_estimate: 0,
        domain_authority: 0,
        backlinks_count: 0
      },
      products_services: [],
      recent_blog_posts: [],
      technology_stack: {
        cms: '',
        analytics: [],
        marketing_tools: [],
        sales_tools: [],
        development_frameworks: []
      },
      company_size_indicators: {
        team_page_count: 0,
        job_postings_count: 0,
        press_mentions_count: 0,
        estimated_employees: 0
      },
      business_intelligence: {
        industry_category: '',
        target_market: [],
        value_proposition: '',
        competitive_positioning: '',
        growth_indicators: []
      }
    }
  }
}

export class ServiceFitAnalyzer {
  async analyzeServiceFit(enrichedData: EnrichedProspectData, depth: string): Promise<any> {
    try {
      // Use Think Tool for complex service fit analysis
      const analysis = await salesThinkTool.qualifyProspect(
        {
          prospect: enrichedData,
          company: enrichedData.website_intelligence,
          linkedin: enrichedData.linkedin_profile
        },
        {
          service_offering: 'SAM AI Platform',
          target_markets: ['B2B SaaS', 'Technology', 'Professional Services'],
          ideal_company_size: '10-500 employees'
        }
      )

      return {
        icp_score: this.calculateICPScore(enrichedData),
        fit_reasoning: analysis.reasoning_chain.map(step => step.reasoning),
        pain_points_identified: this.identifyPainPoints(enrichedData),
        buying_signals: this.identifyBuyingSignals(enrichedData),
        recommended_approach: this.generateRecommendedApproach(enrichedData),
        competitive_threats: this.identifyCompetitiveThreats(enrichedData)
      }

    } catch (error) {
      console.error('Service fit analysis error:', error)
      return this.getEmptyServiceFitAnalysis()
    }
  }

  private calculateICPScore(data: EnrichedProspectData): number {
    let score = 0.5 // baseline

    // Company size scoring
    const employeeCount = data.website_intelligence?.company_size_indicators?.estimated_employees || 0
    if (employeeCount >= 10 && employeeCount <= 500) score += 0.2

    // Industry scoring
    const industry = data.website_intelligence?.business_intelligence?.industry_category?.toLowerCase()
    if (industry?.includes('technology') || industry?.includes('saas')) score += 0.15

    // Role scoring
    const title = data.linkedin_profile?.current_position?.title?.toLowerCase()
    if (title?.includes('vp') || title?.includes('director') || title?.includes('head')) score += 0.15

    // Technology stack scoring
    const salesTools = data.website_intelligence?.technology_stack?.sales_tools || []
    if (salesTools.length > 0) score += 0.1

    return Math.min(score, 1.0)
  }

  private identifyPainPoints(data: EnrichedProspectData): any[] {
    const painPoints = []

    // Check for sales process pain points
    if (data.website_intelligence?.technology_stack?.sales_tools?.length === 0) {
      painPoints.push({
        pain_point: 'No sales automation tools detected',
        evidence: ['Missing CRM/sales stack in technology analysis'],
        confidence: 0.7,
        urgency: 'medium' as const
      })
    }

    // Check for growth indicators
    const growthIndicators = data.website_intelligence?.business_intelligence?.growth_indicators || []
    if (growthIndicators.some(gi => gi.trend === 'growing')) {
      painPoints.push({
        pain_point: 'Scaling challenges with growth',
        evidence: ['Website shows growth indicators', 'May need sales process optimization'],
        confidence: 0.6,
        urgency: 'high' as const
      })
    }

    return painPoints
  }

  private identifyBuyingSignals(data: EnrichedProspectData): any[] {
    const signals = []

    // Job postings signal
    const jobPostings = data.website_intelligence?.company_size_indicators?.job_postings_count || 0
    if (jobPostings > 3) {
      signals.push({
        signal_type: 'need' as const,
        indicator: 'Active hiring suggests growth and potential need for sales tools',
        strength: 'medium' as const
      })
    }

    // Authority signal
    const title = data.linkedin_profile?.current_position?.title?.toLowerCase()
    if (title?.includes('vp') || title?.includes('director')) {
      signals.push({
        signal_type: 'authority' as const,
        indicator: 'Senior role indicates decision-making authority',
        strength: 'strong' as const
      })
    }

    return signals
  }

  private generateRecommendedApproach(data: EnrichedProspectData): any {
    return {
      messaging_angle: 'Sales process optimization for growing companies',
      key_value_props: [
        'Automate lead qualification and enrichment',
        'Increase sales team productivity',
        'Better prospect intelligence'
      ],
      conversation_starters: [
        'How is your team currently handling lead qualification?',
        'What challenges are you facing with sales process scalability?'
      ],
      objection_preemption: [
        'ROI typically seen within 60 days',
        'Easy integration with existing sales stack'
      ]
    }
  }

  private identifyCompetitiveThreats(data: EnrichedProspectData): any[] {
    const threats = []

    const salesTools = data.website_intelligence?.technology_stack?.sales_tools || []
    
    if (salesTools.includes('HubSpot')) {
      threats.push({
        competitor: 'HubSpot',
        threat_level: 'medium' as const,
        differentiation_strategy: 'Focus on AI-powered intelligence vs basic CRM'
      })
    }

    if (salesTools.includes('Salesforce')) {
      threats.push({
        competitor: 'Salesforce',
        threat_level: 'high' as const,
        differentiation_strategy: 'Emphasize ease of use and quick implementation'
      })
    }

    return threats
  }

  private getEmptyServiceFitAnalysis(): any {
    return {
      icp_score: 0,
      fit_reasoning: [],
      pain_points_identified: [],
      buying_signals: [],
      recommended_approach: {
        messaging_angle: '',
        key_value_props: [],
        conversation_starters: [],
        objection_preemption: []
      },
      competitive_threats: []
    }
  }
}

// Export singleton instance
export const dataEnrichmentPipeline = new DataEnrichmentPipeline()