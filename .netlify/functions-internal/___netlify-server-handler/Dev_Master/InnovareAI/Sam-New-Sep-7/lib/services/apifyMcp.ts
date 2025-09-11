/**
 * Apify MCP Service for SAM AI Platform
 * 
 * Handles LinkedIn data extraction via Apify actors with cost optimization
 */

interface ApifyConfig {
  apiToken: string
  organizationId: string
  userId: string
}

interface ApifyRunStatus {
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  stats: {
    inputBodyLen: number
    restartCount: number
    durationMillis: number
  }
  error?: string
}

interface ApifyRunResult {
  success: boolean
  data: any[]
  error?: string
}

interface ApifyExtractionOptions {
  maxResults?: number
  extractEmails?: boolean
  extractPhones?: boolean
  waitForResults?: boolean
}

interface ApifyProspect {
  linkedInUrl: string
  fullName: string
  firstName: string
  lastName: string
  jobTitle?: string
  company?: string
  location?: string
  email?: string
  phone?: string
  about?: string
  connections?: number
  followers?: number
}

export class ApifyMcpService {
  private config: ApifyConfig
  private dailyQuota = {
    profiles: 350,
    used: 0
  }

  constructor(config?: ApifyConfig) {
    this.config = config || {
      apiToken: process.env.APIFY_API_TOKEN || '',
      organizationId: process.env.ORGANIZATION_ID || 'default-org',
      userId: process.env.USER_ID || 'default-user'
    }
  }

  validateLinkedInUrl(url: string): { isValid: boolean; urlType: string; errors: string[] } {
    const errors: string[] = []
    
    if (!url) {
      errors.push('URL is required')
      return { isValid: false, urlType: 'unknown', errors }
    }

    if (!url.includes('linkedin.com')) {
      errors.push('URL must be from linkedin.com')
      return { isValid: false, urlType: 'unknown', errors }
    }

    let urlType = 'unknown'
    
    if (url.includes('/in/') || url.includes('/pub/')) {
      urlType = 'profile'
    } else if (url.includes('/company/')) {
      urlType = 'company'
    } else if (url.includes('/search/results/')) {
      urlType = 'search'
    } else {
      errors.push('Unsupported LinkedIn URL type')
    }

    const isValid = errors.length === 0
    
    return { isValid, urlType, errors }
  }

  checkDailyQuota(requestedResults: number): { canProceed: boolean; recommendedActor: string } {
    const remaining = this.dailyQuota.profiles - this.dailyQuota.used
    
    if (requestedResults <= remaining) {
      return {
        canProceed: true,
        recommendedActor: 'LinkedIn Profile Scraper'
      }
    }

    return {
      canProceed: false,
      recommendedActor: 'Apollo Database Scraper (paid alternative)'
    }
  }

  async extractLinkedInProfiles(
    searchUrl: string, 
    options: ApifyExtractionOptions = {}
  ): Promise<{
    success: boolean
    data: any[]
    runId: string
    stats: any
    errors: string[]
  }> {
    try {
      // Mock extraction for now - replace with actual Apify API calls
      const mockProfiles = this.generateMockProfiles(options.maxResults || 10)
      
      return {
        success: true,
        data: mockProfiles,
        runId: `apify_${Date.now()}`,
        stats: {
          extracted: mockProfiles.length,
          emails: mockProfiles.filter(p => p.email).length,
          phones: mockProfiles.filter(p => p.phone).length
        },
        errors: []
      }
    } catch (error) {
      return {
        success: false,
        data: [],
        runId: '',
        stats: {},
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  async getRunStatus(runId: string): Promise<ApifyRunStatus> {
    // Mock status check - replace with actual Apify API
    return {
      status: 'SUCCEEDED',
      stats: {
        inputBodyLen: 1024,
        restartCount: 0,
        durationMillis: 30000
      }
    }
  }

  async getRunResults(runId: string): Promise<ApifyRunResult> {
    try {
      // Mock results retrieval - replace with actual Apify API
      const mockData = this.generateMockProfiles(20)
      
      return {
        success: true,
        data: mockData
      }
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  estimateExtraction(searchUrl: string, maxResults: number): {
    estimatedCost: string
    estimatedTimeMinutes: number
    recommendedActor: string
    dailyCapacity: number
    monthlyBudget: string
    resultLimit: number
  } {
    // Cost estimation based on volume
    const costPerProfile = maxResults > 500 ? 0.0012 : 0.002
    const estimatedCost = (maxResults * costPerProfile).toFixed(3)
    
    return {
      estimatedCost: `$${estimatedCost}`,
      estimatedTimeMinutes: Math.ceil(maxResults / 10),
      recommendedActor: maxResults > 500 ? 'Apollo Database Scraper' : 'LinkedIn Profile Scraper',
      dailyCapacity: maxResults > 500 ? 50000 : 350,
      monthlyBudget: '$50-200',
      resultLimit: maxResults
    }
  }

  async getAvailableActors(): Promise<{ actors: any[], error?: string }> {
    try {
      return {
        actors: [
          {
            id: 'linkedin-profile-scraper',
            name: 'LinkedIn Profile Scraper',
            description: 'Extract LinkedIn profiles with email discovery',
            pricing: '$0.002 per profile',
            dailyLimit: 350,
            features: ['Profile data', 'Email discovery', 'Contact info']
          },
          {
            id: 'apollo-database-scraper', 
            name: 'Apollo Database Scraper',
            description: 'Enterprise LinkedIn extraction via Apollo',
            pricing: '$0.0012 per profile',
            dailyLimit: 50000,
            features: ['High volume', 'Enterprise data', 'Advanced filtering']
          }
        ]
      }
    } catch (error) {
      return {
        actors: [],
        error: error instanceof Error ? error.message : 'Failed to fetch actors'
      }
    }
  }

  convertToProspects(apifyData: any[]): ApifyProspect[] {
    return apifyData.map(profile => ({
      linkedInUrl: profile.url || profile.linkedInUrl || '',
      fullName: profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
      firstName: profile.firstName || profile.fullName?.split(' ')[0] || '',
      lastName: profile.lastName || profile.fullName?.split(' ').slice(1).join(' ') || '',
      jobTitle: profile.jobTitle || profile.headline || '',
      company: profile.company || profile.companyName || '',
      location: profile.location || profile.geo || '',
      email: profile.email || profile.contactEmail || '',
      phone: profile.phone || profile.phoneNumber || '',
      about: profile.about || profile.summary || '',
      connections: profile.connections || profile.connectionsCount || 0,
      followers: profile.followers || profile.followersCount || 0
    }))
  }

  private generateMockProfiles(count: number): any[] {
    const mockProfiles = []
    
    for (let i = 0; i < count; i++) {
      mockProfiles.push({
        url: `https://linkedin.com/in/prospect-${i + 1}`,
        fullName: `Prospect ${i + 1}`,
        firstName: `First${i + 1}`,
        lastName: `Last${i + 1}`,
        jobTitle: `${['VP Sales', 'Director Marketing', 'CEO', 'CTO', 'Head of Growth'][i % 5]}`,
        company: `Company ${String.fromCharCode(65 + (i % 26))}`,
        location: `${['San Francisco', 'New York', 'London', 'Toronto', 'Sydney'][i % 5]}`,
        email: i < 5 ? `prospect${i + 1}@company${String.fromCharCode(65 + (i % 26)).toLowerCase()}.com` : undefined,
        phone: i < 3 ? `+1-555-${String(i + 1).padStart(3, '0')}-0000` : undefined,
        about: `Experienced professional in ${['sales', 'marketing', 'technology', 'operations', 'strategy'][i % 5]} with proven track record.`,
        connections: Math.floor(Math.random() * 500) + 200,
        followers: Math.floor(Math.random() * 1000) + 100
      })
    }
    
    return mockProfiles
  }
}