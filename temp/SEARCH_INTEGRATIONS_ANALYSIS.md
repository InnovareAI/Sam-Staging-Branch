# Search Integrations Analysis: Google CSE & BrightData

**Date**: 2025-10-17
**Status**: Partially Implemented (Needs MCP Tool Integration)

---

## Executive Summary

SAM AI has **infrastructure in place** for both Google Custom Search Engine (GSE) and BrightData integrations, but both are currently **using placeholder/mock data** instead of real API calls. The MCP (Model Context Protocol) servers are configured, but the API endpoints need to be updated to actually use the MCP tools.

---

## Current Integration Status

### ✅ **What's Already Built:**

1. **API Endpoints Created:**
   - `/api/leads/brightdata-scraper` - BrightData prospect scraping (366 lines)
   - `/api/prospects/linkedin-search` - LinkedIn search via Apify/BrightData (346 lines)
   - `/api/mcp/health` - Health check for Google CSE

2. **Environment Variables Configured:**
   ```bash
   # Google Custom Search
   GOOGLE_API_KEY=AIzaSyDwI-Wt95javxXSHO5hBSkSKwrIaRi7oTw
   GOOGLE_CSE_ID=4705cf9dd4f714b82

   # BrightData
   BRIGHT_DATA_CUSTOMER_ID=hl_8aca120e
   BRIGHT_DATA_PASSWORD=vokteG-4zibcy-juwrux
   BRIGHT_DATA_ZONE=residential

   # Apify
   APIFY_API_TOKEN=apify_api_C79mv4dMyUcIJWkEY9c3QG5YvvPUrk3w5OZl
   ```

3. **MCP Servers Configured (.mcp.json):**
   - `brightdata` - Bright Data managed MCP via SSE endpoint
   - `apify` - Apify MCP server (@apify/mcp-server-apify@latest)

4. **Data Structures Defined:**
   - `BrightdataSearchParams` interface
   - `BrightdataProspect` interface with enrichment data
   - Prospect transformation and scoring logic

### ⚠️ **What's NOT Working (Using Mock Data):**

1. **BrightData Integration** (`app/api/leads/brightdata-scraper/route.ts`)
   - **Line 133-314**: Returns hardcoded mock prospects (Emily Watson, Michael Chang, Sarah Kim)
   - **Comment on Line 133**: `// TODO: Implement actual Brightdata MCP tool calls here`
   - **Actions available** but all use placeholder data:
     - `scrape_prospects` - Mock data only
     - `scrape_company_employees` - Mock data only
     - `scrape_and_import` - Calls mock scraper
     - `verify_contact_info` - Mock verification results

2. **Google Custom Search**
   - **No dedicated API endpoint** - only health check exists
   - Environment variables configured but not used in prospect discovery
   - Would be useful for finding company websites, contact pages, LinkedIn profiles

3. **Apify LinkedIn Search** (`app/api/prospects/linkedin-search/route.ts`)
   - Code written for Apify actor integration
   - Uses BrightData proxies (line 80-82)
   - **Issue**: Not connected to actual Apify API calls via MCP

---

## Available MCP Tools

### BrightData MCP Server
**Endpoint**: `https://mcp.brightdata.com/sse`
**Status**: Configured ✅
**Capabilities** (from `/api/leads/brightdata-scraper` GET response):
- Multi-source prospect scraping (LinkedIn, Crunchbase, ZoomInfo, Apollo.io)
- Real-time contact verification
- Company employee discovery
- Enriched lead intelligence
- Geographic proxy distribution
- Compliance-first data collection

### Apify MCP Server
**Package**: `@apify/mcp-server-apify@latest`
**Status**: Configured ✅
**Use Cases**:
- LinkedIn profile scraping
- Company page scraping
- Job posting scraping
- Automated web scraping with residential proxies

---

## Implementation Gaps

### 1. BrightData MCP Tool Integration

**Current Code** (line 133):
```typescript
// TODO: Implement actual Brightdata MCP tool calls here
// This should use real Brightdata scraping APIs via MCP tools
// Current implementation uses mock data for testing structure
```

**What Needs to Happen**:
```typescript
// Example of what the real integration should look like:
const mcpClient = await getMCPClient('brightdata');
const prospects = await mcpClient.invokeTool('scrape_linkedin_profiles', {
  search_query: params.search_criteria.keywords,
  filters: {
    job_titles: params.search_criteria.job_titles,
    locations: params.search_criteria.locations,
    industries: params.search_criteria.industries
  },
  max_results: params.scraping_options.max_results,
  proxy_location: geoLocation,
  include_contact_info: params.scraping_options.include_emails
});
```

### 2. Google Custom Search Integration

**Missing**: Dedicated API endpoint for Google CSE
**Should Create**: `/app/api/search/google-cse/route.ts`

**Potential Use Cases**:
- Find company websites from company names
- Discover contact pages and team pages
- Find LinkedIn company pages
- Research industry keywords
- Find news articles about companies/people

**Example Implementation**:
```typescript
// /app/api/search/google-cse/route.ts
export async function POST(req: NextRequest) {
  const { query, type = 'company_website' } = await req.json();

  const searchQuery = type === 'company_website'
    ? `${query} official website`
    : query;

  const response = await fetch(
    `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(searchQuery)}&num=10`
  );

  const data = await response.json();
  return NextResponse.json({ results: data.items });
}
```

### 3. Apify MCP Integration

**Current Issue**: Direct Apify API calls instead of MCP tools

**Should Use**:
```typescript
// Use Apify MCP server instead of direct API calls
const mcpClient = await getMCPClient('apify');
const run = await mcpClient.invokeTool('run_actor', {
  actorId: 'apify/linkedin-profile-scraper',
  input: {
    startUrls: [linkedInSearchUrl],
    proxyConfiguration: {
      useApifyProxy: false,
      proxyUrls: [getBrightDataProxyUrl()]
    }
  }
});
```

---

## Recommended Implementation Plan

### Phase 1: Enable BrightData MCP Tools (HIGH PRIORITY)

**Files to Update**:
1. `/app/api/leads/brightdata-scraper/route.ts`
   - Replace `scrapeProspects()` mock data with real MCP tool calls
   - Replace `scrapeCompanyEmployees()` with MCP tool calls
   - Replace `verifyContactInfo()` with MCP tool calls

2. Create `/lib/mcp/brightdata-client.ts`
   - MCP client wrapper for BrightData tools
   - Tool invocation helpers
   - Error handling and retry logic

**Estimated Effort**: 4-6 hours
**Business Value**: HIGH - Enables real prospect scraping

### Phase 2: Add Google Custom Search Endpoint (MEDIUM PRIORITY)

**Files to Create**:
1. `/app/api/search/google-cse/route.ts`
   - Company website finder
   - LinkedIn company page finder
   - Contact page discovery
   - Industry research tool

2. Update SAM AI prompt to use Google CSE for:
   - "Find the website for [company]"
   - "Search for contact information at [company]"
   - "Find LinkedIn page for [company]"

**Estimated Effort**: 2-3 hours
**Business Value**: MEDIUM - Enhances company research capabilities

### Phase 3: Integrate Apify via MCP (LOW PRIORITY)

**Rationale**: BrightData already provides LinkedIn scraping via MCP. Apify would be redundant unless BrightData fails or rate limits are hit.

**Recommended Approach**: Keep as fallback option

**Files to Update**:
1. `/app/api/prospects/linkedin-search/route.ts`
   - Add Apify MCP as fallback when BrightData unavailable
   - Circuit breaker pattern to switch between services

**Estimated Effort**: 3-4 hours
**Business Value**: LOW - Redundancy/fallback

---

## Cost Breakdown

### BrightData (from mock endpoint response)
- **Per Prospect Scraping**: $0.05 per prospect
- **Proxy Usage**: $0.02 per request
- **Contact Verification**: $0.02 per verification
- **Total per prospect**: ~$0.07

**Example**: 1000 prospects = $70

### Google Custom Search API
- **Free Tier**: 100 queries/day
- **Paid Tier**: $5 per 1000 queries (up to 10k queries/day)
- **Max**: 10,000 queries/day

**Example**: 1000 company searches = $5

### Apify
- **Free Tier**: $5 of platform usage per month
- **LinkedIn Profile Scraper**: ~$0.01-0.03 per profile
- **Pricing**: Pay-as-you-go based on compute units

**Example**: 1000 profiles = $10-30

---

## Current Data Flow (BROKEN)

```mermaid
User Request
    ↓
SAM AI Conversation
    ↓
/api/leads/brightdata-scraper?action=scrape_prospects
    ↓
scrapeProspects() function
    ↓
❌ RETURNS MOCK DATA (Emily Watson, Michael Chang, Sarah Kim)
    ↓
User sees fake prospects
```

## Desired Data Flow (NEEDS IMPLEMENTATION)

```mermaid
User Request
    ↓
SAM AI Conversation
    ↓
/api/leads/brightdata-scraper?action=scrape_prospects
    ↓
scrapeProspects() function
    ↓
✅ Call BrightData MCP Tool
    ↓
BrightData API (real LinkedIn/Crunchbase/ZoomInfo scraping)
    ↓
Transform results to prospect format
    ↓
Save to database (prospects table)
    ↓
Return real prospect data to user
```

---

## Testing the Integrations

### BrightData MCP Health Check
```bash
curl https://mcp.brightdata.com/sse?token=e8*********42
```

### Google Custom Search Test
```bash
curl "https://www.googleapis.com/customsearch/v1?key=AIzaSyDwI-Wt95javxXSHO5hBSkSKwrIaRi7oTw&cx=4705cf9dd4f714b82&q=test&num=1"
```

### Current Mock BrightData Endpoint
```bash
curl -X POST https://app.meet-sam.com/api/leads/brightdata-scraper \
  -H "Content-Type: application/json" \
  -d '{
    "action": "scrape_prospects",
    "search_params": {
      "target_sites": ["linkedin"],
      "search_criteria": {
        "job_titles": ["CTO", "VP Engineering"],
        "industries": ["Software"],
        "locations": ["San Francisco"]
      },
      "scraping_options": {
        "max_results": 10
      }
    }
  }'
```

**Current Result**: Returns 3 hardcoded prospects (Emily Watson, Michael Chang, Sarah Kim)
**Expected After Fix**: Returns real LinkedIn prospects matching criteria

---

## Next Steps

1. **Immediate Action**: Implement BrightData MCP tool calls in `scrapeProspects()` function
2. **Short Term**: Add Google Custom Search endpoint for company discovery
3. **Medium Term**: Test integration with real prospect searches
4. **Long Term**: Add Apify MCP as fallback service

---

## Files Requiring Updates

### Priority 1 (Critical - Enable Real Data)
- ✏️ `/app/api/leads/brightdata-scraper/route.ts` (line 133-314)
- 🆕 `/lib/mcp/brightdata-client.ts` (create new)

### Priority 2 (Enhance Search)
- 🆕 `/app/api/search/google-cse/route.ts` (create new)
- ✏️ `/lib/prompts/sam-system-prompt.ts` (add Google CSE tool)

### Priority 3 (Redundancy)
- ✏️ `/app/api/prospects/linkedin-search/route.ts` (add MCP fallback)
- 🆕 `/lib/mcp/apify-client.ts` (create new)

---

## Questions to Answer

1. **Do we want to prioritize BrightData or Apify for LinkedIn scraping?**
   - Recommendation: BrightData (already has MCP, more comprehensive)

2. **What's the monthly budget for prospect scraping?**
   - BrightData: ~$70 per 1000 prospects
   - Google CSE: ~$5 per 1000 searches

3. **Should Google CSE be used proactively or only on-demand?**
   - Recommendation: On-demand (save API credits)

4. **Do we need contact verification, or just prospect discovery?**
   - BrightData offers both - decide if $0.02/verification is worth it

---

**End of Analysis**
