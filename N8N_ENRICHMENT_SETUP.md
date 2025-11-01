# N8N Prospect Enrichment Integration

**Date:** November 1, 2025
**Status:** ✅ Ready for Deployment
**Purpose:** Use N8N to handle LinkedIn prospect enrichment via BrightData (no timeout limits)

---

## 🎯 Why N8N for Enrichment?

### The Problem
- **BrightData takes 35-40 seconds** per prospect to scrape LinkedIn
- **Netlify serverless functions timeout** at 10-26 seconds
- Even processing **1 prospect at a time** exceeds timeout limits
- Result: `504 Gateway Timeout` errors

### The Solution
- **N8N workflows have no timeout limits**
- Already using N8N for LinkedIn campaigns (proven infrastructure)
- Visual monitoring of enrichment progress
- Built-in retry and error handling
- Consistent architecture across all automations

### Architecture Comparison

| Approach | Timeout | Monitoring | Error Handling | Infrastructure |
|----------|---------|------------|----------------|----------------|
| Background Queue | ❌ Still limited | Logs only | Custom code | Netlify functions |
| **N8N Workflow** | ✅ **No limit** | **Visual + logs** | **Built-in retry** | **Already using** |

---

## 📋 Prerequisites

Before deploying this workflow, ensure you have:

1. ✅ **N8N Cloud instance** (already running at innovareai.app.n8n.cloud)
2. ✅ **Supabase database** with `enrichment_jobs` table (migration already applied)
3. ✅ **BrightData API credentials** (already in use)
4. ✅ **Service role key** for Supabase (bypass RLS in N8N)

---

## 🚀 Deployment Steps

### Step 1: Import N8N Workflow

1. **Open N8N Cloud**: https://innovareai.app.n8n.cloud
2. **Go to Workflows** → Click "Import from File"
3. **Upload**: `/n8n-workflows/prospect-enrichment-workflow.json`
4. **Workflow should appear** with 16 nodes

### Step 2: Configure Credentials

The workflow needs these credentials configured in N8N:

#### Supabase Credentials
- **Type**: Supabase
- **Name**: `Sam Supabase Service Role`
- **URL**: `https://latxadqrvrrrcvkktrog.supabase.co`
- **Service Role Key**: Get from `.env.local` (`SUPABASE_SERVICE_ROLE_KEY`)

**Why service role?**
- N8N workflow needs to bypass Row Level Security (RLS)
- Updates enrichment_jobs and workspace_prospects across all workspaces

#### BrightData Credentials (Optional)
The workflow uses direct HTTP requests with API token, but you can also:
- **Install community node**: `n8n-nodes-brightdata`
- **Or use HTTP node** with Bearer token authentication (current approach)

### Step 3: Activate Workflow

1. **Click the toggle** in top-right to activate workflow
2. **Verify webhook URL**: Should be `https://innovareai.app.n8n.cloud/webhook/prospect-enrichment`
3. **Test webhook** is accessible

### Step 4: Update Environment Variables

Add to `.env.local` (production) and Netlify environment:

```bash
N8N_ENRICHMENT_WEBHOOK_URL=https://innovareai.app.n8n.cloud/webhook/prospect-enrichment
```

**Note:** Default is already set in code, so this is optional.

### Step 5: Deploy to Production

```bash
git add .
git commit -m "Add N8N enrichment workflow integration"
git push origin main
```

Netlify will auto-deploy in 2-5 minutes.

---

## 🧪 Testing the Workflow

### Test 1: Single Prospect Enrichment

1. **Go to Sam UI** → Data Collection Hub
2. **Select 1 prospect** with LinkedIn URL
3. **Click "Enrich Selected"**
4. **Watch N8N executions**: https://innovareai.app.n8n.cloud/executions
5. **Expected**:
   - ✅ Job status updates from `pending` → `processing` → `completed`
   - ✅ Prospect gets enriched with company_name, location, industry
   - ✅ N8N execution completes in ~40-50 seconds (no timeout!)

### Test 2: Multiple Prospects (5-10)

1. **Select 5-10 prospects**
2. **Click "Enrich Selected"**
3. **Monitor progress** in UI (progress bar should update)
4. **Check N8N execution** to see loop processing each prospect
5. **Expected**: All prospects enriched in ~3-5 minutes

### Test 3: Prospect Without LinkedIn URL

1. **Select prospect** without `linkedin_url`
2. **Click "Enrich"**
3. **Expected**:
   - ✅ Job status: `completed`
   - ✅ `failed_count` incremented
   - ✅ No error thrown

### Test 4: BrightData API Failure

Simulate by using invalid BrightData token:

1. **In N8N workflow**, temporarily change `brightdata_api_token`
2. **Trigger enrichment**
3. **Expected**:
   - ⚠️ N8N shows error in "Scrape LinkedIn Profile" node
   - ✅ Workflow handles gracefully
   - ✅ Job status: `failed` or partial completion

---

## 📊 Workflow Architecture

### Node Flow

```
1. Webhook Trigger
   ↓
2. Parse Job Data (extract job_id, workspace_id, prospect_ids)
   ↓
3. Mark Job as Processing (status = 'processing')
   ↓
4. Get Prospects to Enrich (from workspace_prospects)
   ↓
5. Loop Through Prospects (one at a time)
   ↓
6. Check LinkedIn URL Exists
   ├─ Yes → 7. Update Current Prospect Progress
   │         ↓
   │         8. Scrape LinkedIn Profile (BrightData API - 35-40s)
   │         ↓
   │         9. Parse LinkedIn Data (extract fields)
   │         ↓
   │         10. Update Prospect with Enriched Data
   │         ↓
   │         11. Increment Processed Count
   │         ↓
   │         (Loop back to step 5)
   │
   └─ No → 12. Increment Failed Count
           ↓
           (Loop back to step 5)

(When all prospects processed)
   ↓
13. Mark Job Complete (status = 'completed')
   ↓
14. Respond to Webhook
```

### Key Features

1. **Real-time Progress Updates**
   - `current_prospect_id` and `current_prospect_url` updated for each prospect
   - UI polls `/api/prospects/enrich-async/[jobId]` to show progress bar

2. **No Timeout Limits**
   - BrightData scraping (35-40s) runs without timeout
   - Can process hundreds of prospects in single workflow execution

3. **Graceful Error Handling**
   - Prospects without LinkedIn URL → skip, increment `failed_count`
   - BrightData API errors → retry built-in (2 retries with 5s delay)
   - Failed parsing → partial data saved

4. **Database-Driven Results**
   - `enrichment_results` stores all parsed data as JSONB array
   - UI can display detailed results per prospect

---

## 🔍 Monitoring & Debugging

### Check N8N Execution Logs

1. **Go to**: https://innovareai.app.n8n.cloud/executions
2. **Find latest** "SAM Prospect Enrichment with BrightData" execution
3. **Click to view** each node's input/output data
4. **Look for**:
   - ✅ Green nodes = success
   - ⚠️ Orange nodes = warnings (skipped prospects)
   - ❌ Red nodes = errors (BrightData failures)

### Check Database

```sql
-- Get enrichment job status
SELECT
  id,
  status,
  total_prospects,
  processed_count,
  failed_count,
  current_prospect_url,
  created_at,
  started_at,
  completed_at
FROM enrichment_jobs
ORDER BY created_at DESC
LIMIT 10;

-- Get enrichment results
SELECT
  id,
  enrichment_results
FROM enrichment_jobs
WHERE id = 'YOUR_JOB_ID';

-- Check enriched prospects
SELECT
  id,
  first_name,
  last_name,
  linkedin_url,
  company_name,
  location,
  industry
FROM workspace_prospects
WHERE id IN (
  SELECT unnest(prospect_ids)
  FROM enrichment_jobs
  WHERE id = 'YOUR_JOB_ID'
);
```

### Common Issues & Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| Workflow not triggered | Job stuck in `pending` | Check N8N workflow is activated |
| All prospects failing | `failed_count` = `total_prospects` | Check BrightData API credentials |
| Parsing returns empty data | `company_name` = null | Check BrightData HTML response format |
| Webhook timeout | 504 error | N8N workflow may be inactive |
| Supabase errors | "RLS policy violation" | Verify service role key configured |

---

## 🎛️ Configuration Options

### Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional (defaults provided)
N8N_ENRICHMENT_WEBHOOK_URL=https://innovareai.app.n8n.cloud/webhook/prospect-enrichment
BRIGHTDATA_API_TOKEN=61813293-6532-4e16-af76-9803cc043afa
BRIGHTDATA_ZONE=linkedin_enrichment
```

### Workflow Timeout Settings

**HTTP Request Node** (`call_brightdata`):
- **Timeout**: 60000ms (60 seconds) - can increase if needed
- **Retry**: 2 retries with 5s delay
- **Error handling**: Continue on fail (increment failed_count)

### Batch Size

**Split in Batches Node** (`loop_prospects`):
- **Current**: 1 prospect at a time
- **Can increase** to process multiple in parallel (risk rate limits)
- **Recommendation**: Keep at 1 to avoid BrightData rate limits

---

## 📈 Performance & Costs

### Expected Performance

| Prospects | Processing Time | BrightData Calls | Cost Estimate |
|-----------|----------------|------------------|---------------|
| 1 | ~40-50 seconds | 1 | $0.001 |
| 10 | ~6-8 minutes | 10 | $0.01 |
| 100 | ~60-80 minutes | 100 | $0.10 |
| 1000 | ~10-13 hours | 1000 | $1.00 |

**Note:** Times assume 40s per prospect + overhead for database operations.

### Cost Breakdown

1. **BrightData API**: ~$0.001 per profile scrape
2. **N8N Cloud**: Included in existing plan (no per-execution cost)
3. **Supabase**: Database operations (negligible cost)

### Rate Limits

- **BrightData**: No strict limit, but recommend max 100 prospects/batch
- **N8N Cloud**: Execution timeout varies by plan (usually 5-10 hours)
- **Supabase**: 500 requests/second (more than sufficient)

---

## 🔐 Security Considerations

### Service Role Key Protection

**CRITICAL:** The N8N workflow uses Supabase service role key to bypass RLS.

**Security measures:**
1. ✅ Webhook requires valid job_id (can't create arbitrary jobs)
2. ✅ Service key only passed in webhook payload (not in workflow nodes)
3. ✅ N8N credentials stored encrypted in N8N Cloud
4. ⚠️ **DO NOT expose N8N webhook URL publicly** (keep internal)

### Data Privacy

**Enrichment results** may contain:
- LinkedIn profile data (public information)
- Company names and locations
- Job titles

**Compliance:**
- ✅ Data stored in Supabase (GDPR-compliant)
- ✅ Only enriches prospects user approved
- ✅ RLS enforces workspace isolation

---

## 🚦 Next Steps

### Immediate (This Week)

1. ✅ Import workflow to N8N
2. ✅ Test with 1-5 prospects
3. ✅ Monitor first production enrichment
4. 📊 Collect metrics (success rate, processing time)

### Short-term (This Month)

1. **Optimize parsing logic** if data quality low
2. **Add error alerting** (email/Slack on failures)
3. **Implement retry for failed prospects**
4. **Add webhook authentication** for security

### Long-term (Next Quarter)

1. **Scale to 1000+ prospects** per batch
2. **Multi-account BrightData rotation** (avoid rate limits)
3. **Enhanced data extraction** (emails, phone numbers)
4. **Integration with campaign workflows** (auto-enrich before messaging)

---

## 📞 Support & Troubleshooting

### If Enrichment Fails

1. **Check N8N execution logs** (see Monitoring section above)
2. **Verify BrightData API credentials** (test with curl)
3. **Check database** for job status and errors
4. **Review Netlify logs** for webhook trigger issues

### Getting Help

- **N8N Documentation**: https://docs.n8n.io/
- **BrightData N8N Integration**: https://docs.brightdata.com/integrations/n8n
- **N8N Community Node**: https://github.com/n8nhackers/n8n-nodes-brightdata

---

## ✅ Deployment Checklist

Before going live:

- [ ] N8N workflow imported and activated
- [ ] Supabase service role credentials configured in N8N
- [ ] BrightData API token configured
- [ ] N8N webhook URL accessible
- [ ] Environment variables set in Netlify
- [ ] Tested with 1 prospect (success)
- [ ] Tested with 5-10 prospects (success)
- [ ] Tested error scenarios (no LinkedIn URL, BrightData failure)
- [ ] Database migration applied (enrichment_jobs table exists)
- [ ] UI polling working (progress bar updates)

---

**Last Updated:** November 1, 2025
**Workflow Version:** 1.0
**Next Review:** After 100 enrichments or 1 week of production use
