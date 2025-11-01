# N8N Enrichment Deployment Checklist

**Date:** November 1, 2025
**Workflow ID:** 2KEiD1CNpwgbJSvd
**Workflow URL:** https://innovareai.app.n8n.cloud/workflow/2KEiD1CNpwgbJSvd
**Status:** ✅ Configured - Ready for Final Steps

---

## ✅ Completed Steps

- [x] N8N workflow JSON created and validated
- [x] Workflow imported to N8N Cloud (ID: 2KEiD1CNpwgbJSvd)
- [x] Environment variables configured in `.env.local`
- [x] N8N MCP integration code deployed
- [x] Test script created (`scripts/js/test-n8n-enrichment.mjs`)
- [x] All code committed and pushed to GitHub (commit 29a52c8f)
- [x] Netlify auto-deploy triggered (awaiting completion)

---

## 🚦 Remaining Steps (5-10 minutes)

### Step 1: Activate N8N Workflow (2 min)

**Action:**
1. Go to: https://innovareai.app.n8n.cloud/workflow/2KEiD1CNpwgbJSvd
2. Click the **toggle switch** in top-right corner to activate
3. Verify status shows **"Active"**
4. Check webhook URL is visible

**Expected:**
- ✅ Workflow status: Active
- ✅ Webhook URL: `https://innovareai.app.n8n.cloud/webhook/prospect-enrichment`

---

### Step 2: Configure Supabase Credentials in N8N (3 min)

**Action:**
1. In N8N workflow, click on **"Mark Job as Processing"** node
2. Click **"Credentials"** dropdown
3. Create new credential:
   - **Type**: Supabase
   - **Name**: "Sam Supabase Service Role"
   - **URL**: `https://latxadqrvrrrcvkktrog.supabase.co`
   - **Service Role Key**: (Get from `.env.local` → `SUPABASE_SERVICE_ROLE_KEY`)
4. Save credential
5. Apply to ALL Supabase nodes in workflow:
   - Mark Job as Processing
   - Get Prospects to Enrich
   - Update Prospect with Enriched Data
   - Increment Processed Count
   - Increment Failed Count
   - Mark Job Complete

**Expected:**
- ✅ All Supabase nodes have credentials configured
- ✅ No credential errors when testing

---

### Step 3: Add Environment Variable to Netlify (2 min)

**Action:**
1. Go to: https://app.netlify.com/sites/devin-next-gen-staging/configuration/env
2. Add new variable:
   - **Key**: `N8N_ENRICHMENT_WORKFLOW_ID`
   - **Value**: `2KEiD1CNpwgbJSvd`
3. Click **"Save"**
4. Trigger redeploy (or wait for auto-deploy to complete)

**Expected:**
- ✅ Variable visible in Netlify environment
- ✅ Deployment succeeded

---

### Step 4: Test Enrichment (5 min)

**Option A: Via Test Script (Recommended)**

```bash
# Run test script
node scripts/js/test-n8n-enrichment.mjs
```

**Expected output:**
```
🚀 N8N MCP Enrichment Test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Finding test prospect with LinkedIn URL...
✅ Found prospect: John Doe
📍 LinkedIn: https://linkedin.com/in/johndoe
🏢 Current company: Not set

🏢 Getting workspace...
✅ Workspace ID: abc-123

📋 Creating enrichment job...
✅ Job created: xyz-789
🔗 Poll URL: /api/prospects/enrich-async/xyz-789

⏳ Polling for job completion...
⏳ Status: processing | Progress: 50% (1/2)
✅ Job completed!
📊 Processed: 1, Failed: 0

📊 Fetching enriched prospect data...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 ENRICHED PROSPECT DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Name:         John Doe
  Company:      Acme Corp
  Location:     San Francisco, CA
  Industry:     Technology
  LinkedIn:     https://linkedin.com/in/johndoe

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Test completed successfully!
```

**Option B: Via Sam UI**

1. Go to: https://app.meet-sam.com
2. Navigate to **Data Collection Hub**
3. Select **1 prospect** with LinkedIn URL
4. Click **"Enrich Selected"**
5. Watch progress bar
6. Verify enriched data appears

**Expected:**
- ✅ Progress bar updates in real-time
- ✅ Enrichment completes in ~40-60 seconds
- ✅ Company name, location, industry populated
- ✅ No errors in console

---

### Step 5: Verify N8N Execution (2 min)

**Action:**
1. Go to: https://innovareai.app.n8n.cloud/executions
2. Find latest execution of "SAM Prospect Enrichment with BrightData"
3. Click to view details
4. Check each node executed successfully (green)

**Expected:**
- ✅ All nodes green (no errors)
- ✅ Execution time: ~40-60 seconds
- ✅ BrightData API call succeeded
- ✅ Prospect data updated in Supabase

---

## 🔍 Troubleshooting

### Issue 1: Workflow Not Executing

**Symptom:**
- Job stuck in `pending` status
- No execution appears in N8N

**Fix:**
1. Check workflow is **activated** in N8N
2. Verify `N8N_ENRICHMENT_WORKFLOW_ID` matches workflow ID
3. Check Netlify logs for MCP errors

### Issue 2: Supabase Credential Errors

**Symptom:**
- N8N execution shows "RLS policy violation"
- Database update nodes fail

**Fix:**
1. Verify **Service Role Key** (not anon key) configured
2. Check credential applied to ALL Supabase nodes
3. Test credential in N8N settings

### Issue 3: No Enriched Data

**Symptom:**
- Execution succeeds but no data updated
- `company_name` still null

**Fix:**
1. Check N8N execution logs for parsing errors
2. Review BrightData API response in "Scrape LinkedIn Profile" node
3. Verify LinkedIn URL is valid and accessible

### Issue 4: MCP Not Working

**Symptom:**
- Logs show "Could not trigger N8N workflow via MCP"
- Falls back to webhook

**Fix:**
1. Check `N8N_API_KEY` is valid
2. Verify N8N API URL is correct
3. MCP fallback to webhook will work fine (this is expected behavior)

---

## 📊 Post-Deployment Monitoring

### Day 1: Watch First 10 Enrichments

**Monitor:**
- N8N execution success rate
- Average processing time per prospect
- BrightData API error rate
- Data quality (% with company_name filled)

**Expected:**
- ✅ Success rate: 80-90%
- ✅ Processing time: 40-60s per prospect
- ✅ BrightData errors: <10%
- ✅ Data quality: 70-80% enriched

### Week 1: Collect Metrics

**Track:**
- Total enrichments completed
- MCP vs webhook usage (check logs)
- Failed enrichments (analyze why)
- User feedback on data quality

**Actions:**
- Adjust parsing logic if data quality low
- Optimize workflow if processing too slow
- Add more error handling if failures high

---

## 🎯 Success Criteria

**Enrichment is successful if:**
- ✅ Job completes in <2 minutes for 1 prospect
- ✅ At least 70% of prospects get company_name
- ✅ No timeout errors (504)
- ✅ N8N executions show green (success)
- ✅ Users can see enriched data in UI

**If any criteria fails:**
1. Review N8N execution logs
2. Check BrightData API responses
3. Adjust parsing logic in workflow
4. Contact support if API issues persist

---

## 📞 Support Contacts

**N8N Issues:**
- Dashboard: https://innovareai.app.n8n.cloud
- Docs: https://docs.n8n.io

**BrightData Issues:**
- Dashboard: https://brightdata.com
- Docs: https://docs.brightdata.com

**Supabase Issues:**
- Dashboard: https://supabase.com/dashboard
- Docs: https://supabase.com/docs

---

## ✅ Final Checklist

**Before marking complete:**

- [ ] Workflow activated in N8N
- [ ] Supabase credentials configured
- [ ] `N8N_ENRICHMENT_WORKFLOW_ID` in Netlify env
- [ ] Test script runs successfully
- [ ] First enrichment via UI succeeds
- [ ] N8N execution logs show success
- [ ] Enriched data visible in database
- [ ] No errors in Netlify logs

**When all checked:**
✅ N8N enrichment integration is **LIVE**! 🎉

---

## 📁 Reference Files

**Documentation:**
- `N8N_MCP_ENRICHMENT_GUIDE.md` - MCP integration guide
- `N8N_ENRICHMENT_SETUP.md` - General setup guide
- `N8N_ENRICHMENT_SUMMARY.md` - Session summary

**Code:**
- `app/api/prospects/enrich-async/route.ts` - MCP trigger
- `n8n-workflows/prospect-enrichment-workflow.json` - Workflow definition
- `lib/mcp/n8n-mcp.ts` - N8N MCP client

**Testing:**
- `scripts/js/test-n8n-enrichment.mjs` - End-to-end test

**Environment:**
- `.env.local` - Local config
- Netlify env vars - Production config

---

**Last Updated:** November 1, 2025
**Deployment:** Commit 29a52c8f
**Status:** 🟡 Awaiting final steps (activate workflow + configure credentials)
