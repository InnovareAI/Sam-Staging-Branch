# Google Custom Search API - Quota Increase Request

**Date:** October 10, 2025
**Status:** ⚠️ Billing enabled, but quota still at 100/day default

---

## Current Situation

✅ **Billing is enabled** on Google Cloud Platform
❌ **Quota is still limited to 100 searches/day** (default free tier limit)

**Production Error (Oct 10, 2025):**
```
429 - Quota exceeded for quota metric 'Queries' and limit 'Queries per day'
of service 'customsearch.googleapis.com' for consumer 'project_number:27017748443'
```

---

## Why This Happens

Even with billing enabled, Google Cloud APIs have **default quota limits** that must be manually increased. The Custom Search API defaults to:

- **Free tier:** 100 queries/day (no cost)
- **With billing:** 100 queries/day (default) → needs quota increase request

Simply enabling billing does NOT automatically increase the quota.

---

## How to Increase Quota to 10,000/day

### Step 1: Access Quotas Page

Go to the Custom Search API Quotas page:
```
https://console.cloud.google.com/apis/api/customsearch.googleapis.com/quotas?project=YOUR_PROJECT_ID
```

Or navigate manually:
1. Google Cloud Console → https://console.cloud.google.com
2. Select your project (project_number: 27017748443)
3. Menu → "APIs & Services" → "Enabled APIs"
4. Click "Custom Search API"
5. Click "Quotas & System Limits" tab

### Step 2: Find "Queries per day" Quota

Look for the quota labeled:
- **"Queries per day"**
- Current limit: **100**
- Usage: **100/100** (maxed out)

### Step 3: Request Quota Increase

1. **Check the checkbox** next to "Queries per day"

2. **Click "EDIT QUOTAS"** button at the top of the page

3. **Fill out the quota increase form:**
   - **New quota limit:** `10000`
   - **Request description/justification:**
     ```
     SAM AI is a B2B sales automation platform (https://app.meet-sam.com) that uses
     Google Custom Search for ICP (Ideal Customer Profile) prospect discovery.

     Current usage: ~500 searches/day
     Expected usage: ~1,000-2,000 searches/day

     We have billing enabled and are ready to pay for usage beyond the free tier.
     This quota increase is critical for our production ICP modeling feature.

     Project: project_number:27017748443
     API: Custom Search API (customsearch.googleapis.com)
     ```

4. **Verify contact information** (email for approval notification)

5. **Click "SUBMIT REQUEST"**

### Step 4: Wait for Approval

- **Typical approval time:** 1-2 business days (often within 24 hours)
- **You'll receive an email** when quota is increased
- **No human review needed** for standard increases to 10,000/day

---

## Alternative: Check if Already Increased

Sometimes billing enablement takes time to propagate. Check if your quota is already higher:

### Option A: Via Google Cloud Console
1. Go to quotas page (link above)
2. Check if "Queries per day" shows 10,000 instead of 100
3. If yes, quota is already increased

### Option B: Via API
```bash
# Check quota usage
gcloud services quota describe \
  customsearch.googleapis.com/quota/user/queries \
  --consumer=projects/YOUR_PROJECT_ID
```

---

## Temporary Workaround: Use Multiple API Keys

If you need immediate access while waiting for quota approval:

### Create Additional CSE Projects

1. **Create new Google Cloud project**
   - Console → "Select Project" → "New Project"
   - Name: "SAM-CSE-Backup-1"

2. **Enable Custom Search API** on new project

3. **Enable billing** on new project

4. **Create new API key** and CSE ID

5. **Add to Netlify as backup:**
   ```bash
   netlify env:set GOOGLE_API_KEY_BACKUP_1 "your_new_key"
   netlify env:set GOOGLE_CSE_ID_BACKUP_1 "your_new_cse_id"
   ```

6. **Modify code to rotate keys** when quota exceeded
   - File: `/lib/mcp/google-search-mcp.ts`
   - Add fallback logic to try backup keys

This gives you **200 searches/day** (100 per project × 2 projects)

---

## Cost After Quota Increase

Once quota is increased to 10,000/day:

**Pricing:**
- First 100 searches/day: **Free**
- Next 9,900 searches/day: **$5 per 1,000 queries**

**Example monthly costs:**

| Daily Searches | Free (100) | Paid | Daily Cost | Monthly Cost |
|----------------|------------|------|------------|--------------|
| 100            | 100        | 0    | $0         | $0           |
| 500            | 100        | 400  | $2         | $60          |
| 1,000          | 100        | 900  | $4.50      | $135         |
| 2,000          | 100        | 1,900| $9.50      | $285         |

**Current SAM usage:** ~500 searches/day → **~$60/month**

---

## Monitoring Quota Usage

### View Current Usage

**Google Cloud Console:**
```
https://console.cloud.google.com/apis/api/customsearch.googleapis.com/metrics
```

**View by:**
- Traffic (requests per second)
- Errors (by error code)
- Latency

### Set Up Alerts

**Create budget alert for API costs:**
1. Console → "Billing" → "Budgets & alerts"
2. Create budget for "Custom Search API"
3. Set threshold: $100/month
4. Alert at: 50%, 90%, 100%
5. Email notification to: admin email

---

## Testing After Quota Increase

Once quota is approved (you'll get email), verify it works:

### Test 1: Check Quota
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

### Test 2: Run ICP Discovery
```bash
curl -X POST https://app.meet-sam.com/api/test/google-search \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "icp_prospect_discovery",
    "arguments": {
      "jobTitles": ["VP Sales", "CRO"],
      "industries": ["SaaS"],
      "maxResults": 10
    }
  }'
```

Should return **real LinkedIn profiles**, not errors or fake data.

### Test 3: SAM AI ICP Session
1. Log into https://app.meet-sam.com
2. Start new conversation with SAM
3. Ask: "Find me 10 VP Sales prospects in SaaS companies"
4. Verify real prospects are returned

---

## Project Information

**Google Cloud Project:**
- Project Number: `27017748443`
- API: `customsearch.googleapis.com`
- Current Quota: `100/day`
- Target Quota: `10,000/day`
- Billing Status: ✅ Enabled
- Quota Increase Status: ⏳ Pending request

**API Keys (Netlify env vars):**
- `GOOGLE_API_KEY` - Currently configured
- `GOOGLE_CSE_ID` - Currently configured

---

## Next Steps

1. ✅ Billing enabled (confirmed)
2. ⏳ **Submit quota increase request** (see Step 1-4 above)
3. ⏳ Wait for approval email (1-2 business days)
4. ✅ Test after approval
5. ✅ Monitor usage and costs

---

**Documentation:** `/docs/GOOGLE_CSE_QUOTA_UPGRADE.md`
**Created:** October 10, 2025
**Priority:** High - blocking production ICP discovery
**Estimated Resolution:** 1-2 business days after quota request submitted
