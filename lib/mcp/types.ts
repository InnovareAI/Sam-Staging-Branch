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

// Google Search specific types
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

// Unipile specific types
export interface UnipileMCPConfig {
  dsn: string
  apiKey: string
  clientId?: string
  clientSecret?: string
  webhookSecret?: string
  organizationId: string
  userId: string
}

// N8N specific types  
export interface N8NMCPConfig {
  baseUrl: string
  apiKey: string
  organizationId: string
  userId: string
}

// Apollo specific types
export interface ApolloMCPConfig {
  apiKey: string
  baseUrl?: string
  organizationId: string
  userId: string
}

// Reply Agent specific types
export interface ReplyAgentMCPConfig {
  model: 'claude-sonnet' | 'gpt-4o' | 'gemini-pro'
  maxTokens?: number
  temperature?: number
  organizationId: string
  userId: string
}

export interface WebSearchRequest {
  query: string
  searchType: 'boolean_linkedin' | 'company_intelligence' | 'icp_research'
  maxResults?: number
  filters?: {
    geography?: string
    companySize?: string
    industry?: string
    jobTitles?: string[]
  }
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

// Database specific types
export interface DatabaseMCPConfig {
  connectionString: string
  databaseType: 'postgresql' | 'mysql' | 'sqlite' | 'supabase'
  organizationId: string
  userId: string
  readOnly?: boolean
  allowedTables?: string[]
  maxRows?: number
  queryTimeout?: number
}

export interface DatabaseQueryRequest {
  query: string
  parameters?: Record<string, any>
  table?: string
  operation?: 'select' | 'insert' | 'update' | 'delete' | 'raw'
  conditions?: Record<string, any>
  limit?: number
  offset?: number
}

export interface DatabaseSchemaInfo {
  tables: Array<{
    name: string
    columns: Array<{
      name: string
      type: string
      nullable: boolean
      primaryKey: boolean
      foreignKey?: {
        table: string
        column: string
      }
    }>
    description?: string
  }>
  views?: Array<{
    name: string
    definition: string
  }>
  functions?: Array<{
    name: string
    parameters: string[]
    returnType: string
  }>
}

export interface MCPIntelligenceRequest {
  type: 'profile_research' | 'company_intelligence' | 'social_selling_prep'
  source: 'bright_data' | 'apify'
  request: BrightDataProspectRequest | ApifyProspectRequest
  conversationContext?: string
}