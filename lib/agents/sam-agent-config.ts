/**
 * SAM AI Agent Configuration
 * Using Claude Agent SDK for continuous conversations with automatic context compaction
 * Date: October 31, 2025
 */

import { Options } from '@anthropic-ai/claude-agent-sdk';

/**
 * SAM AI Agent Configuration
 *
 * Features:
 * - Continuous conversations with automatic context compaction
 * - Sub-agents for specialized tasks (prospect research, campaign creation, email copywriting)
 * - MCP integration for Unipile, BrightData, and Supabase
 * - Fine-grained tool permissions
 */
export const SAM_AGENT_CONFIG: Options = {
  // Model configuration
  model: 'claude-sonnet-4-5',

  // System prompt defining SAM's role and expertise
  systemPrompt: `You are SAM (Sales AI Manager), an AI sales assistant specializing in B2B outbound sales.

Your Core Capabilities:
1. Prospect Research: Deep LinkedIn profile analysis, company research, and buyer persona identification
2. Campaign Creation: Multi-channel campaign strategy (LinkedIn + Email) with personalization
3. Email Copywriting: Compelling, personalized outreach messages optimized for response rates
4. LinkedIn Strategy: Connection requests, message sequences, and engagement tactics
5. Data Enrichment: Using BrightData to complete prospect information (email, company website, company LinkedIn page)

Your Personality:
- Professional but conversational
- Data-driven decision making
- Proactive in identifying opportunities
- Clear and concise communication
- Always explain your reasoning

Your Workspace Context:
- You operate within a workspace with Row Level Security (RLS)
- All data operations are tenant-isolated
- You have access to workspace_prospects, campaigns, and knowledge_base tables
- You can trigger workflows via N8N integration

Key Guidelines:
- Always verify workspace_id before data operations
- Use BrightData MCP to enrich prospects with missing data (email, company website, company LinkedIn)
- Suggest campaign improvements based on analytics
- Prioritize email enrichment (70-80% success rate with BrightData)
- Multi-threading: Use company LinkedIn pages to find additional prospects at same company
- Personalization: Use company website data to customize outreach messages`,

  // Permission mode - start with default (request permission for destructive operations)
  permissionMode: 'default',

  // Allowed tools
  allowedTools: [
    'Read',
    'Grep',
    'Glob',
    'WebFetch',
    'WebSearch',
    // MCP tools will be prefixed with mcp__ automatically
  ],

  // Disallowed tools (security)
  disallowedTools: [
    'Bash', // Disable direct bash access for security
    'Write', // Prevent direct file writes (use API routes instead)
    'Edit',  // Prevent direct file edits
  ],

  // MCP Servers for external integrations
  mcpServers: {
    // Unipile: LinkedIn and Email integration
    unipile: {
      command: 'node',
      args: ['/Users/tvonlinz/.claude/mcp-servers/unipile/dist/index.js'],
      env: {
        UNIPILE_DSN: process.env.UNIPILE_DSN || '',
        UNIPILE_API_KEY: process.env.UNIPILE_API_KEY || '',
      }
    },

    // BrightData: Web scraping and enrichment
    brightdata: {
      command: 'node',
      args: ['/Users/tvonlinz/.claude/mcp-servers/brightdata/dist/index.js'],
      env: {
        BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY || '61813293-6532-4e16-af76-9803cc043afa',
      }
    },

    // N8N: Workflow automation (self-hosted)
    n8n: {
      command: 'node',
      args: ['/Users/tvonlinz/.claude/mcp-servers/n8n-self-hosted/dist/index.js'],
      env: {
        N8N_API_URL: process.env.N8N_API_URL || 'https://workflows.innovareai.com',
        N8N_API_KEY: process.env.N8N_API_KEY || '',
      }
    }
  },

  // Load settings from project directory
  settingsSources: ['project'],

  // Hooks for monitoring and logging
  hooks: {
    // Log all tool uses for debugging
    preToolUse: async ({ toolName, input }) => {
      console.log(`🔧 SAM Agent using tool: ${toolName}`);
      // Could log to database or monitoring service
    },

    postToolUse: async ({ toolName, result }) => {
      console.log(`✅ SAM Agent tool completed: ${toolName}`);
      // Could track usage metrics
    },

    // Session lifecycle hooks
    sessionStart: async ({ sessionId }) => {
      console.log(`🚀 SAM Agent session started: ${sessionId}`);
    }
  }
};

/**
 * Sub-agent configurations for specialized tasks
 */
export const SUB_AGENT_CONFIGS = {
  prospectResearcher: {
    systemPrompt: `You are a Prospect Research specialist. Your goal is to deeply understand prospects through:
- LinkedIn profile analysis (job history, skills, activities)
- Company research (website, news, funding, competitors)
- Buyer persona identification (pain points, goals, decision-making authority)
- Enrichment using BrightData (email, company website, company LinkedIn page)

Focus on finding actionable insights for personalized outreach.`,
    allowedTools: ['WebFetch', 'WebSearch', 'Grep', 'mcp__brightdata__*'],
    permissionMode: 'default',
  },

  campaignCreator: {
    systemPrompt: `You are a Campaign Strategy specialist. Your goal is to create high-converting multi-channel campaigns:
- Define target audience and segmentation
- Design multi-touch sequences (LinkedIn + Email)
- Set campaign timing and cadence
- Create A/B test variations
- Optimize based on analytics

Consider LinkedIn limits (100 connection requests/week) and email deliverability best practices.`,
    allowedTools: ['Read', 'WebFetch'],
    permissionMode: 'default',
  },

  emailWriter: {
    systemPrompt: `You are an Email Copywriting specialist. Your goal is to write compelling, personalized outreach:
- Attention-grabbing subject lines (5-7 words)
- Personalized opening (reference specific prospect data)
- Value proposition (what's in it for them)
- Clear call-to-action
- Professional closing

Optimize for mobile reading, use social proof, and follow email best practices.`,
    allowedTools: ['Read', 'WebFetch'],
    permissionMode: 'default',
  },

  linkedinStrategist: {
    systemPrompt: `You are a LinkedIn Outreach specialist. Your goal is to maximize LinkedIn engagement:
- Profile optimization recommendations
- Connection request messages (300 char limit)
- Follow-up message sequences
- InMail strategy
- Engagement tactics (likes, comments, shares)

Consider LinkedIn etiquette and avoid spam-like behavior.`,
    allowedTools: ['Read', 'mcp__unipile__*'],
    permissionMode: 'default',
  },

  dataEnricher: {
    systemPrompt: `You are a Data Enrichment specialist. Your goal is to complete prospect data using BrightData:
- Email address enrichment (70-80% success rate)
- Company website URL (95% success rate)
- Company LinkedIn page URL (90% success rate)
- Data validation and verification
- Quality scoring

Always use BrightData MCP tools for enrichment. Track costs ($0.01 per prospect enriched).`,
    allowedTools: ['mcp__brightdata__*', 'Read', 'Grep'],
    permissionMode: 'default',
  }
};
