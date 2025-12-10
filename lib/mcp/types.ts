/**
 * Shared MCP types for SAM AI integrations
 */

export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, unknown>
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
    arguments?: Record<string, unknown>
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

// Apify specific types
export interface ApifyMCPConfig {
  apiToken: string
  baseUrl?: string
  defaultActorId?: string
  organizationId: string
  userId: string
}

export interface ApifyProspectRequest {
  searchUrl?: string
  maxResults?: number
  extractEmails?: boolean
  extractPhones?: boolean
  waitForResults?: boolean
  actorId?: string
  input?: Record<string, unknown>
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

export interface ReachInboxMCPConfig {
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

// CRM specific types
export interface CRMMCPConfig {
  workspaceId: string
  organizationId: string
  userId: string
}

export interface DatabaseQueryRequest {
  query: string
  parameters?: Record<string, unknown>
  table?: string
  operation?: 'select' | 'insert' | 'update' | 'delete' | 'raw'
  conditions?: Record<string, unknown>
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
