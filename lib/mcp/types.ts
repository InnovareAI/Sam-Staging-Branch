/**
 * Shared MCP types for SAM AI integrations
 */

export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPServerCapabilities {
  tools?: {
    listChanged?: boolean
  }
  resources?: {
    subscribe?: boolean
    listChanged?: boolean
  }
  prompts?: {
    listChanged?: boolean
  }
}

export interface MCPCallToolRequest {
  method: 'tools/call'
  params: {
    name: string
    arguments?: Record<string, any>
  }
}

export interface MCPCallToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    resource?: string
  }>
  isError?: boolean
}

// Bright Data specific types
export interface BrightDataMCPConfig {
  username: string
  password: string
  endpoint: string
  port?: number
  organizationId: string
  userId: string
}

export interface BrightDataProspectRequest {
  profileUrls?: string[]
  searchCriteria?: {
    jobTitles: string[]
    companies: string[]
    industries: string[]
    locations: string[]
    keywords: string[]
  }
  depth: 'quick' | 'standard' | 'comprehensive'
  maxResults?: number
}

// Apify specific types
export interface ApifyMCPConfig {
  apiToken: string
  organizationId: string
  userId: string
}

export interface ApifyProspectRequest {
  searchUrl: string
  maxResults?: number
  extractEmails?: boolean
  extractPhones?: boolean
  waitForResults?: boolean
}

// SAM AI Intelligence types
export interface ProspectIntelligence {
  prospect: {
    firstName: string
    lastName: string
    title: string
    company: string
    linkedinUrl: string
    email?: string
    phone?: string
    location?: string
  }
  company: {
    name: string
    industry: string
    size: string
    technologies: string[]
    recentNews: Array<{
      title: string
      url: string
      sentiment: 'positive' | 'negative' | 'neutral'
    }>
  }
  insights: {
    strategicInsights: Array<{
      type: 'pain_point' | 'opportunity' | 'decision_factor' | 'timing_indicator'
      insight: string
      evidence: string[]
      confidence: number
      methodology: 'challenger' | 'spin' | 'meddic'
    }>
    meddic: {
      overallScore: number
      readiness: 'not_ready' | 'developing' | 'qualified' | 'sales_ready'
      economicBuyer: boolean
      painIdentified: boolean
      decisionCriteria: string[]
    }
    conversationStarters: Array<{
      approach: 'challenger' | 'spin' | 'value_first'
      message: string
      followUpQuestions: string[]
    }>
  }
}

export interface MCPIntelligenceRequest {
  type: 'profile_research' | 'company_intelligence' | 'social_selling_prep'
  source: 'bright_data' | 'apify'
  request: BrightDataProspectRequest | ApifyProspectRequest
  conversationContext?: string
}