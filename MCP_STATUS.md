# MCP Configuration Status - SAM AI

**Last Updated:** 2025-09-29 18:43 UTC  
**Site:** sam-new-sep-7 (app.meet-sam.com)

## ✅ Fully Configured MCP Servers

### 1. Bright Data (Managed Endpoint)
- **Type**: Managed MCP via SSE
- **Endpoint**: `https://mcp.brightdata.com/sse?token=e8...42`
- **Config**: `.mcp.json` (lines 4-8)
- **Status**: ✅ Active
- **Auth**: Token embedded in URL (no env vars needed)
- **Notes**: Legacy proxy credentials still present for `AutoIPAssignmentService`

### 2. Apify
- **Type**: Live REST API via npm package
- **Package**: `@apify/mcp-server-apify@latest`
- **Config**: `.mcp.json` (lines 9-16)
- **Status**: ✅ Configured
- **Netlify**: `APIFY_API_TOKEN` set (all contexts)
- **Local**: Added to `.env.local`
- **Token**: `apify_api_C79mv4dMyUcIJWkEY9c3QG5YvvPUrk3w5OZl`

### 3. Unipile (LinkedIn + Messaging)
- **Type**: Live integration via npm package
- **Package**: `@unipile/mcp-server-unipile@latest`
- **Config**: `.mcp.json` (lines 17-25)
- **Status**: ✅ Configured
- **Env Vars**:
  - `UNIPILE_API_KEY`: Configured
  - `UNIPILE_DSN`: `api6.unipile.com:13670`

### 4. Google Search
- **Type**: Custom integration (internal)
- **Status**: ✅ Configured
- **Env Vars**:
  - `GOOGLE_API_KEY`: Configured
  - `GOOGLE_CSE_ID`: Configured

### 5. OpenRouter (AI Models)
- **Type**: API integration
- **Status**: ✅ Configured
- **Env Var**: `OPENROUTER_API_KEY`

### 6. Postmark (Email)
- **Type**: Live integration via npm package
- **Package**: `@postmarkapp/mcp-server-postmark@latest`
- **Config**: `.mcp.json` (lines 26-33)
- **Status**: ✅ Configured
- **Env Var**: `POSTMARK_SERVER_TOKEN`

### 7. Stripe (Payments)
- **Type**: Live integration via npm package
- **Package**: `@stripe/mcp-server-stripe@latest`
- **Config**: `.mcp.json` (lines 34-41)
- **Status**: ✅ Configured
- **Env Var**: `STRIPE_API_KEY`

## ⚠️ Partially Configured

### Supabase (Database)
- **Status**: ⚠️ Credentials configured, MCP server not in `.mcp.json`
- **Env Vars**:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### ReachInbox (Email Campaigns)
- **Status**: ⚠️ Credentials configured, needs MCP server integration
- **Env Vars**:
  - `REACHINBOX_API_KEY`: 21839670-cb8a-478c-8c07-a502c52c0405 ✅
  - `REACHINBOX_API_URL`: https://api.reachinbox.ai ✅
- **Netlify**: Set (all contexts)
- **Local**: Added to `.env.local`
- **Next Step**: Add to `.mcp.json` or integrate via `lib/mcp/reachinbox-mcp.ts`

## ❌ Not Configured

### N8N (Workflow Automation)
- **Status**: ✅ Configured (2025-09-29)
- **Instance**: https://workflows.innovareai.com
- **Env Vars**:
  - `N8N_API_BASE_URL`: https://workflows.innovareai.com
  - `N8N_API_KEY`: Configured
- **Netlify**: ✅ Set (all contexts)
- **Local**: ✅ Added to `.env.local`
- **Next Step**: Import Bright Data MCP workflow with SSE token

### SerpAPI (Advanced Search)
- **Status**: ❌ Optional, not configured
- **Optional Var**: `SERP_API_KEY`

### Organization/User Tracking
- **Status**: ⚠️ Using defaults
- **Optional Vars**:
  - `ORGANIZATION_ID` (defaults to 'default-org')
  - `USER_ID` (defaults to 'default-user')

## Architecture Notes

### Bright Data Migration
- **Old**: Local MCP server (`lib/mcp/bright-data-mcp.ts`)
- **New**: Managed SSE endpoint
- **Reason**: Reduces maintenance, Bright Data handles scaling/auth
- **Fallback**: Can re-enable local server by setting `BRIGHT_DATA_API_TOKEN`

### Legacy Credentials (Still Needed)
These are NOT replaced by managed endpoint:
- `BRIGHT_DATA_CUSTOMER_ID`: Used for proxy automation
- `BRIGHT_DATA_RESIDENTIAL_PASSWORD`: Used for proxy automation
- Used by: `AutoIPAssignmentService`

### MCP Client Configuration
All MCP servers are configured in `.mcp.json`:
- **Managed services**: Use SSE endpoints (Bright Data)
- **npm packages**: Use `npx` with env vars (Apify, Unipile, Postmark, Stripe)
- **Internal**: Configured via `lib/mcp/mcp-registry.ts`

## Testing Checklist

- [ ] Deploy to pick up `APIFY_API_TOKEN`
- [ ] Test Apify actor execution via chat/API
- [ ] Test Bright Data SSE endpoint connection
- [ ] Integrate Bright Data into n8n workflow
- [ ] Add N8N credentials
- [ ] Add ReachInbox credentials
- [ ] Monitor logs for 24-48 hours
- [ ] Document n8n workflow setup

## Quick Commands

### Check Netlify Env Vars
```bash
netlify env:list --context production --json
```

### Add Missing Credentials
```bash
# N8N
netlify env:set N8N_API_BASE_URL "https://your-n8n.com" --context all
netlify env:set N8N_API_KEY "your_key" --context all

# ReachInbox
netlify env:set REACHINBOX_API_KEY "your_key" --context all
netlify env:set REACHINBOX_API_URL "https://api.reachinbox.ai" --context all

# Optional
netlify env:set SERP_API_KEY "your_key" --context all
netlify env:set ORGANIZATION_ID "your_org_id" --context all
netlify env:set USER_ID "your_user_id" --context all
```

### Trigger Deployment
```bash
git commit --allow-empty -m "Update MCP configuration"
git push
```

## Documentation References

- **Full Setup Guide**: `docs/MCP_CREDENTIAL_SETUP_SUMMARY.md`
- **Bright Data Managed**: `docs/integrations/BRIGHT_DATA_MCP_SETUP.md`
- **Apify Setup**: `docs/integrations/documentation/APIFY_MCP_SETUP.md`
- **MCP Integration Framework**: `docs/integrations/MCP_INTEGRATION_FRAMEWORK.md`
- **MCP Config Guide**: `docs/MCP-CONFIGURATION-GUIDE.md`
- **Environment Template**: `.env.example`
- **MCP Client Config**: `.mcp.json`
- **Registry Implementation**: `lib/mcp/mcp-registry.ts`