# MCP Integration Framework Documentation
**SAM AI Platform - Model Context Protocol Integration & AI Service Orchestration**

**Created**: 2025-09-12  
**Version**: 1.0  
**Status**: Production Ready  
**Classification**: Advanced AI Integration Framework

---

## 🎯 Overview

The SAM AI MCP (Model Context Protocol) Integration Framework provides **intelligent AI service orchestration**, **external data enrichment**, and **advanced web research capabilities** through a unified interface. This framework enables SAM to perform **sophisticated prospect intelligence**, **company research**, and **data-driven sales insights** using multiple AI services and data providers.

### **Key Capabilities**
- ✅ **Multi-Provider AI Service Integration** via MCP protocol
- ✅ **Intelligent Data Enrichment** for prospect research
- ✅ **Web Automation & Scraping** through Bright Data and Apify
- ✅ **Advanced Search Capabilities** with contextual filtering
- ✅ **MEDDIC Sales Intelligence** with automated scoring
- ✅ **Challenger Sale Methodology** integration
- ✅ **Real-Time Company Intelligence** with news sentiment analysis

---

## 🏗️ System Architecture

### **MCP Integration Stack**
```
┌─────────────────────────────────────────────────────────┐
│                    SAM AI CHAT ENGINE                  │
│              /api/sam/prospect-intelligence             │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                  MCP REGISTRY LAYER                    │
│              lib/mcp/mcp-registry.ts                   │
│                                                         │
│  ┌─────────────────┬─────────────────┬───────────────┐  │
│  │   BRIGHT DATA   │     APIFY       │  WEB SEARCH   │  │
│  │      MCP        │     MCP         │     MCP       │  │
│  └─────────────────┴─────────────────┴───────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│               EXTERNAL SERVICE PROVIDERS               │
│                                                         │
│  ┌─────────────────┬─────────────────┬───────────────┐  │
│  │   Bright Data   │     Apify       │    Search     │  │
│  │   Web Scraping  │  Web Automation │   Engines     │  │
│  └─────────────────┴─────────────────┴───────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                 AI INTELLIGENCE LAYER                  │
│            Advanced Sales Methodology Integration       │
│              MEDDIC • Challenger • SPIN                │
└─────────────────────────────────────────────────────────┘
```

### **Core MCP Components**

#### **1. MCP Registry (`lib/mcp/mcp-registry.ts`)**
Central orchestration layer managing all MCP service integrations:

```typescript
interface MCPRegistry {
  brightDataServer?: BrightDataMCPServer;    // Web scraping service
  apifyServer?: ApifyMCPServer;              // Web automation platform
  webSearchServer?: WebSearchMCPServer;      // Enhanced search engine
  
  // Core methods
  initialize(config: MCPServerConfig): Promise<InitResult>;
  callTool(serverName: string, toolName: string, args: any): Promise<MCPResult>;
  getAvailableTools(): Promise<MCPTool[]>;
  getServerStatus(): Promise<ServerStatus[]>;
}
```

#### **2. MCP Tool Interface (`lib/mcp/types.ts`)**
Standardized tool definition for all MCP services:

```typescript
interface MCPTool {
  name: string;                              // Tool identifier
  description: string;                       // Human-readable description
  inputSchema: {                            // JSON Schema for inputs
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}
```

#### **3. Prospect Intelligence Schema**
Advanced sales intelligence data structure:

```typescript
interface ProspectIntelligence {
  prospect: {                               // Individual prospect data
    firstName: string;
    lastName: string;
    title: string;
    company: string;
    linkedinUrl: string;
    email?: string;
    phone?: string;
    location?: string;
  };
  company: {                               // Company intelligence
    name: string;
    industry: string;
    size: string;
    technologies: string[];
    recentNews: NewsItem[];                // Sentiment-analyzed news
  };
  insights: {                              // Sales methodology insights
    strategicInsights: Insight[];          // Pain points & opportunities
    meddic: MEDDICScore;                  // MEDDIC methodology scoring
    conversationStarters: Starter[];      // Challenger/SPIN approaches
  };
}
```

---

## 🚀 Implementation Guide

### **MCP Service Registration**

#### **1. Initialize MCP Registry**
```typescript
import { MCPRegistry } from '@/lib/mcp/mcp-registry';

// Initialize with all available services
const mcpRegistry = new MCPRegistry();

const config = {
  brightData: {
    username: process.env.BRIGHT_DATA_USERNAME,
    password: process.env.BRIGHT_DATA_PASSWORD,
    endpoint: process.env.BRIGHT_DATA_ENDPOINT,
    organizationId: process.env.BRIGHT_DATA_ORG_ID,
    userId: process.env.BRIGHT_DATA_USER_ID
  },
  apify: {
    apiToken: process.env.APIFY_API_TOKEN,
    organizationId: process.env.APIFY_ORG_ID,
    userId: process.env.APIFY_USER_ID
  },
  webSearch: {
    organizationId: process.env.WEB_SEARCH_ORG_ID,
    userId: process.env.WEB_SEARCH_USER_ID,
    maxResults: 20,
    searchTimeout: 30000
  }
};

const result = await mcpRegistry.initialize(config);
console.log(`Initialized servers: ${result.servers.join(', ')}`);
```

#### **2. Call MCP Tools**
```typescript
// Prospect research using Bright Data
const prospectRequest = {
  profileUrls: ['https://linkedin.com/in/john-doe'],
  depth: 'comprehensive',
  maxResults: 1
};

const result = await mcpRegistry.callTool(
  'bright-data',
  'prospect_research',
  prospectRequest
);

// Company intelligence using web search
const companyRequest = {
  query: 'Microsoft recent AI investments news',
  searchType: 'company_intelligence',
  maxResults: 10,
  filters: {
    industry: 'technology'
  }
};

const companyData = await mcpRegistry.callTool(
  'web-search',
  'company_research',
  companyRequest
);
```

---

## 🔍 Service Integrations

### **1. Bright Data MCP Server**

#### **Configuration**
```typescript
interface BrightDataMCPConfig {
  username: string;                        // Bright Data username
  password: string;                        // Bright Data password
  endpoint: string;                        // API endpoint URL
  port?: number;                          // Connection port
  organizationId: string;                 // Organization identifier
  userId: string;                         // User identifier
}
```

#### **Available Tools**
- **`prospect_research`**: LinkedIn profile and company data extraction
- **`bulk_prospect_search`**: Mass prospect discovery and enrichment
- **`company_intelligence`**: Comprehensive company research
- **`social_listening`**: Brand mention and sentiment monitoring
- **`competitive_analysis`**: Competitor data collection

#### **Usage Example**
```typescript
// Advanced prospect research
const prospectData = await mcpRegistry.callTool(
  'bright-data',
  'prospect_research',
  {
    profileUrls: [
      'https://linkedin.com/in/ceo-example',
      'https://linkedin.com/in/cto-example'
    ],
    searchCriteria: {
      jobTitles: ['CEO', 'CTO', 'VP Engineering'],
      companies: ['Microsoft', 'Google', 'Amazon'],
      industries: ['Technology', 'Software'],
      locations: ['San Francisco', 'Seattle', 'New York'],
      keywords: ['AI', 'machine learning', 'SaaS']
    },
    depth: 'comprehensive',
    maxResults: 50
  }
);
```

### **2. Apify MCP Server**

#### **Configuration**
```typescript
interface ApifyMCPConfig {
  apiToken: string;                       // Apify API token
  organizationId: string;                 // Organization ID
  userId: string;                         // User ID
}
```

#### **Available Tools**
- **`web_scraping`**: Custom website data extraction
- **`linkedin_scraper`**: LinkedIn data collection
- **`google_search`**: Search result harvesting
- **`email_finder`**: Contact information discovery
- **`social_media_monitor`**: Social platform monitoring

#### **Usage Example**
```typescript
// LinkedIn company page scraping
const linkedinData = await mcpRegistry.callTool(
  'apify',
  'linkedin_scraper',
  {
    searchUrl: 'https://linkedin.com/company/microsoft',
    maxResults: 100,
    extractEmails: true,
    extractPhones: true,
    waitForResults: true
  }
);
```

### **3. WebSearch MCP Server**

#### **Configuration**
```typescript
interface WebSearchMCPConfig {
  organizationId: string;                 // Organization ID
  userId: string;                         // User ID
  maxResults?: number;                    // Default result limit
  searchTimeout?: number;                 // Request timeout (ms)
}
```

#### **Available Tools**
- **`boolean_linkedin`**: Advanced LinkedIn search with boolean operators
- **`company_intelligence`**: Multi-source company research
- **`icp_research`**: Ideal Customer Profile analysis
- **`news_sentiment`**: News analysis with sentiment scoring
- **`competitor_monitoring`**: Competitive intelligence gathering

#### **Usage Example**
```typescript
// ICP research for SaaS companies
const icpData = await mcpRegistry.callTool(
  'web-search',
  'icp_research',
  {
    query: 'SaaS companies 100-500 employees Series B funding',
    searchType: 'icp_research',
    maxResults: 25,
    filters: {
      geography: 'United States',
      companySize: '100-500',
      industry: 'Software',
      jobTitles: ['VP Sales', 'Head of Revenue', 'Sales Director']
    }
  }
);
```

---

## 🧠 AI Sales Intelligence

### **MEDDIC Methodology Integration**

#### **Automated MEDDIC Scoring**
```typescript
interface MEDDICScore {
  overallScore: number;                   // 0-100 qualification score
  readiness: 'not_ready' | 'developing' | 'qualified' | 'sales_ready';
  economicBuyer: boolean;                 // Economic buyer identified
  painIdentified: boolean;                // Pain points discovered
  decisionCriteria: string[];             // Key decision factors
  metrics: {
    economic: number;                     // Economic impact score
    decision: number;                     // Decision criteria clarity
    pain: number;                         // Pain intensity score
    timeline: number;                     // Implementation timeline
  };
}
```

#### **Strategic Insights Generation**
```typescript
interface StrategyInsight {
  type: 'pain_point' | 'opportunity' | 'decision_factor' | 'timing_indicator';
  insight: string;                        // Strategic insight text
  evidence: string[];                     // Supporting evidence
  confidence: number;                     // Confidence score (0-1)
  methodology: 'challenger' | 'spin' | 'meddic';
}
```

### **Challenger Sale Integration**

#### **Conversation Starters**
```typescript
interface ConversationStarter {
  approach: 'challenger' | 'spin' | 'value_first';
  message: string;                        // Opening message
  followUpQuestions: string[];            // Suggested follow-ups
  insights: string[];                     // Supporting insights
  timing: 'immediate' | 'warm_up' | 'nurture';
}
```

#### **Example Generated Insights**
```typescript
const challengerInsights = {
  approach: 'challenger',
  message: `Hi John, I noticed Microsoft just announced a $10B investment in AI infrastructure. 
    Based on similar investments I've seen, companies often struggle with data privacy compliance 
    when scaling AI operations. How are you thinking about balancing innovation speed with 
    regulatory requirements?`,
  followUpQuestions: [
    'What's your current approach to AI governance?',
    'How involved is your legal team in AI project decisions?',
    'What would happen if a compliance issue delayed your AI rollout?'
  ],
  insights: [
    'Recent $10B AI investment indicates aggressive scaling plans',
    'Data privacy regulations increasingly complex for AI workloads',
    'Timing window exists due to public investment announcement'
  ],
  timing: 'immediate'
};
```

---

## 📊 Intelligence Pipeline

### **Data Processing Flow**

#### **1. Data Collection**
```typescript
// Multi-source data gathering
const rawData = await Promise.all([
  mcpRegistry.callTool('bright-data', 'prospect_research', profileRequest),
  mcpRegistry.callTool('web-search', 'company_intelligence', companyRequest),
  mcpRegistry.callTool('apify', 'social_media_monitor', socialRequest)
]);
```

#### **2. Data Fusion & Analysis**
```typescript
// Combine and analyze data from multiple sources
const intelligence = await analyzeProspectData({
  profileData: rawData[0],
  companyData: rawData[1],
  socialData: rawData[2],
  methodology: 'challenger',  // or 'spin', 'meddic'
  analysisDepth: 'comprehensive'
});
```

#### **3. Sales Intelligence Generation**
```typescript
// Generate actionable sales insights
const salesInsights = await generateSalesIntelligence({
  prospectIntelligence: intelligence,
  conversationContext: chatHistory,
  salesMethodology: ['challenger', 'meddic'],
  priorityInsights: ['pain_points', 'timing_indicators'],
  outputFormat: 'conversation_ready'
});
```

### **Real-Time Processing**

#### **Streaming Intelligence Updates**
```typescript
// Real-time intelligence streaming
const intelligenceStream = mcpRegistry.createIntelligenceStream({
  prospectId: 'prospect-123',
  updateFrequency: 'hourly',
  sources: ['bright-data', 'web-search', 'apify'],
  triggers: ['news_mentions', 'job_changes', 'company_updates']
});

intelligenceStream.on('update', (newIntelligence) => {
  // Update SAM's knowledge base in real-time
  updateProspectIntelligence(newIntelligence);
  notifyRelevantUsers(newIntelligence);
});
```

---

## 🔧 Configuration & Setup

### **Environment Variables**

#### **Bright Data Configuration**
```bash
# Bright Data Web Scraping Service
BRIGHT_DATA_USERNAME=your_username
BRIGHT_DATA_PASSWORD=your_password
BRIGHT_DATA_ENDPOINT=https://brightdata-proxy.com
BRIGHT_DATA_ORG_ID=your_org_id
BRIGHT_DATA_USER_ID=your_user_id
```

#### **Apify Platform Configuration**
```bash
# Apify Web Automation Platform
APIFY_API_TOKEN=your_api_token
APIFY_ORG_ID=your_organization_id
APIFY_USER_ID=your_user_id
```

#### **Web Search Configuration**
```bash
# Enhanced Web Search Service
WEB_SEARCH_ORG_ID=your_org_id
WEB_SEARCH_USER_ID=your_user_id
WEB_SEARCH_MAX_RESULTS=50
WEB_SEARCH_TIMEOUT=30000
```

### **API Endpoints**

#### **MCP Service Management**
```typescript
// Get available MCP tools
GET /api/mcp/tools
Response: Array<MCPTool>

// Call specific MCP tool
POST /api/mcp/call
Body: {
  server: string;
  tool: string;
  arguments: Record<string, any>;
}
Response: MCPCallToolResult

// Get server status
GET /api/mcp/status
Response: Array<ServerStatus>
```

#### **Prospect Intelligence API**
```typescript
// Generate prospect intelligence
POST /api/sam/prospect-intelligence
Body: {
  type: 'profile_research' | 'company_intelligence' | 'social_selling_prep';
  source: 'bright_data' | 'apify' | 'web_search';
  request: IntelligenceRequest;
  methodology?: 'challenger' | 'spin' | 'meddic';
}
Response: ProspectIntelligence
```

---

## 📈 Performance & Optimization

### **Caching Strategy**

#### **Intelligence Data Caching**
```typescript
interface IntelligenceCache {
  prospectId: string;                     // Prospect identifier
  data: ProspectIntelligence;            // Cached intelligence
  lastUpdated: string;                   // Cache timestamp
  expiresAt: string;                     // Expiration time
  sources: string[];                     // Data sources used
  version: string;                       // Cache version
}

// Cache configuration
const cacheConfig = {
  profileData: { ttl: 86400000 },       // 24 hours
  companyData: { ttl: 43200000 },       // 12 hours  
  newsData: { ttl: 3600000 },           // 1 hour
  socialData: { ttl: 1800000 }          // 30 minutes
};
```

#### **Request Optimization**
```typescript
// Parallel data fetching
const fetchIntelligence = async (prospectId: string) => {
  const [profileData, companyData, socialData] = await Promise.allSettled([
    mcpRegistry.callTool('bright-data', 'prospect_research', profileRequest),
    mcpRegistry.callTool('web-search', 'company_intelligence', companyRequest),
    mcpRegistry.callTool('apify', 'social_media_monitor', socialRequest)
  ]);

  // Handle partial failures gracefully
  const intelligence = await combineIntelligence({
    profile: profileData.status === 'fulfilled' ? profileData.value : null,
    company: companyData.status === 'fulfilled' ? companyData.value : null,
    social: socialData.status === 'fulfilled' ? socialData.value : null
  });

  return intelligence;
};
```

### **Rate Limiting & Throttling**

#### **Service-Specific Limits**
```typescript
const rateLimits = {
  brightData: {
    requests: 100,                       // Requests per minute
    concurrent: 5,                       // Concurrent requests
    timeout: 30000                       // Request timeout (ms)
  },
  apify: {
    requests: 60,                        // Requests per minute
    concurrent: 3,                       // Concurrent requests
    timeout: 60000                       // Request timeout (ms)
  },
  webSearch: {
    requests: 200,                       // Requests per minute
    concurrent: 10,                      // Concurrent requests
    timeout: 15000                       // Request timeout (ms)
  }
};
```

---

## 🛡️ Security & Compliance

### **Data Protection**

#### **PII Handling**
```typescript
// Sanitize sensitive data before processing
interface DataSanitizer {
  sanitizeProfile(profile: any): SanitizedProfile;
  sanitizeCompany(company: any): SanitizedCompany;
  redactPersonalInfo(data: any): RedactedData;
}

// Example sanitization
const sanitizer = new DataSanitizer();
const cleanData = sanitizer.sanitizeProfile({
  ...rawProfileData,
  email: sanitizer.maskEmail(rawProfileData.email),
  phone: sanitizer.maskPhone(rawProfileData.phone)
});
```

#### **Access Control**
```typescript
// MCP service access permissions
interface MCPPermissions {
  userId: string;
  organizationId: string;
  allowedServices: ('bright-data' | 'apify' | 'web-search')[];
  rateLimit: number;
  dataRetention: number;           // Days to retain data
  piiAccess: boolean;              // PII access permission
}
```

### **Audit Logging**

#### **MCP Call Auditing**
```typescript
interface MCPAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  service: string;
  tool: string;
  arguments: Record<string, any>;     // Sanitized arguments
  response: {
    success: boolean;
    dataPoints: number;               // Number of data points returned
    processingTime: number;           // Processing duration (ms)
  };
  ipAddress: string;
  userAgent: string;
}
```

---

## 🚨 Error Handling & Monitoring

### **Service Health Monitoring**

#### **MCP Server Health Checks**
```typescript
// Periodic health checks for all MCP services
const healthCheck = async (): Promise<ServiceHealth> => {
  const services = await Promise.allSettled([
    mcpRegistry.checkServiceHealth('bright-data'),
    mcpRegistry.checkServiceHealth('apify'),
    mcpRegistry.checkServiceHealth('web-search')
  ]);

  return {
    brightData: services[0].status === 'fulfilled' ? services[0].value : 'failed',
    apify: services[1].status === 'fulfilled' ? services[1].value : 'failed',
    webSearch: services[2].status === 'fulfilled' ? services[2].value : 'failed',
    timestamp: new Date().toISOString()
  };
};
```

#### **Graceful Degradation**
```typescript
// Handle service failures gracefully
const getProspectIntelligence = async (request: IntelligenceRequest) => {
  try {
    // Try primary service (Bright Data)
    return await mcpRegistry.callTool('bright-data', 'prospect_research', request);
  } catch (brightDataError) {
    console.warn('Bright Data unavailable, falling back to Apify');
    
    try {
      // Fallback to Apify
      return await mcpRegistry.callTool('apify', 'linkedin_scraper', adaptRequest(request));
    } catch (apifyError) {
      console.warn('Apify unavailable, using web search only');
      
      // Final fallback to web search
      return await mcpRegistry.callTool('web-search', 'company_intelligence', request);
    }
  }
};
```

### **Error Recovery Strategies**

#### **Retry Logic with Exponential Backoff**
```typescript
const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000,                      // 1 second base delay
  maxDelay: 10000,                      // 10 second max delay
  exponentialBackoff: true,
  retryableErrors: [
    'RATE_LIMITED',
    'TEMPORARY_UNAVAILABLE',
    'NETWORK_ERROR'
  ]
};
```

---

## 🔮 Advanced Features

### **AI-Powered Insights**

#### **Pattern Recognition**
```typescript
// Identify patterns in prospect behavior and company trends
interface PatternAnalysis {
  prospectPatterns: {
    jobChangeFrequency: number;         // Career mobility indicator
    industryFocus: string[];            // Industry expertise areas
    companyStagePreference: string[];   // Preferred company stages
    networkStrength: number;            // Professional network score
  };
  companyPatterns: {
    growthTrajectory: 'accelerating' | 'stable' | 'declining';
    investmentStage: string;            // Funding stage
    technologyAdoption: string[];       // Tech stack evolution
    marketPosition: 'leader' | 'challenger' | 'niche';
  };
}
```

#### **Predictive Scoring**
```typescript
// AI-powered lead scoring and timing predictions
interface PredictiveInsights {
  leadScore: number;                    // 0-100 lead quality score
  timingScore: number;                  // 0-100 timing opportunity score
  conversionProbability: number;        // Predicted conversion rate
  optimalContactTime: string;           // Best time to reach out
  recommendedApproach: 'direct' | 'warm_introduction' | 'content_first';
  keyInfluencers: string[];            // Decision influencers
}
```

### **Custom Intelligence Workflows**

#### **Workflow Builder**
```typescript
// Define custom intelligence gathering workflows
interface IntelligenceWorkflow {
  name: string;
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  outputs: WorkflowOutput[];
}

interface WorkflowStep {
  id: string;
  type: 'data_collection' | 'analysis' | 'enrichment' | 'scoring';
  service: string;                      // MCP service to use
  tool: string;                         // Specific tool
  config: Record<string, any>;          // Step configuration
  dependencies: string[];               // Previous step dependencies
}
```

---

## 📚 Integration Examples

### **Complete Prospect Research Workflow**

```typescript
// End-to-end prospect intelligence generation
const generateComprehensiveIntelligence = async (
  prospectUrl: string,
  companyName: string
) => {
  // Step 1: Initialize MCP registry
  const mcp = new MCPRegistry();
  await mcp.initialize(mcpConfig);

  // Step 2: Gather prospect data
  const prospectData = await mcp.callTool('bright-data', 'prospect_research', {
    profileUrls: [prospectUrl],
    depth: 'comprehensive'
  });

  // Step 3: Gather company intelligence
  const companyData = await mcp.callTool('web-search', 'company_intelligence', {
    query: `${companyName} recent news funding technology stack`,
    searchType: 'company_intelligence',
    maxResults: 20
  });

  // Step 4: Perform social listening
  const socialData = await mcp.callTool('apify', 'social_media_monitor', {
    searchUrl: `https://linkedin.com/company/${companyName}`,
    extractEmails: false,
    waitForResults: true
  });

  // Step 5: Generate MEDDIC scoring
  const meddic = await generateMEDDICScore({
    prospect: prospectData,
    company: companyData,
    social: socialData
  });

  // Step 6: Create conversation starters
  const starters = await generateConversationStarters({
    intelligence: { prospect: prospectData, company: companyData },
    methodology: 'challenger',
    approach: 'insight_first'
  });

  // Step 7: Compile final intelligence
  return {
    prospect: prospectData.content[0],
    company: companyData.content[0],
    insights: {
      meddic,
      conversationStarters: starters,
      strategicInsights: await generateStrategicInsights({
        data: { prospect: prospectData, company: companyData },
        methodology: ['challenger', 'spin']
      })
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      sources: ['bright-data', 'web-search', 'apify'],
      confidence: calculateConfidenceScore([prospectData, companyData, socialData])
    }
  };
};
```

---

## 📋 Troubleshooting Guide

### **Common Issues**

#### **1. Service Authentication Failures**
```bash
# Check environment variables
echo $BRIGHT_DATA_USERNAME
echo $APIFY_API_TOKEN
echo $WEB_SEARCH_ORG_ID

# Test service connectivity
curl -H "Authorization: Bearer $APIFY_API_TOKEN" \
     https://api.apify.com/v2/users/me
```

#### **2. Rate Limiting Issues**
```typescript
// Implement proper rate limiting
const rateLimiter = new RateLimit({
  service: 'bright-data',
  requests: 100,
  window: 60000,                        // 1 minute window
  strategy: 'sliding_window'
});

await rateLimiter.checkLimit(userId);
```

#### **3. Data Quality Issues**
```typescript
// Validate data quality before processing
const validateIntelligence = (data: any): ValidationResult => {
  const errors = [];
  const warnings = [];

  // Check required fields
  if (!data.prospect?.firstName) errors.push('Missing prospect first name');
  if (!data.company?.name) errors.push('Missing company name');
  
  // Check data freshness
  const dataAge = Date.now() - new Date(data.timestamp).getTime();
  if (dataAge > 86400000) warnings.push('Data is over 24 hours old');

  return { errors, warnings, isValid: errors.length === 0 };
};
```

---

## 📚 Related Documentation

### **Internal References**
- [Enterprise Monitoring System](../monitoring/ENTERPRISE_MONITORING_SYSTEM.md)
- [Error Tracking System](../monitoring/ERROR_TRACKING_SYSTEM.md)
- [SAM AI Chat Integration](../sam-ai/SAM_AI_CHAT_INTEGRATION.md)
- [API Documentation](../api/API_INTEGRATION_GUIDE.md)

### **External Resources**
- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Bright Data API Documentation](https://docs.brightdata.com/)
- [Apify Platform Documentation](https://docs.apify.com/)
- [MEDDIC Sales Methodology](https://www.meddic.com/)

---

**Last Updated**: September 12, 2025  
**Next Review**: October 12, 2025  
**Document Version**: 1.0.0  
**Status**: Production Ready ✅