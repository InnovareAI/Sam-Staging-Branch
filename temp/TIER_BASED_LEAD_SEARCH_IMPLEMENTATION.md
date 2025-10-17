# Tier-Based Lead Search Implementation

**Date**: 2025-10-17
**Status**: Infrastructure Complete - Needs Integration & Testing

---

## ✅ What's Been Implemented

### 1. Database Migration Created
**File**: `supabase/migrations/20251017_add_lead_search_tier_to_workspace_tiers.sql`

**New Columns Added to `workspace_tiers` table:**
- `lead_search_tier` TEXT - Values: 'basic', 'advanced', 'premium'
- `monthly_lead_search_quota` INTEGER - Monthly search limit
- `monthly_lead_searches_used` INTEGER - Current month usage
- `search_quota_reset_date` DATE - Last reset date

**New Database Functions:**
- `check_lead_search_quota(workspace_id)` - Check if workspace has remaining quota
- `increment_lead_search_usage(workspace_id, count)` - Track search usage

**Tier Mapping:**
| Subscription Tier | Search Tier | Monthly Quota | Search Tool |
|-------------------|-------------|---------------|-------------|
| Startup ($99/mo) | basic | 100 searches | Google Custom Search (free tier) |
| SME ($399/mo) | advanced | 1,000 searches | BrightData MCP (real prospects) |
| Enterprise | premium | 5,000 searches | BrightData MCP + custom integrations |

### 2. BrightData MCP Client Wrapper Created
**File**: `lib/mcp/brightdata-client.ts`

**Functions Available:**
```typescript
// Check if BrightData is available
isBrightDataAvailable(): Promise<boolean>

// Search for prospects (advanced/premium tiers only)
searchProspects(params: BrightDataSearchParams): Promise<BrightDataSearchResult>

// Scrape company employees (advanced/premium tiers only)
scrapeCompanyEmployees(companyName: string, filters?: object): Promise<BrightDataSearchResult>

// Verify contact information
verifyContactInfo(prospects: Array<...>): Promise<...>
```

**Key Features:**
- Type-safe interface for BrightData MCP tools
- Standardized prospect data format
- Error handling and fallback logic
- Search metadata tracking

### 3. Google Custom Search API Endpoint Created
**File**: `app/api/search/google-cse/route.ts`

**Endpoint**: `POST /api/search/google-cse`

**Search Types Supported:**
- `general` - General web search
- `company_website` - Find company official websites
- `linkedin_profile` - Find LinkedIn profiles
- `linkedin_company` - Find LinkedIn company pages
- `contact_page` - Find company contact pages

**Request Format:**
```json
{
  "query": "TechForward Inc CEO",
  "search_type": "linkedin_profile",
  "max_results": 10,
  "workspace_id": "uuid"
}
```

**Response Format:**
```json
{
  "success": true,
  "search_type": "linkedin_profile",
  "results": [
    {
      "title": "Emily Watson - CEO at TechForward | LinkedIn",
      "link": "https://linkedin.com/in/emily-watson",
      "snippet": "CEO at TechForward Inc...",
      "display_link": "linkedin.com"
    }
  ],
  "total_results": 5,
  "search_time_ms": 342,
  "search_metadata": {
    "search_engine": "google_custom_search",
    "tier": "basic"
  }
}
```

**Features:**
- Quota checking (blocks if exceeded)
- Usage tracking (increments after successful search)
- Tier validation (rejects advanced/premium tiers, suggests BrightData)
- Rate limit handling

### 4. Infrastructure Files Created
- ✅ Database migration SQL
- ✅ BrightData MCP client wrapper
- ✅ Google Custom Search API endpoint
- ✅ TypeScript interfaces and types

---

## 🚧 What Still Needs to Be Done

### Priority 1: Database Migration
**Action**: Apply the migration to production database

```bash
# Navigate to Supabase dashboard
# SQL Editor → New Query
# Copy contents of: supabase/migrations/20251017_add_lead_search_tier_to_workspace_tiers.sql
# Run the migration
```

**Verification:**
```sql
-- Check new columns exist
SELECT
  workspace_id,
  tier,
  lead_search_tier,
  monthly_lead_search_quota,
  monthly_lead_searches_used
FROM workspace_tiers
LIMIT 5;

-- Test quota checking function
SELECT check_lead_search_quota('your-workspace-uuid');
```

### Priority 2: Replace BrightData Mock Data
**File**: `app/api/leads/brightdata-scraper/route.ts`

**Current State**: Lines 133-314 use mock data (Emily Watson, Michael Chang, Sarah Kim)

**Needs**: Replace with actual BrightData MCP tool calls

**Example Implementation**:
```typescript
// Instead of mock data array, call BrightData MCP
async function scrapeProspects(...) {
  // Check workspace tier and quota
  const { data: quotaCheck } = await supabase.rpc('check_lead_search_quota', {
    p_workspace_id: workspaceId
  });

  if (!quotaCheck.has_quota) {
    return NextResponse.json({
      success: false,
      error: 'Search quota exceeded',
      quota_info: quotaCheck
    }, { status: 429 });
  }

  // For advanced/premium tiers: use BrightData MCP
  if (quotaCheck.search_tier === 'advanced' || quotaCheck.search_tier === 'premium') {
    // TODO: Call actual BrightData MCP tools
    // const mcpClient = await getMCPClient('brightdata');
    // const result = await mcpClient.invokeTool('scrape_linkedin_profiles', {
    //   search_query: params.search_criteria.keywords,
    //   filters: {...},
    //   max_results: params.scraping_options.max_results
    // });
    // return transform(result);
  }

  // For basic tier: redirect to Google Custom Search
  if (quotaCheck.search_tier === 'basic') {
    return NextResponse.json({
      success: false,
      error: 'Please use /api/search/google-cse for Startup tier',
      hint: 'Upgrade to SME or Enterprise for BrightData access'
    }, { status: 403 });
  }
}
```

### Priority 3: Update SAM AI Prompt
**File**: `lib/prompts/sam-system-prompt.ts` (or similar)

**Add Tool Awareness**:
```typescript
// Add to SAM AI's system prompt or tool definitions:
{
  name: "search_leads_basic",
  description: "Search for leads using Google Custom Search (Startup tier only)",
  parameters: {
    query: "Search query",
    search_type: "'company_website' | 'linkedin_profile' | 'linkedin_company' | 'contact_page'"
  },
  endpoint: "/api/search/google-cse",
  tier_required: "basic"
}

{
  name: "search_leads_advanced",
  description: "Search for prospects using BrightData MCP (SME/Enterprise tiers)",
  parameters: {
    search_query: "Keywords to search",
    job_titles: "Array of job titles",
    industries: "Array of industries",
    locations: "Array of locations",
    max_results: "Number (default 10)"
  },
  endpoint: "/api/leads/brightdata-scraper",
  tier_required: "advanced or premium"
}
```

**Add Tier Checking Logic**:
```typescript
// Before invoking search tool, SAM should:
// 1. Fetch workspace tier
const { data: workspace } = await supabase
  .from('workspace_tiers')
  .select('tier, lead_search_tier, monthly_lead_search_quota, monthly_lead_searches_used')
  .eq('workspace_id', workspaceId)
  .single();

// 2. Route to appropriate tool
if (workspace.lead_search_tier === 'basic') {
  // Use Google Custom Search
  await fetch('/api/search/google-cse', {...});
} else {
  // Use BrightData MCP
  await fetch('/api/leads/brightdata-scraper', {...});
}

// 3. Handle quota exceeded gracefully
if (!quotaAvailable) {
  return "You've reached your monthly search limit. Upgrade to Enterprise for 5,000 searches/month.";
}
```

### Priority 4: Testing

**Test Cases:**

1. **Startup Tier (Basic Search)**
   ```bash
   # Should use Google Custom Search
   curl -X POST https://app.meet-sam.com/api/search/google-cse \
     -H "Content-Type: application/json" \
     -d '{
       "query": "TechForward Inc CEO",
       "search_type": "linkedin_profile",
       "workspace_id": "startup-workspace-uuid"
     }'

   # Should return LinkedIn profile URLs
   # Should increment usage counter
   # Should block after 100 searches
   ```

2. **SME Tier (Advanced Search)**
   ```bash
   # Should use BrightData MCP
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
       },
       "workspace_id": "sme-workspace-uuid"
     }'

   # Should return real prospect data (not mock)
   # Should include enrichment data
   # Should block after 1,000 searches
   ```

3. **Quota Exceeded**
   ```bash
   # After exceeding quota
   curl -X POST .../api/search/google-cse \
     -d '{"query": "test", "workspace_id": "over-quota-workspace"}'

   # Should return:
   {
     "success": false,
     "error": "Search quota exceeded",
     "quota_info": {
       "has_quota": false,
       "quota_used": 100,
       "quota_limit": 100,
       "tier": "startup",
       "upgrade_required": true
     }
   }
   ```

4. **SAM AI Integration**
   - Ask SAM to "find CTOs at software companies in San Francisco"
   - SAM should check workspace tier
   - If Startup tier: use Google Custom Search
   - If SME/Enterprise: use BrightData MCP
   - SAM should present results in conversational format

---

## 📊 Cost Breakdown

### Startup Tier (Basic Search)
- **Tool**: Google Custom Search API
- **Quota**: 100 searches/month (free tier)
- **Cost**: $0 (included in free tier)
- **Overage**: $5 per 1,000 additional searches
- **Best For**: Company website discovery, LinkedIn profile search

### SME Tier (Advanced Search)
- **Tool**: BrightData MCP
- **Quota**: 1,000 prospects/month
- **Cost**: ~$70 per 1,000 prospects ($0.07 per prospect)
- **Overage**: $0.07 per additional prospect
- **Best For**: Full prospect scraping with enrichment data

### Enterprise Tier (Premium Search)
- **Tool**: BrightData MCP + custom integrations
- **Quota**: 5,000 prospects/month
- **Cost**: ~$350 per 5,000 prospects ($0.07 per prospect)
- **Overage**: $0.05 per additional prospect (volume discount)
- **Best For**: Large-scale prospecting with custom data sources

---

## 🔒 Security Considerations

1. **Quota Enforcement**:
   - Database functions automatically reset monthly quotas
   - RLS policies prevent quota manipulation
   - Usage tracking at database level (not client-side)

2. **Tier Validation**:
   - API endpoints check workspace tier before executing
   - Reject basic tier attempts to use BrightData
   - Reject advanced tier attempts to use Google CSE (waste of their quota)

3. **MCP Security**:
   - BrightData MCP token stored in env variables
   - Google API key stored in env variables
   - Never expose credentials to client

---

## 📝 Deployment Checklist

- [ ] Apply database migration to production
- [ ] Verify new columns and functions exist
- [ ] Test quota checking function with sample workspace
- [ ] Replace mock data in `/api/leads/brightdata-scraper/route.ts`
- [ ] Update SAM AI prompt with tier-aware search tools
- [ ] Test Google Custom Search endpoint
- [ ] Test BrightData MCP endpoint (when mock data replaced)
- [ ] Test quota enforcement (exceed limit and verify blocking)
- [ ] Update documentation for users about tier-based search
- [ ] Monitor search usage and costs

---

## 🎯 Next Steps

1. **Apply database migration** (run the SQL in Supabase dashboard)
2. **Test quota checking** (`SELECT check_lead_search_quota('workspace-uuid')`)
3. **Replace BrightData mock data** with real MCP tool calls
4. **Update SAM AI** to be tier-aware when searching
5. **Test end-to-end** with Startup and SME tier workspaces

---

## 📞 Questions to Answer

1. **Do we want to auto-upgrade users** when they exceed quota, or hard-block them?
2. **Should we offer overage credits** for one-time searches beyond quota?
3. **What's the default tier** for new workspaces? (Currently: Startup/basic)
4. **Should Enterprise tier include custom data sources** beyond BrightData?

---

**Status**: Infrastructure ready, awaiting integration and testing. Database migration must be applied first before any functionality works.
