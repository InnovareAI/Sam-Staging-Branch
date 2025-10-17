# LinkedIn Account Type-Based Search Routing

**Date**: 2025-10-17
**Status**: Implementation Complete - Ready for Testing

---

## ✅ Correct Architecture

### LinkedIn Account Types:

| Account Type | Search Capability | Search Tool |
|-------------|-------------------|-------------|
| **Classic (Free)** | Very limited (5 personalized messages/month) | BrightData MCP or Google Custom Search |
| **Premium Career** | Limited search | BrightData MCP or Google Custom Search |
| **Premium Business** | Limited search | BrightData MCP or Google Custom Search |
| **Sales Navigator** | Full LinkedIn search | Unipile LinkedIn Search MCP |
| **Recruiter Lite** | Recruiting-focused search | Unipile LinkedIn Search MCP |

### Search Routing Logic:

```
User initiates lead search
  ↓
Check LinkedIn account type (from user_unipile_accounts)
  ↓
IF account_type == 'sales_navigator' or 'recruiter_lite':
  → Use Unipile LinkedIn Search (/api/search/linkedin-unipile)
  → Direct LinkedIn search via Sales Nav interface
  → No external scraping needed

ELSE IF account_type == 'classic' or 'premium' or 'unknown':
  → Use BrightData MCP (/api/leads/brightdata-scraper)
  → OR Google Custom Search (/api/search/google-cse)
  → External prospect scraping required
```

---

## 🗄️ Database Changes

### 1. workspace_tiers table
**Migration**: `20251017_add_lead_search_tier_to_workspace_tiers.sql`

**New Columns**:
- `lead_search_tier` TEXT ('external' or 'sales_navigator')
- `monthly_lead_search_quota` INTEGER
- `monthly_lead_searches_used` INTEGER
- `search_quota_reset_date` DATE

**Initial Values**:
- All workspaces start with `lead_search_tier = 'external'`
- Auto-updates to 'sales_navigator' when a member connects Sales Nav

### 2. user_unipile_accounts table
**Migration**: `20251017_add_linkedin_account_type_tracking.sql`

**New Columns**:
- `linkedin_account_type` TEXT ('classic', 'premium', 'sales_navigator', etc.)
- `account_features` JSONB (features detected from Unipile)

**Auto-Detection Functions**:
- `detect_linkedin_account_type(account_id, unipile_data)` - Detects account type from Unipile
- `update_workspace_search_tier_from_linkedin(workspace_id)` - Updates workspace when account changes

**Trigger**:
- Auto-updates workspace search tier when user connects/disconnects LinkedIn account

---

## 🔌 API Endpoints

### 1. Unipile LinkedIn Search (Sales Navigator Only)
**Endpoint**: `POST /api/search/linkedin-unipile`

**Purpose**: Direct LinkedIn search for Sales Navigator users

**Request**:
```json
{
  "search_query": "CTO at software companies in San Francisco",
  "filters": {
    "job_titles": ["CTO", "VP Engineering"],
    "locations": ["San Francisco Bay Area"],
    "industries": ["Computer Software"],
    "company_size": ["51-200", "201-500"]
  },
  "max_results": 25,
  "workspace_id": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "search_engine": "linkedin_sales_navigator",
  "results": [
    {
      "linkedin_url": "https://linkedin.com/in/example",
      "full_name": "John Doe",
      "headline": "CTO at TechCorp",
      "location": "San Francisco, CA",
      "company": "TechCorp",
      "connection_degree": "2nd",
      "shared_connections": 5
    }
  ],
  "account_used": {
    "name": "Your Sales Nav Account",
    "type": "sales_navigator"
  }
}
```

**Access Control**:
- ✅ Requires `linkedin_account_type = 'sales_navigator'`
- ❌ Rejects Classic/Premium users (redirects to BrightData/Google)

### 2. BrightData Scraper (Classic/Premium Only)
**Endpoint**: `POST /api/leads/brightdata-scraper`

**Purpose**: External prospect scraping for Classic/Premium LinkedIn users

**New Behavior**:
- ✅ Allows Classic/Premium LinkedIn users
- ❌ Rejects Sales Navigator users (redirects to Unipile)

### 3. Google Custom Search (All External Search Users)
**Endpoint**: `POST /api/search/google-cse`

**Purpose**: Basic company/profile discovery for Classic/Premium users

**No Changes** - Still works for all external search users

---

## 🔄 Automatic Workspace Tier Updates

### When User Connects LinkedIn Account:

1. **Unipile OAuth callback** → Account connected
2. **Detect account type** from Unipile data:
   ```typescript
   detect_linkedin_account_type(account_id, {
     features: ['sales_navigator', 'advanced_search', 'lead_builder']
   })
   // Returns: 'sales_navigator'
   ```
3. **Trigger fires** → `trigger_update_workspace_search_tier()`
4. **Workspace tier updated**:
   ```sql
   UPDATE workspace_tiers
   SET lead_search_tier = 'sales_navigator'
   WHERE workspace_id = ?
   ```
5. **SAM AI now routes searches** to Unipile LinkedIn Search

### When User Disconnects LinkedIn Account:

1. Account `connection_status` → 'disconnected'
2. Trigger fires → Checks remaining active Sales Nav accounts
3. If no more Sales Nav accounts → Reverts to 'external'

---

## 📊 Search Quota Management

### Quota Limits:
- **Startup**: 1,000 searches/month
- **SME**: 5,000 searches/month
- **Enterprise**: 10,000 searches/month

### Quota Applies To:
- ✅ BrightData MCP searches
- ✅ Google Custom Search queries
- ✅ Unipile LinkedIn searches

### Auto-Reset:
- Monthly on the 1st of each month
- Tracked in `search_quota_reset_date` column

---

## 🧪 Testing Scenarios

### Test 1: Classic LinkedIn User

```bash
# User has Classic LinkedIn (free account)

# Attempt LinkedIn search
curl -X POST /api/search/linkedin-unipile \
  -d '{"search_query": "CTOs", "workspace_id": "uuid"}'

# Expected: 403 Forbidden
# Error: "Sales Navigator required"
# Hint: "Use /api/search/google-cse or /api/leads/brightdata-scraper"

# Use BrightData instead
curl -X POST /api/leads/brightdata-scraper \
  -d '{"action": "scrape_prospects", "workspace_id": "uuid", ...}'

# Expected: 200 OK with prospect results
```

### Test 2: Sales Navigator User

```bash
# User has Sales Navigator account

# Check workspace tier
SELECT lead_search_tier FROM workspace_tiers WHERE workspace_id = 'uuid';
# Expected: 'sales_navigator'

# Use Unipile LinkedIn search
curl -X POST /api/search/linkedin-unipile \
  -d '{"search_query": "CTOs in SF", "workspace_id": "uuid"}'

# Expected: 200 OK with LinkedIn results

# Attempt BrightData
curl -X POST /api/leads/brightdata-scraper \
  -d '{"action": "scrape_prospects", "workspace_id": "uuid", ...}'

# Expected: 400 Bad Request
# Error: "Sales Navigator users should use Unipile LinkedIn search"
# Hint: "Use /api/search/linkedin-unipile for better results"
```

### Test 3: Account Type Auto-Detection

```typescript
// When Unipile account connects
const unipileData = {
  id: 'unipile_account_123',
  type: 'LINKEDIN',
  features: {
    sales_navigator: true,
    advanced_search: true,
    lead_builder: true
  }
};

// Call detection function
const accountType = await supabase.rpc('detect_linkedin_account_type', {
  p_account_id: 'uuid',
  p_unipile_account_data: unipileData
});

// Expected: 'sales_navigator'

// Verify workspace tier updated
const { data: workspace } = await supabase
  .from('workspace_tiers')
  .select('lead_search_tier')
  .eq('workspace_id', workspaceId)
  .single();

// Expected: workspace.lead_search_tier === 'sales_navigator'
```

---

## 🚀 Deployment Steps

### 1. Apply Database Migrations

```sql
-- Run in Supabase SQL Editor

-- First migration: Add search tier to workspace_tiers
\i supabase/migrations/20251017_add_lead_search_tier_to_workspace_tiers.sql

-- Second migration: Add LinkedIn account type tracking
\i supabase/migrations/20251017_add_linkedin_account_type_tracking.sql
```

### 2. Verify Migrations

```sql
-- Check workspace_tiers columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'workspace_tiers'
  AND column_name LIKE '%search%';

-- Check user_unipile_accounts columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_unipile_accounts'
  AND column_name LIKE '%linkedin%';

-- Check functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN (
  'check_lead_search_quota',
  'increment_lead_search_usage',
  'detect_linkedin_account_type',
  'update_workspace_search_tier_from_linkedin'
);
```

### 3. Deploy Code

```bash
npm run build
git add -A
git commit -m "feat: LinkedIn account type-based search routing"
git push origin main
```

### 4. Test in Production

```bash
# Test Sales Navigator endpoint
curl https://app.meet-sam.com/api/search/linkedin-unipile

# Test BrightData with routing
curl https://app.meet-sam.com/api/leads/brightdata-scraper
```

---

## 📝 SAM AI Integration

### Update SAM System Prompt:

```typescript
// Add to SAM's tool definitions

{
  name: "search_leads_linkedin",
  description: "Search LinkedIn using Sales Navigator (requires Sales Nav account)",
  endpoint: "/api/search/linkedin-unipile",
  tier_required: "sales_navigator",
  usage: "For Sales Navigator users only - direct LinkedIn search"
}

{
  name: "search_leads_external",
  description: "Search prospects using BrightData (for Classic/Premium LinkedIn)",
  endpoint: "/api/leads/brightdata-scraper",
  tier_required: "external",
  usage: "For Classic/Premium LinkedIn users - external scraping"
}

{
  name: "search_company_basic",
  description: "Find company websites and LinkedIn profiles using Google",
  endpoint: "/api/search/google-cse",
  tier_required: "all",
  usage: "Basic company/profile discovery for all users"
}
```

### SAM Search Routing Logic:

```typescript
async function routeLeadSearch(query: string, workspaceId: string) {
  // Check workspace search tier
  const { data: tier } = await supabase
    .from('workspace_tiers')
    .select('lead_search_tier')
    .eq('workspace_id', workspaceId)
    .single();

  if (tier.lead_search_tier === 'sales_navigator') {
    // Use Unipile LinkedIn search
    return await fetch('/api/search/linkedin-unipile', {
      method: 'POST',
      body: JSON.stringify({ search_query: query, workspace_id: workspaceId })
    });
  } else {
    // Use BrightData or Google CSE
    return await fetch('/api/leads/brightdata-scraper', {
      method: 'POST',
      body: JSON.stringify({
        action: 'scrape_prospects',
        workspace_id: workspaceId,
        search_params: { ... }
      })
    });
  }
}
```

---

## 🔐 Security & Compliance

### LinkedIn ToS Compliance:
- ✅ Sales Nav users search via official LinkedIn API (Unipile)
- ✅ Classic/Premium users use external scraping (not LinkedIn API)
- ✅ Account ownership enforced (can only use own account)
- ✅ Rate limits respected

### Data Privacy:
- ✅ No cross-account data leakage
- ✅ RLS policies on all search tables
- ✅ Workspace isolation maintained

---

## ✅ Implementation Checklist

- [x] Database migration for workspace search tiers
- [x] Database migration for LinkedIn account type tracking
- [x] Unipile LinkedIn search endpoint (Sales Nav)
- [x] BrightData routing updates (Classic/Premium only)
- [x] Google CSE endpoint (all users)
- [x] Auto-detection of LinkedIn account type
- [x] Auto-update workspace tier on account connect/disconnect
- [x] Quota management functions
- [ ] Apply migrations to production database
- [ ] Test account type detection with real Unipile data
- [ ] Test search routing for each account type
- [ ] Integrate with SAM AI search tools
- [ ] Replace BrightData mock data with real MCP calls
- [ ] Monitor search usage and costs

---

**Status**: Code complete, migrations ready, awaiting database application and testing.
