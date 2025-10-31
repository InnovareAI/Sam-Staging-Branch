# Data Field Analysis - Sam to Database Pipeline

**Date:** October 31, 2025
**Issue:** Verify all required fields are captured and handle Classic API limitations

---

## Data Flow Pipeline

```
SAM Chat
  ↓
/api/sam/find-prospects (POST)
  ↓
/api/linkedin/search/simple (POST)
  ↓
Unipile API (Classic or Sales Navigator)
  ↓
prospect_approval_data (JSONB storage)
  ↓
workspace_prospects (flat storage)
```

---

## Required Fields by User

User requested these fields be captured:
1. **First Name** - `firstName`
2. **Last Name** - `lastName`
3. **Company Name** - `company`
4. **LinkedIn URL** - `linkedinUrl`
5. **Market** (Industry) - `industry`

---

## Current Data Mapping

### Stage 1: Unipile API Response → Prospect Object

**File:** `app/api/linkedin/search/simple/route.ts` (lines 695-846)

**Sales Navigator API (structured data):**
```typescript
{
  firstName: item.first_name,           // ✅ AVAILABLE
  lastName: item.last_name,             // ✅ AVAILABLE
  company: item.current_positions[0].company, // ✅ AVAILABLE
  linkedinUrl: item.profile_url,        // ✅ AVAILABLE
  industry: item.current_positions[0].industry || item.industry, // ✅ AVAILABLE
  title: item.current_positions[0].role // ✅ AVAILABLE
}
```

**Classic API (Premium/Free accounts):**
```typescript
{
  firstName: item.first_name || parsed from item.name, // ✅ AVAILABLE
  lastName: item.last_name || parsed from item.name,   // ✅ AVAILABLE
  company: null,                        // ❌ NOT AVAILABLE (currently returns null)
  linkedinUrl: item.profile_url,        // ✅ AVAILABLE
  industry: item.industry,              // ⚠️ SOMETIMES AVAILABLE (not guaranteed)
  title: item.headline                  // ✅ AVAILABLE (but is descriptive text)
}
```

### Stage 2: Prospect Object → prospect_approval_data

**File:** `app/api/linkedin/search/simple/route.ts` (lines 1054-1078)

```typescript
{
  session_id: UUID,
  prospect_id: generated_string,
  name: p.fullName,                     // ✅ firstName + lastName
  title: p.title || '',                 // ✅ Available (headline for Classic)
  company: {                            // JSONB object
    name: p.company || '',              // ❌ '' for Classic API
    size: '',                           // ❌ Always empty
    website: '',                        // ❌ Always empty
    industry: p.industry || ''          // ⚠️ Sometimes empty for Classic
  },
  contact: {                            // JSONB object
    email: '',                          // ❌ Always empty (Unipile doesn't provide)
    linkedin_url: p.linkedinUrl || ''   // ✅ Always available
  },
  location: p.location || '',           // ✅ Available from both APIs
  connection_degree: p.connectionDegree, // ✅ Available
  source: `linkedin_${api}`             // ✅ 'linkedin_classic' or 'linkedin_sales_navigator'
}
```

### Stage 3: prospect_approval_data → workspace_prospects

**File:** `app/api/linkedin/search/simple/route.ts` (lines 881-888)

```typescript
{
  workspace_id: workspaceId,
  first_name: p.firstName,              // ✅ Available
  last_name: p.lastName,                // ✅ Available
  job_title: p.title || null,           // ✅ Available
  company_name: p.company || null,      // ❌ null for Classic API
  linkedin_profile_url: p.linkedinUrl   // ✅ Available
}
```

**⚠️ CRITICAL ISSUE:** Industry/market field is NOT saved to `workspace_prospects`!

---

## Data Availability Matrix

| Field | Sales Navigator | Classic API | Currently Saved? |
|-------|----------------|-------------|------------------|
| **firstName** | ✅ `item.first_name` | ✅ `item.first_name` or parsed | ✅ Yes |
| **lastName** | ✅ `item.last_name` | ✅ `item.last_name` or parsed | ✅ Yes |
| **company** | ✅ `current_positions[0].company` | ❌ NOT AVAILABLE | ⚠️ Yes (but null for Classic) |
| **linkedinUrl** | ✅ `item.profile_url` | ✅ `item.profile_url` | ✅ Yes |
| **industry** (market) | ✅ `current_positions[0].industry` | ⚠️ `item.industry` (not guaranteed) | ❌ **NO - Missing from workspace_prospects!** |
| **title** | ✅ `current_positions[0].role` | ✅ `item.headline` | ✅ Yes |
| **location** | ✅ `item.location` | ✅ `item.location` | ❌ **NO - Missing from workspace_prospects!** |
| **email** | ❌ Not provided | ❌ Not provided | ❌ No |

---

## Issues Identified

### Issue 1: Industry/Market Not Saved to workspace_prospects

**Problem:**
User requested "market" field, which maps to `industry`. Currently:
- ✅ Industry IS extracted from Unipile API
- ✅ Industry IS saved to `prospect_approval_data.company.industry` (JSONB)
- ❌ Industry IS NOT saved to `workspace_prospects` table

**Impact:**
Campaigns cannot use industry/market for personalization or filtering.

**Solution:**
Add `industry` column to `workspace_prospects` table insert.

### Issue 2: Location Not Saved to workspace_prospects

**Problem:**
Location is extracted but only saved to `prospect_approval_data`, not `workspace_prospects`.

**Solution:**
Add `location` column to `workspace_prospects` table insert.

### Issue 3: Classic API Returns Null for Company

**Current Behavior:**
```typescript
company: company || null  // Returns null for Classic API
```

**User Request:**
> "where data is unavailable, because of classic linkedin account, populate field with unavailable"

**Proposed Solution:**
```typescript
// Option 1: String placeholder
company: company || 'unavailable'

// Option 2: More descriptive
company: company || 'Data unavailable - Premium account'

// Option 3: Enrichment prompt
company: company || '[Needs Enrichment]'
```

### Issue 4: Industry Sometimes Empty for Classic API

**Problem:**
Classic API `item.industry` is not guaranteed to be present.

**Proposed Solution:**
```typescript
industry: industry || 'unavailable'
```

---

## Proposed Fixes

### Fix 1: Add Missing Columns to workspace_prospects Insert

**File:** `app/api/linkedin/search/simple/route.ts` (line 881)

**Change from:**
```typescript
const toInsert = validProspects.map((p: any) => ({
  workspace_id: workspaceId,
  first_name: p.firstName,
  last_name: p.lastName,
  job_title: p.title || null,
  company_name: p.company || null,
  linkedin_profile_url: p.linkedinUrl
}));
```

**Change to:**
```typescript
const toInsert = validProspects.map((p: any) => ({
  workspace_id: workspaceId,
  first_name: p.firstName,
  last_name: p.lastName,
  job_title: p.title || null,
  company_name: p.company || 'unavailable',  // Changed: placeholder instead of null
  industry: p.industry || 'unavailable',     // NEW: Save industry/market
  location: p.location || null,               // NEW: Save location
  linkedin_profile_url: p.linkedinUrl
}));
```

### Fix 2: Update prospect_approval_data Company Object

**File:** `app/api/linkedin/search/simple/route.ts` (line 1059)

**Change from:**
```typescript
company: {
  name: p.company || '',
  size: '',
  website: '',
  industry: p.industry || ''
}
```

**Change to:**
```typescript
company: {
  name: p.company || 'unavailable',     // Changed: clear placeholder
  size: '',
  website: '',
  industry: p.industry || 'unavailable'  // Changed: clear placeholder
}
```

### Fix 3: Update Prospect Object Return

**File:** `app/api/linkedin/search/simple/route.ts` (line 838)

**Change from:**
```typescript
return {
  firstName,
  lastName,
  fullName: `${firstName} ${lastName}`,
  title,
  company: company || null,
  industry,
  location,
  linkedinUrl,
  connectionDegree,
  needsEnrichment: !company || company.length < 2,
  apiType: api,
  headline: item.headline || null
};
```

**Change to:**
```typescript
return {
  firstName,
  lastName,
  fullName: `${firstName} ${lastName}`,
  title,
  company: company || 'unavailable',  // Changed: placeholder instead of null
  industry: industry || 'unavailable', // Changed: placeholder instead of empty
  location,
  linkedinUrl,
  connectionDegree,
  needsEnrichment: !company || company === 'unavailable', // Updated logic
  apiType: api,
  headline: item.headline || null
};
```

---

## Database Schema Verification

**Before implementing, verify `workspace_prospects` schema:**

```sql
-- Check current columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'workspace_prospects'
ORDER BY ordinal_position;
```

**Expected columns needed:**
- ✅ `first_name` (text)
- ✅ `last_name` (text)
- ✅ `company_name` (text)
- ✅ `linkedin_profile_url` (text)
- ❓ `industry` (text) - **NEEDS VERIFICATION**
- ❓ `location` (text) - **NEEDS VERIFICATION**
- ✅ `job_title` (text)

---

## BrightData Enrichment Option

**User Request:**
> "alternatively, we can pull the missing data from Brightdata"

### Option 1: Post-Search Enrichment

When `needsEnrichment === true` and `company === 'unavailable'`:

```typescript
// After LinkedIn search completes
if (prospect.needsEnrichment && prospect.linkedinUrl) {
  const enriched = await enrichWithBrightData(prospect.linkedinUrl);
  if (enriched.company) {
    prospect.company = enriched.company;
    prospect.needsEnrichment = false;
  }
}
```

### Option 2: User-Triggered Enrichment

Add enrichment button in approval UI:

```typescript
// In prospect approval interface
async function enrichProspect(prospectId: string) {
  const response = await fetch('/api/prospects/enrich', {
    method: 'POST',
    body: JSON.stringify({ prospectId, source: 'brightdata' })
  });

  // Updates prospect with enriched company data
}
```

### Option 3: Automatic Batch Enrichment

After approval session created:

```typescript
// In /api/linkedin/search/simple
if (needsEnrichmentCount > 0) {
  // Queue background job
  await queueEnrichmentJob({
    sessionId,
    prospectIds: prospects
      .filter(p => p.needsEnrichment)
      .map(p => p.linkedinUrl)
  });
}
```

**Cost Estimate:**
- BrightData LinkedIn profile scrape: ~$0.01 per profile
- 35 prospects needing enrichment = $0.35 per search

---

## Recommended Implementation Plan

### Phase 1: Database Schema (FIRST)

1. ✅ Verify `workspace_prospects` has `industry` column
2. ✅ Verify `workspace_prospects` has `location` column
3. ❌ If missing, add migration

### Phase 2: Update Data Pipeline

1. ✅ Change `null` to `'unavailable'` for missing company
2. ✅ Change empty string to `'unavailable'` for missing industry
3. ✅ Add `industry` to workspace_prospects insert
4. ✅ Add `location` to workspace_prospects insert

### Phase 3: BrightData Integration (Optional)

1. ⏳ Create enrichment API endpoint
2. ⏳ Add enrichment button to approval UI
3. ⏳ Implement automatic enrichment for Classic API results

---

## Testing Checklist

**Test with Sales Navigator Account:**
- [ ] All fields populated (no 'unavailable')
- [ ] Industry saved to database
- [ ] Location saved to database
- [ ] Company name accurate

**Test with Premium/Classic Account:**
- [ ] First name: ✅ Available
- [ ] Last name: ✅ Available
- [ ] Company: Shows 'unavailable'
- [ ] LinkedIn URL: ✅ Available
- [ ] Industry: Shows 'unavailable' OR actual value
- [ ] `needsEnrichment` flag: true

**Test Database Storage:**
```sql
SELECT
  first_name,
  last_name,
  company_name,
  industry,
  location,
  linkedin_profile_url
FROM workspace_prospects
WHERE created_at > NOW() - INTERVAL '1 hour'
LIMIT 5;
```

---

## Next Steps

1. **Verify database schema** - Check if `industry` and `location` columns exist
2. **Implement placeholder changes** - Change `null` to `'unavailable'`
3. **Update insert statements** - Add industry and location to database saves
4. **Test with both account types** - Verify behavior matches expectations
5. **Document enrichment workflow** - Design BrightData integration

---

**Status:** ✅ Analysis Complete - Ready for Implementation
**Last Updated:** October 31, 2025
