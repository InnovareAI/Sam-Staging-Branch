# MCP Credential Setup Summary - Bright Data & Apify Upgrades

**Date:** 2025-09-29  
**Site:** sam-new-sep-7 (app.meet-sam.com)  
**Status:** ✅ Apify Configured | 🔄 Bright Data Using Managed Endpoint

## Overview

**UPDATED:** Bright Data now uses a **managed MCP endpoint via SSE** (https://mcp.brightdata.com/sse?token=...). The local Bright Data MCP server has been disabled.

Apify MCP has been upgraded to use live API integration via Apify's REST API and requires `APIFY_API_TOKEN`.

## Current State

### ✅ Already Configured
- `APIFY_API_TOKEN`: apify_api_C79mv4dMyUcIJWkEY9c3QG5YvvPUrk3w5OZl ✅
- `UNIPILE_DSN`: api6.unipile.com:13670
- `UNIPILE_API_KEY`: Configured
- `OPENROUTER_API_KEY`: Configured
- `GOOGLE_API_KEY`: Configured (for Google Search)
- `GOOGLE_CSE_ID`: Configured (for Google Search)

### 🔄 Bright Data - Now Using Managed Endpoint
- **Managed MCP Endpoint**: `https://mcp.brightdata.com/sse?token=e8...42`
- **Configuration**: `.mcp.json` (line 4-8)
- **Local server**: DISABLED (no environment variables needed)
- **Legacy credentials** (still present for proxy automation):
  - `BRIGHT_DATA_CUSTOMER_ID`: hl_8aca120e
  - `BRIGHT_DATA_RESIDENTIAL_PASSWORD`: Configured

### ❌ No Longer Required

#### Bright Data API Credentials (Managed Endpoint Replaces These)
~~1. **BRIGHT_DATA_API_TOKEN**~~ - Not needed; managed endpoint handles auth
~~2. **BRIGHT_DATA_DEFAULT_COLLECTOR_ID**~~ - Not needed; managed service
~~3. **BRIGHT_DATA_DEFAULT_WAIT_SECONDS**~~ - Not needed; managed service
~~4. **BRIGHT_DATA_API_BASE_URL**~~ - Not needed; using mcp.brightdata.com

**Note**: The local Bright Data MCP server (`lib/mcp/bright-data-mcp.ts`) is now disabled. If you need a local fallback, re-add these environment variables to re-enable the in-repo server.

### ✅ Apify MCP Configuration Complete
- **APIFY_API_TOKEN**: Configured (added 2025-09-29)
- Used by: Apify MCP server via `@apify/mcp-server-apify@latest`
- Configuration: `.mcp.json` (line 9-16)

2. **APIFY_DEFAULT_ACTOR_ID** (Optional)
   - Purpose: Default actor to use if not specified
   - Used by: `research_linkedin_prospect` tool
   - Format: Actor ID (e.g., `apify/linkedin-profile-scraper`)
   - Recommended: Configure commonly used actor

3. **APIFY_API_BASE_URL** (Optional)
   - Purpose: Override default API base URL
   - Default: https://api.apify.com
   - Only needed for: Custom/enterprise endpoints

#### Supporting Configuration
1. **ORGANIZATION_ID** (Optional)
   - Current: Falls back to 'default-org'
   - Purpose: Organization identifier for MCP configs
   - Recommended: Set to actual org ID

2. **USER_ID** (Optional)
   - Current: Falls back to 'default-user'
   - Purpose: User identifier for MCP configs
   - Recommended: Set to actual user ID

## Architecture Change Summary

### Bright Data: Local → Managed MCP Endpoint
**Previous**: Local MCP server in `lib/mcp/bright-data-mcp.ts` calling Bright Data REST API  
**Current**: Managed MCP endpoint via Server-Sent Events (SSE)  
**URL**: `https://mcp.brightdata.com/sse?token=e8...42`

**Benefits**:
- No local server maintenance
- Bright Data handles authentication, scaling, updates
- No environment variables needed (token in URL)
- SSE for real-time updates

**Configuration**: `.mcp.json` uses `curl` to connect to SSE endpoint

### Apify: Mock → Live REST API
**Previous**: Mock implementation  
**Current**: Live integration via `@apify/mcp-server-apify@latest`  
**Requires**: `APIFY_API_TOKEN` environment variable ✅ **Configured**

## Implementation Details

### Code Changes Made
1. **`lib/mcp/bright-data-mcp.ts`**
   - **STATUS**: DISABLED - Managed endpoint replaces local server
   - Local implementation remains for fallback if needed
   - Proxy automation via `AutoIPAssignmentService` (still uses legacy credentials)

2. **`lib/mcp/apify-mcp.ts`**
   - Removed mock data generation  
   - Added live actor execution via `/v2/acts/{actorId}/runs`
   - Fetches dataset items from Apify datasets
   - Status checks via `/v2/me` endpoint

3. **`lib/mcp/types.ts`**
   - Updated `BrightDataMCPConfig` with `apiToken`, `baseUrl`, `defaultCollectorId`, `defaultWaitSeconds`
   - Updated `ApifyMCPConfig` with `apiToken`, `baseUrl`, `defaultActorId`

4. **`lib/mcp/mcp-registry.ts`** (lines 862-881)
   - Loads credentials from environment variables
   - Creates MCP server configurations
   - Handles optional vs required credentials

### API Endpoints Used

#### Bright Data
- **POST** `https://api.brightdata.com/dca/dataset?id={collectorId}`
  - Launches a new collector run
  - Returns dataset ID for polling
  
- **GET** `https://api.brightdata.com/datasets/v1/{datasetId}/items`
  - Polls for completed dataset items
  - Returns prospect data in JSON/JSONL format

- **GET** `https://api.brightdata.com/dca/collectors`
  - Health check endpoint
  - Lists available collectors

#### Apify
- **POST** `https://api.apify.com/v2/acts/{actorId}/runs?token={token}&wait=true`
  - Executes an actor synchronously
  - Returns run details and dataset ID

- **GET** `https://api.apify.com/v2/datasets/{datasetId}/items?token={token}&format=json`
  - Fetches dataset items from completed run

- **GET** `https://api.apify.com/v2/me?token={token}`
  - Account info and usage limits

## How to Configure

### Step 1: Obtain API Credentials

#### Bright Data
1. Log into Bright Data dashboard
2. Navigate to API Access or Developers section
3. Generate or copy your API token
4. (Optional) Note your collector IDs from the Data Collector section

#### Apify
1. Log into Apify Console (console.apify.com)
2. Navigate to Settings > Integrations > API & Webhooks
3. Copy or create a new API token
4. (Optional) Note actor IDs you want to use (from Apify Store)

### Step 2: Add to Netlify

Use the Netlify CLI to add environment variables:

```bash
# Critical - Bright Data API Token
netlify env:set BRIGHT_DATA_API_TOKEN "your_bright_data_api_token_here" --context all

# Optional - Default Bright Data Collector
netlify env:set BRIGHT_DATA_DEFAULT_COLLECTOR_ID "your_collector_id" --context all

# Optional - Bright Data Wait Timeout (default: 60)
netlify env:set BRIGHT_DATA_DEFAULT_WAIT_SECONDS "90" --context all

# Critical - Apify API Token
netlify env:set APIFY_API_TOKEN "your_apify_token_here" --context all

# Optional - Default Apify Actor
netlify env:set APIFY_DEFAULT_ACTOR_ID "apify/linkedin-profile-scraper" --context all

# Recommended - Organization/User IDs
netlify env:set ORGANIZATION_ID "your_org_id" --context all
netlify env:set USER_ID "your_user_id" --context all
```

### Step 3: Verify Configuration

After adding credentials, verify they're set:

```bash
netlify env:list --context production --json | grep -E "BRIGHT_DATA_API_TOKEN|APIFY_API_TOKEN"
```

### Step 4: Test Integration

1. Trigger a new deployment or manually deploy
2. Test Bright Data MCP:
   ```
   Call the health check tool via chat or API:
   Tool: check_system_health (from bright-data server)
   ```

3. Test Apify MCP:
   ```
   Call the status check tool:
   Tool: check_apify_status (from apify server)
   ```

4. Monitor logs for errors related to missing credentials

## Expected Behavior

### With Credentials Configured ✅
- **Bright Data**: Successfully launches collectors, polls datasets, returns real prospect data
- **Apify**: Successfully runs actors, fetches dataset items, returns scraped data
- **Health Checks**: Return actual account info and available collectors/actors

### Without Credentials ❌
- **Bright Data**: Error: "BRIGHT_DATA_API_TOKEN is not configured"
- **Apify**: Error: "APIFY_API_TOKEN is not configured"
- **Health Checks**: Fail with authentication errors

## Migration Notes

### Legacy Bright Data Credentials Still Needed
The legacy Bright Data credentials are still used for proxy automation:
- `BRIGHT_DATA_CUSTOMER_ID`
- `BRIGHT_DATA_RESIDENTIAL_PASSWORD`

These are used by `AutoIPAssignmentService` for the `auto_assign_proxy_location` tool.

**DO NOT REMOVE** these legacy credentials; they serve a different purpose than the new API token.

### Old Mock Servers
The previous mock implementations have been completely replaced:
- No more fabricated prospect data
- No more simulated API responses
- All calls now go to real Bright Data/Apify APIs

## Next Steps

### ✅ Completed
1. ✅ ~~Configure `BRIGHT_DATA_API_TOKEN`~~ - Using managed endpoint instead
2. ✅ Configure `APIFY_API_TOKEN` - Added to Netlify (all contexts)
3. ✅ Update `.mcp.json` with Bright Data managed endpoint
4. ✅ Document architecture change

### 📝 Immediate Actions
1. **Add Apify token to local `.env.local`**:
   ```bash
   echo 'APIFY_API_TOKEN=apify_api_C79mv4dMyUcIJWkEY9c3QG5YvvPUrk3w5OZl' >> .env.local
   ```

2. **Integrate Bright Data into n8n**:
   - Import Bright Data's official MCP workflow
   - Paste SSE token: `https://mcp.brightdata.com/sse?token=e8...42`
   - Configure webhook/triggers as needed

3. **Trigger deployment to pick up new APIFY_API_TOKEN**:
   ```bash
   git commit --allow-empty -m "Trigger deployment for APIFY_API_TOKEN"
   git push
   ```

### ⚠️ Testing & Validation
4. Test Apify integration via chat/API (after deployment)
5. Test Bright Data managed endpoint via MCP client
6. Monitor logs for first 24-48 hours
7. Verify n8n Bright Data workflow functions correctly

### 🔒 Security & Hardening
8. Proceed with "MCP Credential Hardening" for remaining services:
   - N8N_API_BASE_URL + N8N_API_KEY
   - REACHINBOX_API_KEY + REACHINBOX_API_URL
   - SERP_API_KEY (optional)
   - ORGANIZATION_ID / USER_ID (optional)

### 📦 Optional Enhancements
9. Configure `APIFY_DEFAULT_ACTOR_ID` if using specific actor frequently
10. Set up monitoring/alerting for MCP endpoints
11. Document n8n workflow integration in `/docs/integrations/`

## Troubleshooting

### "BRIGHT_DATA_API_TOKEN is not configured"
- Ensure token is set in Netlify environment variables
- Verify it's set for the correct context (production, deploy-preview, dev)
- Check that deployment picked up the new env vars

### "Bright Data collector run did not return a dataset_id"
- Verify collector ID is correct
- Check Bright Data dashboard for collector status
- Ensure collector is configured to output datasets

### "Apify actor run finished with status FAILED"
- Check Apify actor logs in console
- Verify actor input format matches actor requirements
- Ensure actor is published and accessible

### Timeout Errors
- Increase `BRIGHT_DATA_DEFAULT_WAIT_SECONDS`
- Check Bright Data dashboard for collector run times
- Consider using async pattern (don't wait for results)

## Related Documentation
- `docs/integrations/documentation/APIFY_MCP_SETUP.md`
- `docs/integrations/MCP_INTEGRATION_FRAMEWORK.md`
- `docs/MCP-CONFIGURATION-GUIDE.md`
- `.env.example` - Template for local development

## Contact
For questions about credentials:
- Bright Data: Check your Bright Data dashboard or contact support
- Apify: Check Apify Console or contact support
- Internal: Review MCP implementation code in `lib/mcp/`