# LinkedIn Search Filter Fix - October 14, 2025

## Problem Summary

LinkedIn searches via the Unipile API were not properly respecting location, company, industry, and school filters. The root cause was that these filters require **numeric LinkedIn IDs** rather than plain text strings.

### Examples of the Issue:
- Searching for location "San Francisco" was sending the text "San Francisco" instead of the LinkedIn location ID (e.g., "102277331")
- Company filter for "Microsoft" was sending "Microsoft" instead of company ID "1035"
- This caused the Unipile API to either ignore the filters or return incorrect results

## Solution Implemented

Added proper parameter ID lookup functionality to resolve human-readable names to LinkedIn's internal numeric IDs before making search requests.

### Key Changes Made

#### 1. Added `lookupParameterIds()` Helper Function

**Location:** `app/api/linkedin/search/simple/route.ts` (lines 173-223)

```typescript
async function lookupParameterIds(
  paramType: 'LOCATION' | 'COMPANY' | 'INDUSTRY' | 'SCHOOL',
  keywords: string
): Promise<string[] | null>
```

This function:
- Calls the Unipile search parameters endpoint: `/api/v1/linkedin/search/parameters`
- Searches for matching items by keyword
- Returns an array of LinkedIn numeric IDs
- Returns `null` if no matches found (graceful degradation)
- Includes comprehensive logging for debugging

#### 2. Updated All Filter Implementations

**Modified filters:**
- **Location filter** (lines 254-277)
- **Company filter** (lines 283-312)
- **Industry filter** (lines 314-343)
- **School filter** (lines 345-373)

Each filter now:
1. Looks up the appropriate IDs using `lookupParameterIds()`
2. Formats the IDs correctly based on the LinkedIn API type (Classic, Sales Navigator, or Recruiter)
3. Falls back gracefully if lookup fails (proceeds without that filter)

#### 3. API-Specific Formatting

The implementation correctly handles the different payload formats required by each LinkedIn API type:

**Sales Navigator:**
```json
{
  "location": {
    "include": ["102277331", "90000084"]
  },
  "company": {
    "include": ["1035", "2382910"]
  }
}
```

**Recruiter:**
```json
{
  "location": [
    { "id": "102277331" },
    { "id": "90000084" }
  ],
  "company": [
    { "id": "1035", "priority": "MUST_HAVE", "scope": "CURRENT" }
  ]
}
```

**Classic LinkedIn:**
```json
{
  "location": ["102277331", "90000084"],
  "company": ["1035", "2382910"],
  "industry": ["4", "96"]
}
```

## How It Works - End to End

### User Flow Example

1. **User requests:** "Find prospects in San Francisco at Microsoft"

2. **System extracts search criteria:**
   ```javascript
   {
     location: "San Francisco",
     company: "Microsoft"
   }
   ```

3. **ID Lookup Phase:**
   - Call `lookupParameterIds('LOCATION', 'San Francisco')`
     - Returns: `["102277331"]` (SF Bay Area)
   - Call `lookupParameterIds('COMPANY', 'Microsoft')`
     - Returns: `["1035"]` (Microsoft Corporation)

4. **API Detection:**
   - Checks LinkedIn account capabilities
   - Detects: Sales Navigator account

5. **Payload Construction:**
   ```json
   {
     "api": "sales_navigator",
     "category": "people",
     "location": {
       "include": ["102277331"]
     },
     "company": {
       "include": ["1035"]
     }
   }
   ```

6. **Search Execution:**
   - POST to Unipile: `/api/v1/linkedin/search`
   - Returns only prospects matching the exact location and company

## Logging & Diagnostics

The implementation includes extensive logging at each step:

```
🔍 Looking up LOCATION IDs for: "San Francisco"
🔍 Request URL: https://api6.unipile.com:13443/api/v1/linkedin/search/parameters?...
✅ LOCATION lookup results: { items: [...] }
✅ Found 1 LOCATION ID(s): ["102277331"]
✅ Location filter (Sales Nav): { include: ["102277331"] }
```

### Key Log Messages to Watch For:

- `🔍 Looking up [TYPE] IDs for: "..."` - ID lookup started
- `✅ Found N [TYPE] ID(s): [...]` - Successfully found IDs
- `⚠️ No [TYPE] matches found for "..."` - No matching IDs (filter will be skipped)
- `❌ [TYPE] lookup failed: ...` - API error during lookup
- `✅ [Filter] filter ([API Type]): {...}` - Final filter applied to search

## Testing Instructions

### 1. Test Location Filter

```bash
# Make a search request with location
curl -X POST http://localhost:3000/api/linkedin/search/simple \
  -H "Content-Type: application/json" \
  -d '{
    "search_criteria": {
      "keywords": "software engineer",
      "location": "New York City",
      "connectionDegree": "2nd"
    },
    "target_count": 10
  }'
```

**Expected behavior:**
- Logs should show: `🔍 Looking up LOCATION IDs for: "New York City"`
- Logs should show: `✅ Found N LOCATION ID(s): ["..."]`
- Results should only include prospects from New York City area

### 2. Test Company Filter

```bash
curl -X POST http://localhost:3000/api/linkedin/search/simple \
  -H "Content-Type: application/json" \
  -d '{
    "search_criteria": {
      "keywords": "product manager",
      "company": "Google",
      "connectionDegree": "1st"
    },
    "target_count": 10
  }'
```

**Expected behavior:**
- Logs should show company ID lookup and resolution
- Results should only include current Google employees

### 3. Test Combined Filters

```bash
curl -X POST http://localhost:3000/api/linkedin/search/simple \
  -H "Content-Type: application/json" \
  -d '{
    "search_criteria": {
      "keywords": "VP Sales",
      "location": "San Francisco",
      "company": "Salesforce",
      "industry": "Software",
      "connectionDegree": "2nd"
    },
    "target_count": 25
  }'
```

**Expected behavior:**
- All filter IDs should be looked up and resolved
- Results should match ALL filter criteria

## Supported Parameter Types

The `lookupParameterIds()` function currently supports:

| Parameter Type | Example Input | Example Output |
|---------------|---------------|----------------|
| `LOCATION` | "San Francisco" | `["102277331"]` |
| `COMPANY` | "Microsoft" | `["1035"]` |
| `INDUSTRY` | "Software" | `["4"]` |
| `SCHOOL` | "Stanford University" | `["20074"]` |

### Additional Parameter Types Available

According to the Unipile API documentation, these additional types can be added in the future if needed:

- `JOB_TITLE` - Job title/role IDs
- `DEPARTMENT` - Department/function IDs
- `SKILL` - Skill IDs
- `TECHNOLOGIES` - Technology IDs
- `POSTAL_CODE` - Postal code IDs
- `PEOPLE` - Person/profile IDs
- `GROUPS` - LinkedIn group IDs
- `SAVED_SEARCHES` - Saved search IDs
- `RECENT_SEARCHES` - Recent search IDs

## Error Handling & Graceful Degradation

The implementation includes multiple layers of error handling:

### 1. Lookup Failures
If ID lookup fails (network error, API error, no matches):
- Warning is logged
- Search proceeds **without** that specific filter
- Other filters still applied

### 2. Partial Matches
If lookup returns multiple IDs:
- Takes top 5 matches (configurable via `limit` parameter)
- Uses all returned IDs in the filter

### 3. API Type Mismatches
If the LinkedIn account type changes:
- Automatically detects current API type
- Formats payload accordingly
- No manual configuration needed

## Performance Considerations

### ID Lookup Overhead

Each filter that requires ID lookup adds one additional API call:
- **Typical overhead:** 200-500ms per lookup
- **Max concurrent lookups:** 4 (location, company, industry, school)
- **Total added latency:** ~1-2 seconds for searches with multiple filters

### Optimization Opportunities (Future)

1. **Caching:** Cache commonly used IDs (e.g., major cities, Fortune 500 companies)
   ```javascript
   const locationCache = {
     "San Francisco": ["102277331"],
     "New York City": ["102571732"],
     // ...
   };
   ```

2. **Batch Lookups:** Combine multiple parameter lookups into single API call if Unipile supports it

3. **Pre-warming:** Populate cache on server startup with most common filters

## Connection Degree Filter (Already Fixed)

The connection degree filter was also fixed in previous commits to use the correct field names:

- **Sales Navigator & Recruiter:** `network_distance: [1, 2, 3]` (numeric array)
- **Classic LinkedIn:** `network: ['F', 'S', 'O']` (letter codes)

This ensures that connection degree filtering works correctly across all LinkedIn account types.

## Verification Checklist

After deployment, verify:

- [ ] Location filters return geographically correct results
- [ ] Company filters return only employees of specified companies
- [ ] Industry filters return prospects from correct industries
- [ ] School filters return alumni from specified schools
- [ ] Connection degree filters work (1st, 2nd, 3rd)
- [ ] Logs show successful ID lookups
- [ ] Failed lookups degrade gracefully (proceed without filter)
- [ ] Multiple filters work together correctly
- [ ] All three API types work (Classic, Sales Nav, Recruiter)

## Rollback Plan

If issues arise, the fix can be rolled back with:

```bash
git revert c312ade
npm run build
# Deploy
```

The system will revert to sending plain text filters (which will be ignored by Unipile but won't cause errors).

## Related Issues & Context

- **Original Issue:** LinkedIn searches returning wrong connection degrees and ignoring location filters
- **Root Cause:** Unipile API requires numeric IDs for most filters, not plain text
- **Discovery:** Found through API documentation review and request/response logging
- **Previous Fixes:** Connection degree filter fix (numeric vs letter codes)

## Files Modified

```
app/api/linkedin/search/simple/route.ts
  - Added lookupParameterIds() function
  - Updated location filter implementation
  - Updated company filter implementation
  - Updated industry filter implementation
  - Updated school filter implementation
  - Added comprehensive logging throughout
```

## Next Steps

1. **Monitor Logs:** Watch for successful ID lookups in production
2. **Verify Results:** Confirm search results match filter criteria
3. **Performance Monitoring:** Track latency impact of ID lookups
4. **Consider Caching:** If performance becomes an issue, implement ID caching
5. **Add More Filters:** Extend to support job titles, skills, technologies as needed

## Reference: Unipile API Endpoints Used

### Search Parameters Endpoint
```
GET /api/v1/linkedin/search/parameters?account_id={id}&type={TYPE}&keywords={keyword}&limit={N}
```

**Returns:**
```json
{
  "items": [
    {
      "id": "102277331",
      "name": "San Francisco Bay Area",
      "type": "LOCATION"
    }
  ]
}
```

### LinkedIn Search Endpoint
```
POST /api/v1/linkedin/search?account_id={id}&limit={N}
```

**Accepts:**
```json
{
  "api": "sales_navigator",
  "category": "people",
  "location": { "include": ["102277331"] },
  "company": { "include": ["1035"] }
}
```

---

**Fix Completed:** October 14, 2025  
**Commit:** c312ade  
**Status:** Deployed and Ready for Testing
