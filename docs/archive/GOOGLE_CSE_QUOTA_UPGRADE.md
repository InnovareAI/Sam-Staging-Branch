# Google Custom Search Engine (CSE) Quota Upgrade Guide

## Issue: Fake "Lookalike Data" in ICP Prospect Discovery

**Problem Identified:** October 10, 2025

When SAM performs ICP prospect discovery, users were seeing fake data like:
- "Prospect 1", "Prospect 2", "Prospect 3"
- "TechCorp", "InnovateLabs", "GrowthHub"
- `prospect1@example.com`, `prospect2@example.com`

### Root Cause

**Google CSE API Quota Exhausted**

Production error:
```json
{
  "error": {
    "code": 429,
    "message": "Quota exceeded for quota metric 'Queries' and limit 'Queries per day' of service 'customsearch.googleapis.com'"
  }
}
```

The free tier of Google Custom Search API provides only **100 searches per day**. Once this quota is exceeded:
1. ❌ Google API returns 429 error
2. ❌ Code previously fell back to `generateMockProspects()` silently
3. ❌ Users saw fake prospects instead of real LinkedIn profiles

### Fix Applied

**Code Changes (October 10, 2025):**

1. **Removed Mock Data Fallback**
   - File: `/app/api/prospects/linkedin-search/route.ts`
   - Removed silent fallback to `generateMockProspects()`
   - Now returns proper 503 error with clear message

2. **Enhanced Error Messages**
   - File: `/lib/mcp/google-search-mcp.ts`
   - Added specific error messages for 429 (quota) and 403 (permissions)
   - Includes direct links to Google Cloud Console for fixes

---

## Solution: Upgrade Google CSE Quota

### Option 1: Enable Billing (Recommended)

**Cost:** $5 per 1,000 searches after free 100/day

**Benefits:**
- 10,000 searches per day
- Pay-as-you-go (only pay for what you use)
- Production-grade reliability

**Steps:**

1. **Go to Google Cloud Console**
   ```
   https://console.cloud.google.com/
   ```

2. **Navigate to Billing**
   - Menu → "Billing"
   - Click "Link a billing account" or "Create billing account"
   - Add payment method (credit card)

3. **Enable Billing for Custom Search API**
   - Go to: https://console.cloud.google.com/apis/api/customsearch.googleapis.com
   - Click "Enable Billing" or "Manage"
   - Confirm billing is enabled

4. **Set Budget Alerts (Optional but Recommended)**
   - Go to: https://console.cloud.google.com/billing/
   - Click your billing account → "Budgets & alerts"
   - Create budget alert for $50/month
   - This prevents unexpected costs

5. **Verify Quota Increased**
   ```bash
   curl "https://app.meet-sam.com/api/test/google-search?test=quota"
   ```

   Should show:
   ```json
   {
     "google": {
       "available": true,
       "paidQuota": "10,000 searches/day"
     }
   }
   ```

---

### Option 2: Use SerpAPI (Alternative)

**Cost:** Starts at $50/month for 5,000 searches

**Benefits:**
- More detailed results
- No daily quota (monthly credits)
- Advanced features (location targeting, device emulation)

**Steps:**

1. **Sign up for SerpAPI**
   ```
   https://serpapi.com/users/sign_up
   ```

2. **Get API Key**
   - Dashboard → "API Key"
   - Copy your API key

3. **Add to Netlify Environment Variables**
   ```bash
   netlify env:set SERPAPI_API_KEY "your_api_key_here"
   ```

4. **Update `.env.local` for development**
   ```bash
   SERPAPI_API_KEY=your_api_key_here
   ```

5. **Test SerpAPI**
   ```bash
   curl "https://app.meet-sam.com/api/test/google-search?test=icp"
   ```

---

## Current Status

### Production Environment

**Netlify Variables:**
- ✅ `GOOGLE_API_KEY` - Configured
- ✅ `GOOGLE_CSE_ID` - Configured
- ❌ **Quota:** Free tier (100/day) - **NEEDS UPGRADE**
- ❌ `SERPAPI_API_KEY` - Not configured

**Error Message (as of Oct 10, 2025):**
```
"Google CSE daily quota exceeded (100 free searches/day).
To enable unlimited searches, upgrade at:
https://console.cloud.google.com/apis/api/customsearch.googleapis.com"
```

### Recommended Action

**Enable billing on Google Cloud Platform for Custom Search API**

**Estimated monthly cost:**
- ICP discovery: ~50 searches per session
- Daily usage: ~10 sessions = 500 searches/day
- Monthly searches: ~15,000 searches
- **Estimated cost: $75/month** ($5 per 1,000 after free 100/day)

---

## Testing After Upgrade

### 1. Test Quota Check
```bash
curl "https://app.meet-sam.com/api/test/google-search?test=quota"
```

Expected:
```json
{
  "google": {
    "available": true,
    "paidQuota": "10,000 searches/day"
  }
}
```

### 2. Test ICP Discovery
```bash
curl -X POST https://app.meet-sam.com/api/test/google-search \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "icp_prospect_discovery",
    "arguments": {
      "jobTitles": ["VP Sales", "CRO"],
      "industries": ["SaaS"],
      "companySize": "medium",
      "maxResults": 5
    }
  }'
```

Expected: Real LinkedIn profiles, not fake data

### 3. Test in SAM AI
1. Log into https://app.meet-sam.com
2. Create new ICP discovery session
3. Ask SAM: "Find me 10 VP Sales prospects in SaaS companies"
4. Verify you see **real LinkedIn profiles** not "Prospect 1", "Prospect 2"

---

## Monitoring

### Check Daily Quota Usage

```bash
# Production quota status
curl "https://app.meet-sam.com/api/test/google-search?test=quota"

# Check Google Cloud Console
https://console.cloud.google.com/apis/api/customsearch.googleapis.com/quotas
```

### Set Up Alerts

1. **Budget Alert:** Set in Google Cloud Console
   - Alert at 50% of budget ($25)
   - Alert at 90% of budget ($45)
   - Alert at 100% of budget ($50)

2. **Usage Alert:** Monitor daily search volume
   - Track in Google Cloud Console → Custom Search API → Metrics
   - Review weekly to optimize queries

---

## Alternative: Optimize Query Usage

If budget is a concern, reduce search queries:

**Optimization Strategies:**

1. **Cache Results:** Store LinkedIn profiles for 7 days
2. **Batch Queries:** Combine multiple job titles in one search
3. **Use Unipile Network:** Search existing LinkedIn connections first (free)
4. **Limit ICP Sessions:** Set daily cap on new ICP discoveries

**Implementation:**
- Modify `/lib/mcp/google-search-mcp.ts` to add caching layer
- Use Redis or Supabase for result caching
- Track quota usage per workspace

---

## Contact

**Issue Resolved By:** Claude Code (October 10, 2025)

**Related Files:**
- `/app/api/prospects/linkedin-search/route.ts` - Mock data removed
- `/lib/mcp/google-search-mcp.ts` - Enhanced error messages
- `/app/api/test/google-search/route.ts` - Test endpoints

**Production Error Logs:**
- Netlify Function Logs → Filter for "quota exceeded"
- Google Cloud Console → Logging → Filter for "customsearch.googleapis.com"

---

**Last Updated:** October 10, 2025
**Status:** ⚠️ Quota upgrade needed for production ICP discovery
**Priority:** High - blocking real prospect discovery
