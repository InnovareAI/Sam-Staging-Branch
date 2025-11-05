# N8N Enrichment Workflow Import Guide

**Status:** ✅ Ready to Import
**Date:** November 5, 2025

---

## 🎯 Quick Import Instructions

### Step 1: Access N8N

1. Open: **https://workflows.innovareai.com**
2. Log in with your credentials

### Step 2: Import the Workflow

1. Click **"Workflows"** in the left sidebar
2. Click **"Import from File"** button (top-right)
3. Select file: **`n8n-workflows/prospect-enrichment-workflow-fixed.json`**
4. Click **"Import"**

### Step 3: Configure Supabase Credentials

The workflow needs Supabase credentials to access the database:

1. In the workflow editor, look for nodes with ⚠️ (credential warning)
2. Click on any Supabase node (e.g., "Mark Job as Processing")
3. Click on the credentials dropdown
4. Click **"Create New Credential"**
5. Enter:
   - **URL:** `https://latxadqrvrrrcvkktrog.supabase.co`
   - **Service Role Key:** (see `.env.local` → `SUPABASE_SERVICE_ROLE_KEY`)
6. Save the credential
7. Apply to all Supabase nodes in the workflow

### Step 4: Configure BrightData (Optional)

BrightData credentials are passed via webhook, but you can verify:

- **API Token:** Already configured in `.env.local` as `BRIGHTDATA_API_TOKEN`
- **Zone:** `linkedin_enrichment` (default)

### Step 5: Activate the Workflow

1. Click the **"Inactive"** toggle in top-right
2. Should change to **"Active"** (green)
3. Workflow is now listening for webhook calls!

### Step 6: Verify Webhook URL

1. Click on the **"Enrichment Job Webhook"** node (first node)
2. Copy the **Production URL** (should be: `https://workflows.innovareai.com/webhook/prospect-enrichment`)
3. This URL is already configured in the code, so no changes needed

---

## ✅ What This Workflow Does

### Workflow Flow

```
1. Receives enrichment job from Sam → /api/prospects/enrich-async
2. Marks job as "processing" in enrichment_jobs table
3. Fetches prospects from prospect_approval_data table
4. Loops through each prospect:
   - Extracts linkedin_url from contact JSONB
   - Calls BrightData API to scrape LinkedIn profile (35-40s)
   - Extracts email and phone from scraped data
   - Updates contact JSONB with email/phone
   - Increments processed_count
5. Marks job as "completed"
6. Returns success response
```

### Key Differences from Old Workflow

| Feature | Old Workflow | New Workflow (FIXED) |
|---------|--------------|---------------------|
| Table | `workspace_prospects` | `prospect_approval_data` |
| LinkedIn URL | Direct column | Extracted from `contact.linkedin_url` (JSONB) |
| Enrichment Target | `company_name`, `location`, `industry` | `contact.email`, `contact.phone` (JSONB) |
| Update Method | UPDATE columns | UPDATE contact JSONB |

---

## 🧪 Testing the Workflow

### Test 1: Manual Webhook Test (N8N UI)

1. In the workflow editor, click **"Execute Workflow"** button
2. Select the **"Enrichment Job Webhook"** node
3. Click **"Listen for Test Event"**
4. In another tab, trigger enrichment from Sam UI (select 1 prospect)
5. N8N should show the incoming webhook data
6. Click **"Execute Workflow"** to manually run
7. Verify all nodes turn green

### Test 2: End-to-End Test from Sam UI

1. Go to Sam → Data Collection Hub
2. Ensure you have prospects with LinkedIn URLs in `contact.linkedin_url`
3. Select 1 prospect (checkbox)
4. Click **"Enrich Selected"** button
5. Expected results:
   - Toast: "✅ Enrichment started for 1 prospect!"
   - Job appears in `enrichment_jobs` table with status "processing"
   - N8N execution appears in: https://workflows.innovareai.com/executions
   - After ~40 seconds, job status changes to "completed"
   - Prospect's `contact.email` and `contact.phone` are populated

### Test 3: Verify Data in Database

```sql
-- Check enrichment job status
SELECT
  id,
  status,
  total_prospects,
  processed_count,
  failed_count,
  created_at,
  completed_at
FROM enrichment_jobs
ORDER BY created_at DESC
LIMIT 5;

-- Check enriched prospect data
SELECT
  prospect_id,
  name,
  contact->>'linkedin_url' as linkedin_url,
  contact->>'email' as email,
  contact->>'phone' as phone
FROM prospect_approval_data
WHERE prospect_id IN (
  SELECT unnest(prospect_ids)
  FROM enrichment_jobs
  WHERE status = 'completed'
  ORDER BY created_at DESC
  LIMIT 1
);
```

---

## 🔧 Troubleshooting

### Issue: Webhook Not Found (404)

**Symptom:** API returns "Failed to trigger N8N workflow"

**Solutions:**
1. Verify workflow is **Active** (toggle in top-right)
2. Check webhook path is `/webhook/prospect-enrichment`
3. Restart the workflow (deactivate, then activate again)

### Issue: Supabase Credential Error

**Symptom:** N8N execution fails with "Authentication required"

**Solutions:**
1. Verify Supabase service role key is correct (check `.env.local`)
2. Ensure all Supabase nodes use the same credential
3. Test credential with a simple SELECT query in N8N

### Issue: BrightData Timeout

**Symptom:** "Scrape LinkedIn Profile" node times out

**Solutions:**
1. Increase timeout in node settings (currently 60s, can increase to 120s)
2. Verify BrightData API token is valid
3. Check BrightData account has available credits

### Issue: No Email/Phone Extracted

**Symptom:** Job completes but `contact.email` and `contact.phone` are null

**Solutions:**
1. Check N8N execution logs → "Parse LinkedIn Data" node output
2. Verify BrightData is returning HTML (check `raw_html_sample` in enrichment_results)
3. LinkedIn profile may not have public email/phone (this is expected for most profiles)
4. Consider using alternative enrichment sources (Hunter.io, Clearbit, etc.)

### Issue: Job Stuck in "Pending"

**Symptom:** Enrichment job created but never progresses to "processing"

**Solutions:**
1. Check N8N workflow is active
2. Verify webhook URL is correct: `https://workflows.innovareai.com/webhook/prospect-enrichment`
3. Check N8N execution logs for errors
4. Manually trigger webhook from N8N UI to test

---

## 📊 Performance & Costs

### Expected Performance

| Prospects | Processing Time | BrightData Calls | Cost Estimate |
|-----------|----------------|------------------|---------------|
| 1 | ~40-50 seconds | 1 | $0.001 |
| 10 | ~6-8 minutes | 10 | $0.01 |
| 100 | ~60-80 minutes | 100 | $0.10 |

### Rate Limits

- **BrightData:** No strict limit, recommend max 100 prospects/batch
- **N8N Cloud:** Execution timeout varies by plan (usually 5-10 hours)
- **Supabase:** 500 requests/second (more than sufficient)

---

## 🔐 Security Notes

### Service Role Key Protection

**CRITICAL:** The workflow uses Supabase service role key to bypass RLS.

**Security measures in place:**
- ✅ Webhook requires valid job_id (can't create arbitrary jobs)
- ✅ Service key passed in webhook payload (encrypted in transit)
- ✅ N8N credentials stored encrypted in N8N Cloud
- ⚠️ **DO NOT expose webhook URL publicly**

### GDPR Compliance

Enrichment results may contain:
- LinkedIn profile data (public information)
- Email addresses (if publicly available)
- Phone numbers (if publicly available)

All data is:
- ✅ Stored in Supabase (GDPR-compliant)
- ✅ Only enriches prospects user approved
- ✅ RLS enforces workspace isolation

---

## ✅ Import Checklist

Before testing, verify:

- [ ] Workflow imported to N8N
- [ ] Workflow renamed to something recognizable (e.g., "SAM Prospect Enrichment - LIVE")
- [ ] Supabase service role credentials configured
- [ ] All Supabase nodes using the same credential
- [ ] Workflow activated (toggle is green)
- [ ] Webhook URL copied: `https://workflows.innovareai.com/webhook/prospect-enrichment`
- [ ] BrightData API token configured in `.env.local`
- [ ] enrichment_jobs table exists in database
- [ ] prospect_approval_data table has `contact` JSONB column

---

## 🚀 Next Steps After Import

1. **Test with 1 prospect** to verify end-to-end flow
2. **Monitor N8N executions** for errors
3. **Check enriched data quality** in database
4. **Scale to 10-50 prospects** once confirmed working
5. **Set up error alerting** (optional - email/Slack on failures)

---

**Last Updated:** November 5, 2025
**Workflow Version:** 2.0 (Fixed for prospect_approval_data)
**Import File:** `n8n-workflows/prospect-enrichment-workflow-fixed.json`
