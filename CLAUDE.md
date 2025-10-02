# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 🚨🚨🚨 CRITICAL: READ THIS FIRST - DIRECTORY SAFETY 🚨🚨🚨

### ⛔ ABSOLUTE DIRECTORY RESTRICTION - ZERO TOLERANCE ⛔

**YOU ARE LOCKED TO THIS DIRECTORY ONLY:**
```
/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
```

### 🔴 BEFORE EVERY SINGLE FILE OPERATION:

**1. VERIFY YOUR CURRENT DIRECTORY:**
```bash
pwd  # MUST return: /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
```

**2. IF YOU SEE ANY OTHER PATH - STOP IMMEDIATELY**

**3. NEVER USE THESE COMMANDS:**
- ❌ `cd ..` (goes to parent directory)
- ❌ `cd ~` (goes to home directory)
- ❌ `cd /Users/tvonlinz/Dev_Master` (parent directory)
- ❌ Relative paths that go up: `../../`

**4. BANNED DIRECTORIES - NEVER ACCESS:**
- ❌ `/Users/tvonlinz/Dev_Master/3cubed/` **(killed this project before)**
- ❌ `/Users/tvonlinz/Dev_Master/SEO_Platform/` **(killed this project before)**
- ❌ `/Users/tvonlinz/Dev_Master/sam/` (different project)
- ❌ `/Users/tvonlinz/Dev_Master/` (parent directory)
- ❌ Any path that doesn't contain `Sam-New-Sep-7`

### 🛡️ MANDATORY SAFETY PROTOCOL:

**BEFORE writing, editing, or reading ANY file:**

1. Run `pwd` to verify you're in the correct directory
2. Check the file path contains `/Sam-New-Sep-7/`
3. If unsure, ASK THE USER before proceeding
4. NEVER assume a file location

**Examples of SAFE operations:**
```bash
✅ pwd  # Shows /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
✅ Read /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/package.json
✅ Edit /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/test.ts
✅ ls app/components/  # Relative path within Sam-New-Sep-7
```

**Examples of FORBIDDEN operations:**
```bash
❌ cd /Users/tvonlinz/Dev_Master/3cubed/
❌ Read /Users/tvonlinz/Dev_Master/3cubed/SEO_Platform/package.json
❌ Edit ../../3cubed/file.ts
❌ ls ~/Dev_Master/  # Lists other projects
❌ ANY operation outside Sam-New-Sep-7
```

### ⚠️ IF YOU VIOLATE THIS RULE:

**You have already killed 2 production projects. This is NON-NEGOTIABLE.**

- Session will be immediately terminated
- All work will be rejected
- User will lose trust in AI assistance

### 🔒 SAFETY CHECKLIST - USE THIS EVERY TIME:

```
Before ANY file operation, verify:
□ Current directory is Sam-New-Sep-7 (run pwd)
□ File path contains /Sam-New-Sep-7/
□ Not using cd to navigate elsewhere
□ Not using relative paths that go up (../)
□ When in doubt, ASK before proceeding
```

---

## 🚨 NEW ASSISTANT ONBOARDING

**If you are a new Claude instance, read these files in order:**

1. **THIS SECTION ABOVE** - Directory safety (CRITICAL)
2. **`QUICK_START_GUIDE.md`** - Essential 5-minute overview
3. **`NEW_ASSISTANT_ONBOARDING.md`** - Complete 30-minute onboarding
4. **This file** - Project architecture and development guidelines
5. **`TODO.md`** - Current tasks and priorities

---

## Project Overview

**SAM AI** is a B2B sales automation platform combining AI-powered conversational assistance with multi-channel campaign management (LinkedIn + Email). The system uses a multi-tenant architecture targeting $100M ARR by 2027.

### Core Technology Stack

- **Framework**: Next.js 15.5.2 (App Router) + React 18 + TypeScript
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth with workspace-based multi-tenancy
- **AI/LLM**: OpenRouter API (Claude 3.5 Sonnet primary)
- **Integrations**: Unipile (LinkedIn/Email), N8N (workflow automation)
- **Email**: Postmark (transactional), Unipile/ReachInbox (campaigns)
- **Deployment**: Netlify (frontend/API) + Supabase Cloud

### Production Environment

- **Production**: https://app.meet-sam.com
- **Staging**: https://devin-next-gen-staging.netlify.app
- **Database**: Supabase multi-tenant PostgreSQL
- **Status**: Live with paying customers

---

## Architecture Patterns

### Multi-Tenant Isolation

All data is workspace-isolated using Supabase RLS policies:

```typescript
// CRITICAL: Always use workspace_members, NOT workspace_users
const { data } = await supabase
  .from('workspace_prospects')
  .select('*')
  .eq('workspace_id', workspaceId);
// RLS automatically filters by auth.uid() membership
```

**Key Tables:**
- `workspaces` - Tenant containers
- `workspace_members` - User access control (use this table)
- `workspace_prospects` - CRM contacts
- `campaigns` - Campaign definitions
- `knowledge_base` - RAG knowledge store with vector embeddings

### App Directory Structure

```
app/
├── api/                    # Next.js API routes
│   ├── campaign/          # Campaign execution APIs
│   ├── sam/               # SAM AI conversation APIs
│   ├── workspace/         # Workspace management
│   ├── prospect-approval/ # HITL approval system
│   └── linkedin/          # LinkedIn integration
├── workspace/[workspaceId]/ # Workspace dashboard pages
├── demo/                   # Demo tenant pages
└── providers/              # React context providers

lib/
├── services/              # Business logic services
├── mcp/                   # MCP tool integrations
├── n8n/                   # N8N workflow client
├── ai/                    # AI/LLM utilities
└── supabase-knowledge.ts  # RAG integration

components/                # React components
```

### MCP Integration Pattern

SAM AI uses Model Context Protocol (MCP) for external integrations:

```typescript
// Available MCP tools
mcp__unipile__unipile_get_accounts()        // LinkedIn/email accounts
mcp__unipile__unipile_get_recent_messages() // Message history
mcp__n8n_self_hosted__list_workflows()     // N8N workflows
```

**Configuration**: `.mcp.json` (local dev) and `.mcp-dev.json` (production)

### Campaign Execution Flow

```
1. User creates campaign → `/api/campaign/create`
2. Prospects approved → `/api/prospect-approval/*`
3. N8N workflow triggered → `lib/n8n/n8n-client.ts`
4. Messages sent via Unipile → MCP tools
5. Replies monitored → HITL approval system
6. SAM AI generates responses → `/api/sam/threads`
```

### Knowledge Base (RAG) System

```typescript
// Vector search for SAM AI context
const knowledge = await supabase.rpc('search_knowledge', {
  query_embedding: embedding,
  match_threshold: 0.8,
  match_count: 5,
  workspace_id: workspaceId
});
// Used in SAM conversations for contextual responses
```

**Tables:**
- `knowledge_base` - Main content with vector embeddings
- `knowledge_base_sections` - Organizational hierarchy

---

## Common Development Tasks

### Development Commands

```bash
# Development
npm run dev                    # Start dev server (localhost:3000)
npm run build                  # Production build
npm run lint                   # Run ESLint

# Testing
npm run test:kb-crud          # Test knowledge base CRUD
npm run test:sam-threads      # Test SAM conversations
npm run test:integration      # Integration tests

# Deployment
npm run deploy:staging        # Deploy to staging environment
npm run deploy:production     # Deploy all tenants to production

# Database
npm run seed:kb-simple        # Seed knowledge base
npm run migrate:kb            # Migrate legacy KB

# Monitoring
npm run monitoring:health     # Check production health
npm run monitoring:metrics    # View system metrics
npm run monitoring:alerts     # Check alerts

# Documentation
npm run update-docs           # Auto-update documentation
```

### Running Tests

```bash
# Test LinkedIn integration
node scripts/test-unipile-direct.js

# Test N8N workflows
node scripts/test-n8n-integration.ts

# Test prospect approval
node test-campaign-execution.cjs
```

### Database Operations

**Always test SQL in staging first:**

```bash
# Check current schema
curl https://devin-next-gen-staging.netlify.app/api/admin/check-schema

# Apply migrations via Supabase dashboard SQL editor
# Never run SQL directly in production without validation
```

### Working with MCP Tools

```bash
# Test MCP tool availability
curl http://localhost:3000/api/mcp

# View MCP configuration
cat .mcp.json
```

---

## Critical Development Guidelines

### Multi-Tenant Safety

```typescript
// ✅ CORRECT: Use workspace_members for user access
const { data: members } = await supabase
  .from('workspace_members')
  .select('*, users(*)')
  .eq('workspace_id', workspaceId);

// ❌ WRONG: workspace_users table doesn't exist
const { data } = await supabase
  .from('workspace_users')  // This will fail
  .select('*');
```

### Tier-Based Feature Access

```typescript
// Check workspace tier before enabling features
const { data: tier } = await supabase
  .from('workspace_tiers')
  .select('tier_name, features')
  .eq('workspace_id', workspaceId)
  .single();

// Tier levels: 'startup' ($99), 'sme' ($399), 'enterprise' ($899)
if (tier.tier_name === 'enterprise') {
  // Enable ReachInbox integration
}
```

### API Route Patterns

```typescript
// Standard API route structure
export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });

    // 2. Parse request
    const body = await request.json();

    // 3. Validate workspace access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', body.workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) return new Response('Forbidden', { status: 403 });

    // 4. Execute business logic
    const result = await performAction(body);

    return Response.json(result);
  } catch (error) {
    console.error('API Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
```

### Environment Variables

**Required for development:**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# OpenRouter AI
OPENROUTER_API_KEY=<openrouter_key>

# Postmark Email
POSTMARK_SERVER_TOKEN=<postmark_token>

# Unipile (LinkedIn/Email)
UNIPILE_DSN=<unipile_dsn>
UNIPILE_API_KEY=<unipile_key>

# N8N Workflows
N8N_WEBHOOK_URL=https://workflows.innovareai.com
N8N_API_KEY=<n8n_key>
```

**Never commit `.env.local` or expose service role keys.**

---

## High-Level System Features

### Implemented (85% Complete)

- ✅ Multi-tenant workspace architecture with RLS
- ✅ SAM AI conversational assistant with RAG
- ✅ LinkedIn campaign automation (Unipile integration)
- ✅ Email campaign system (Unipile + ReachInbox)
- ✅ N8N workflow automation integration
- ✅ HITL (Human-in-the-Loop) approval system
- ✅ Prospect management and CRM
- ✅ Knowledge base with vector search
- ✅ Campaign analytics and reporting
- ✅ Workspace member management

### In Progress (10% Complete)

- ⚠️ Advanced AI model configuration
- ⚠️ Mobile application support
- ⚠️ Advanced team collaboration features
- ⚠️ Custom CRM integrations (Salesforce, HubSpot)

### Planned (5% Complete)

- ❌ Billing and subscription management
- ❌ Voice calling integration
- ❌ White-label solutions
- ❌ Enterprise SSO
- ❌ Advanced compliance (HIPAA, SOC2)

---

## Important File References

### Strategic Documentation

- **`/docs/sam-ai/sam-ai-product-development-roadmap.md`** - 3-year product roadmap
- **`/docs/sam-ai/sam-ai-service-model-plans.md`** - Pricing and service tiers
- **`/docs/sam-ai/sam-ai-compliance-framework.md`** - Compliance strategy
- **`/docs/sam-ai/rag-data-storage-strategy.md`** - RAG implementation

### Technical Documentation

- **`SAM_SYSTEM_TECHNICAL_OVERVIEW.md`** - Complete system architecture (1083 lines)
- **`README.md`** - Quick start and deployment guide
- **`TODO.md`** - Current tasks and priorities
- **`DEPLOYMENT_CHECKLIST.md`** - Production deployment steps

### Onboarding

- **`QUICK_START_GUIDE.md`** - 5-minute quick start
- **`NEW_ASSISTANT_ONBOARDING.md`** - 30-minute detailed onboarding

---

## Absolute Guardrails

### Directory Restrictions (CRITICAL - ALREADY COVERED AT TOP)

**See the CRITICAL section at the top of this file for full directory safety protocol.**

**Quick reminder:**
- ✅ ONLY: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7`
- ❌ NEVER: Any other directory
- 🔴 Always run `pwd` before file operations

### Production Safety

- **Always test in staging first** before production changes
- **Never run SQL directly** in production without validation
- **Check workspace tier** before accessing tier-specific features
- **Use MCP tools** for external service integration
- **Verify RLS policies** protect multi-tenant data

### Anti-Hallucination Protocol

**NEVER create fake implementations:**
- ❌ Mock API integrations that appear real
- ❌ Fake data that simulates real services
- ❌ Placeholder code without clear "TODO" markers

**ALWAYS:**
- ✅ State clearly when something is a specification vs implementation
- ✅ Provide real API documentation links
- ✅ Use obvious placeholders: `// TODO: Implement real [SERVICE] integration`

---

## Troubleshooting Common Issues

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run build
```

### Database Connection Issues

```bash
# Test Supabase connection
node -e "const { createClient } = require('@supabase/supabase-js'); \
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, \
  process.env.SUPABASE_SERVICE_ROLE_KEY); \
  supabase.from('workspaces').select('count').then(console.log);"
```

### MCP Tool Failures

```bash
# Check MCP server status
curl http://localhost:3000/api/mcp

# Verify MCP configuration
cat .mcp.json | jq '.mcpServers'
```

### Authentication Issues

- Verify Supabase auth callback URLs in Supabase dashboard
- Check RLS policies allow workspace access
- Ensure middleware.ts allows necessary routes

---

## Key Architecture Decisions

### Why Next.js 15 App Router?

- Server-side rendering for better SEO and performance
- API routes for backend logic without separate server
- Built-in TypeScript support
- Netlify deployment optimization

### Why Supabase?

- PostgreSQL with built-in RLS for multi-tenancy
- Real-time subscriptions for live updates
- Authentication with magic links
- Serverless architecture with automatic scaling
- Vector embeddings for RAG system

### Why MCP (Model Context Protocol)?

- Standardized tool integration for AI systems
- Live data access for SAM AI conversations
- Extensible architecture for new integrations
- Security through controlled tool access

### Why N8N for Campaigns?

- Visual workflow builder for campaign automation
- Self-hosted for data control
- Webhook support for real-time events
- Per-workspace workflow instances
- Complex multi-step campaign sequences

---

## Performance Considerations

### Database Optimization

- Use database indexes on frequently queried columns
- Leverage Supabase views for complex analytics queries
- Implement pagination for large result sets
- Use `select()` to fetch only needed columns

### Caching Strategy

- Next.js automatic caching for static pages
- API response caching with `Cache-Control` headers
- Client-side caching with React Query (future)

### API Rate Limiting

- Unipile: 800 emails/month per account (Startup tier)
- LinkedIn: 100 connection requests/week per account
- OpenRouter: Monitor token usage and costs

---

## Next Steps for New Assistants

1. **Read onboarding docs** (QUICK_START_GUIDE.md, NEW_ASSISTANT_ONBOARDING.md)
2. **Check TODO.md** for current priorities
3. **Test staging environment** to verify access
4. **Review recent git commits** to understand latest changes
5. **Start with highest priority TODO item**

---

**Last Updated**: Auto-generated by `npm run update-docs`
**System Status**: Production (85% complete)
**Target**: $100M ARR by 2027
