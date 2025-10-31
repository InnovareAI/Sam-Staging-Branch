# LinkedIn Account Selection Fix

**Date:** October 31, 2025
**Issue:** Classic LinkedIn API returns incomplete company data
**Fix:** Account validation and prioritization in prospect scraping

---

## Problem

When Premium LinkedIn accounts (not Sales Navigator) were used for prospect scraping via Unipile:

### What Happened:
```javascript
// Unipile Classic API Response (Premium accounts):
{
  "first_name": "Sidnee",
  "last_name": "Pinho",
  "headline": "COO | Strategist | Growth Enabler | M&A | Life Sciences & Healthcare",
  // ❌ NO current_positions field
  // ❌ NO company field
}
```

The enrichment script stored the **headline as the company name**, resulting in:
- **71% of prospects** (35/49) had bad company data
- Examples: "Life Sciences & Healthcare" as company name
- "Unknown Company" for many prospects

### Root Cause:

LinkedIn API types via Unipile:

| Account Type | Unipile API | Company Data? |
|--------------|-------------|---------------|
| Free | Classic | ❌ Headline only |
| Premium Career/Business | Classic | ❌ Headline only |
| **Sales Navigator** | **Sales Nav** | ✅ `current_positions[0].company` |
| **Recruiter** | **Recruiter** | ✅ `current_positions[0].company` |

---

## The Fix

### 1. Account Prioritization (line 234-277)

**File:** `app/api/linkedin/search/simple/route.ts`

Changed from:
```javascript
// OLD: Use first available account
for (const dbAccount of ownAccounts) {
  const unipileAccount = allLinkedInAccounts.find(a => a.id === dbAccount.unipile_account_id);
  if (unipileAccount) {
    selectedAccount = unipileAccount;
    break; // Use first one found
  }
}
```

To:
```javascript
// NEW: Prioritize Sales Navigator > Recruiter > Premium
let salesNavAccount = null;
let recruiterAccount = null;
let premiumAccount = null;

for (const dbAccount of ownAccounts) {
  const unipileAccount = allLinkedInAccounts.find(a => a.id === dbAccount.unipile_account_id);
  const premiumFeatures = unipileAccount.connection_params?.im?.premiumFeatures || [];

  if (premiumFeatures.includes('sales_navigator')) {
    salesNavAccount = unipileAccount;
  } else if (premiumFeatures.includes('recruiter')) {
    recruiterAccount = unipileAccount;
  } else if (premiumFeatures.includes('premium')) {
    premiumAccount = unipileAccount;
  }
}

// Select best available account
selectedAccount = salesNavAccount || recruiterAccount || premiumAccount;
```

### 2. Classic API Validation (line 284-302)

**Added blocking validation:**

```javascript
// Determine API type
const premiumFeatures = selectedAccount.connection_params?.im?.premiumFeatures || [];
let api = 'classic';
if (premiumFeatures.includes('recruiter')) {
  api = 'recruiter';
} else if (premiumFeatures.includes('sales_navigator')) {
  api = 'sales_navigator';
}

// ⚠️ VALIDATION: Block Classic API
if (api === 'classic') {
  return NextResponse.json({
    success: false,
    error: 'LinkedIn account requires Sales Navigator or Recruiter for prospect scraping',
    details: {
      issue: 'Classic LinkedIn API only returns headline text, not structured company data',
      account: selectedAccount.name,
      premiumFeatures: premiumFeatures,
      required: 'sales_navigator or recruiter',
      solution: 'Please select an account with Sales Navigator or Recruiter, or upgrade this account'
    }
  }, { status: 400 });
}
```

---

## Impact

### Before Fix:
- Any Premium account could be used for scraping
- First available account selected (might be Classic)
- No validation of API capabilities
- **Result:** 71% bad company data in campaign

### After Fix:
- ✅ Sales Navigator accounts **prioritized automatically**
- ✅ Classic API accounts **blocked** with clear error message
- ✅ User receives actionable guidance to upgrade account
- ✅ Prevents future campaigns from having bad data

---

## Testing

### Test 1: User has Sales Navigator
**Expected:** Automatically selects Sales Nav account

### Test 2: User has only Premium
**Expected:** API returns 400 error with upgrade instructions

### Test 3: User has both Sales Nav and Premium
**Expected:** Automatically selects Sales Nav (ignores Premium)

---

## Deployment

**File Changed:** `app/api/linkedin/search/simple/route.ts`

**Deployment Steps:**
1. Commit changes to git
2. Push to staging environment
3. Test with sample prospect search
4. Deploy to production
5. Monitor first few campaign creations

**No database migration needed** - this is a code-only fix.

---

## User Communication

### For Users with Only Premium Accounts:

"Your LinkedIn account needs to be upgraded to **Sales Navigator** to use prospect scraping.

**Why:** Premium accounts only provide headline text (like "COO | Healthcare"), not actual company names. Sales Navigator provides structured company data.

**Cost:** ~$100/month for Sales Navigator Professional

**Alternative:** Continue using Premium for messaging, but scrape prospects using a Sales Navigator account."

---

## Account Recommendations

### Current Account Status:

| User | Account Type | Scraping? | Messaging? | Recommendation |
|------|--------------|-----------|------------|----------------|
| **Thorsten** | Sales Navigator | ✅ YES | ✅ YES | Keep - primary scraping account |
| Michelle | Premium | ❌ NO | ✅ YES | Upgrade to Sales Nav OR keep for messaging only |
| Charissa | Premium | ❌ NO | ✅ YES | Upgrade to Sales Nav OR keep for messaging only |
| Irish | Premium | ❌ NO | ✅ YES | Keep for messaging only |
| Noriko | Premium | ❌ NO | ✅ YES | Keep for messaging only |

### Recommendation:
- **Upgrade 1-2 accounts to Sales Navigator** (Michelle and/or Charissa)
- **Reasoning:** Redundancy if Thorsten's account unavailable, higher volume capacity
- **ROI:** Pays for itself if running >1 campaign/month

---

## Related Files

- **Fixed:** `app/api/linkedin/search/simple/route.ts` (lines 234-302)
- **Original Issue Docs:**
  - `/docs/COMPANY_DATA_FIX_OPTIONS.md`
  - `/docs/COMPANY_DATA_INVESTIGATION_COMPLETE.md`
- **Scripts Created:**
  - `/scripts/js/check-sales-nav-accounts.mjs` (to verify account types)
  - `/scripts/js/test-brightdata-scrape-sample.mjs` (BrightData testing)

---

## Monitoring

### Key Metrics to Watch:

1. **Campaign prospect quality:**
   ```sql
   SELECT
     COUNT(*) FILTER (WHERE company_name LIKE '%|%' OR company_name = 'Unknown Company') as bad_count,
     COUNT(*) as total,
     ROUND(COUNT(*) FILTER (WHERE company_name LIKE '%|%' OR company_name = 'Unknown Company')::numeric / COUNT(*) * 100, 1) as bad_percentage
   FROM campaign_prospects
   WHERE created_at > '2025-10-31'
   GROUP BY campaign_id;
   ```

2. **API errors from blocked accounts:**
   - Monitor logs for HTTP 400 responses with "requires Sales Navigator" message
   - Track how many users hit the validation block

3. **Account usage distribution:**
   ```sql
   SELECT
     wa.account_name,
     COUNT(DISTINCT cp.campaign_id) as campaigns_used,
     COUNT(cp.id) as prospects_scraped
   FROM campaign_prospects cp
   JOIN campaigns c ON cp.campaign_id = c.id
   JOIN workspace_accounts wa ON wa.workspace_id = c.workspace_id
   WHERE cp.created_at > '2025-10-31'
   GROUP BY wa.account_name
   ORDER BY prospects_scraped DESC;
   ```

---

## Success Criteria

✅ **Fix is successful if:**
1. No new campaigns have >10% headline-like company names
2. Users with Classic API accounts receive clear error + upgrade path
3. Sales Navigator accounts are automatically preferred when available
4. Thorsten's account used by default when user has mixed account types

---

## Future Enhancements

1. **Account health dashboard:** Show which accounts have Sales Nav/Recruiter
2. **Auto-upgrade prompts:** Suggest upgrading to Sales Nav when creating first campaign
3. **BrightData fallback:** Use BrightData MCP if no Sales Nav accounts available
4. **Multi-account rotation:** Use multiple Sales Nav accounts to bypass LinkedIn rate limits

---

**Status:** ✅ DEPLOYED
**Last Updated:** October 31, 2025
