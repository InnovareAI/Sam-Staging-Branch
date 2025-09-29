# MCP Configuration Guide

## Overview

The SAM project uses two separate MCP configurations to distinguish between development tools and application-internal services.

## Configuration Files

### 1. `.mcp.json` - Application MCPs
Used by the SAM platform at runtime for core functionality.

**Current Application MCPs:**
- **Stripe** - Payment processing integration
- **Postmark** - Email delivery service
- **Unipile** - LinkedIn messaging and account management
- **Apify** - Web scraping and automation

### 2. `.mcp-dev.json` - Development MCPs
Used with OpenAI Codex and Warp terminal for development.

**Current Development MCPs:**
- **supabase** - Database management and operations
- **github** - GitHub repository management  
- **netlify** - Netlify deployment management

**Note:** Since development has moved to OpenAI Codex and Warp, we've simplified the development MCPs to only include essential services. The qa-agent, directory-monitor, and other Claude-specific tools have been removed.

## Internal MCP Registry

The application also has internally implemented MCPs in `lib/mcp/`:

### Data Sources
- **Bright Data MCP** - Web scraping and data extraction
- **Google Search MCP** - Search functionality
- **WebSearch MCP** - Fallback search
- **N8N MCP** - Workflow automation
- **ReachInbox MCP** - Email campaigns
- **Reply Agent MCP** - Automated replies
- **Database MCP** - Database operations

### AI Tools
- **Template MCP** - Message template management
- **GPT5 MCP** - AI-powered optimization (replaced Mistral)
- **Campaign Orchestration MCP** - Campaign management

## Environment Variables

### Application MCPs (.mcp.json)
```bash
# Stripe
STRIPE_API_KEY=sk_test_...

# Postmark
POSTMARK_SERVER_TOKEN=...

# Unipile
UNIPILE_API_KEY=...
UNIPILE_DSN=...

# Apify
APIFY_API_TOKEN=...
```

### Development MCPs (.mcp-dev.json)
```bash
# Supabase
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# GitHub
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...

# Netlify
NETLIFY_ACCESS_TOKEN=...
```

### Internal MCP Registry Environment Variables
```bash
# Bright Data
BRIGHT_DATA_USERNAME=...
BRIGHT_DATA_PASSWORD=...
BRIGHT_DATA_ENDPOINT=brd.superproxy.io
BRIGHT_DATA_PORT=22225

# Google Search
GOOGLE_API_KEY=...
GOOGLE_CSE_ID=...
SERP_API_KEY=... (optional)

# N8N
N8N_API_BASE_URL=...
N8N_API_KEY=...

# ReachInbox
REACHINBOX_API_KEY=...
REACHINBOX_API_URL=...

# Organization
ORGANIZATION_ID=...
USER_ID=...
```

## Usage

### For Development
Development workflow using:
- **OpenAI Codex** - AI-powered code completion and assistance
- **Warp Terminal** - Modern terminal with AI features
- **Development MCPs** - Essential services (Supabase, GitHub, Netlify)

```bash
# Development MCPs are available in .mcp-dev.json
# Application MCPs are in .mcp.json
```

### For Production
Only `.mcp.json` MCPs are used in production. The internal MCP registry handles:
- Data enrichment
- Search functionality
- Email automation
- AI-powered optimization

## Status Check

To check MCP server status programmatically:

```typescript
import { mcpRegistry } from '@/lib/mcp/mcp-registry'

const status = await mcpRegistry.getServerStatus()
console.log(status)
```

## Troubleshooting

### Common Issues

1. **"MCP client failed to start: request timed out"**
   - Check if required environment variables are set
   - Verify API keys are valid
   - Check network connectivity

2. **"MCP server not available"**
   - Ensure the MCP is initialized in the registry
   - Check if the service requires additional configuration

3. **Development MCPs not working**
   - Make sure you're loading `.mcp-dev.json` in your development environment
   - Check file paths for local MCP scripts (qa-agent.js, etc.)

## Adding New MCPs

### For Application Use
1. Add to `.mcp.json`
2. Implement in `lib/mcp/` if custom
3. Add to `mcp-registry.ts`
4. Document required environment variables

### For Development Only
1. Add to `.mcp-dev.json`
2. Document usage in this guide

## Security Notes

- Never commit API keys or tokens
- Use environment variables for all credentials
- Keep `.env.local` in `.gitignore`
- Rotate keys regularly
- Use different keys for development and production