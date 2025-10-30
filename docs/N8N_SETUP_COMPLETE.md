# N8N Setup Complete - Next Steps

## ✅ What Has Been Done

### 1. N8N Workflow Created and Imported
- **Workflow Name:** SAM LinkedIn Campaign Execution v2
- **Workflow ID:** `FNwzHH1WTHGMtdEe`
- **N8N URL:** https://workflows.innovareai.com/workflow/FNwzHH1WTHGMtdEe
- **Status:** Imported (inactive)
- **Nodes:** 14 nodes configured

### 2. SAM API Modified
- **File:** `/app/api/campaigns/linkedin/execute-live/route.ts`
- **Change:** Replaced direct Unipile API calls with N8N webhook trigger
- **Status:** Deployed to production

### 3. Connection Status API Created
- **Endpoint:** `/api/campaigns/check-connection-status/[id]`
- **Purpose:** N8N calls this to check if LinkedIn connections were accepted
- **Status:** Deployed to production

### 4. Deployment Complete
- **Production URL:** https://app.meet-sam.com
- **Build Status:** ✅ Successful
- **Git Commits:**
  - c4566f06: N8N migration
  - 8e127d7e: Documentation

---

## 🚨 REQUIRED: Manual Steps

### Step 1: Configure N8N Environment Variables

1. **Go to N8N workflow:**
   ```
   https://workflows.innovareai.com/workflow/FNwzHH1WTHGMtdEe
   ```

2. **Click Settings → Environment Variables**

3. **Add these variables:**
   ```bash
   UNIPILE_DSN=api6.unipile.com:13670
   UNIPILE_API_KEY=<your_unipile_api_key>
   ```

   ⚠️ **Get UNIPILE_API_KEY from:**
   - `.env.local` file (line with `UNIPILE_API_KEY=`)
   - OR Netlify environment variables

### Step 2: Update SAM Environment Variables

1. **Go to Netlify:**
   ```
   https://app.netlify.com/sites/devin-next-gen-prod/settings/deploys#environment
   ```

2. **Add these variables:**
   ```bash
   N8N_CAMPAIGN_WEBHOOK_URL=https://workflows.innovareai.com/webhook/sam-campaign-execute
   N8N_API_KEY=<already_set>
   ```

   ✅ `N8N_API_KEY` is already set in `.env.local`

3. **Trigger Netlify rebuild:**
   ```bash
   # In terminal:
   netlify deploy --prod
   ```

### Step 3: Activate N8N Workflow

1. **Go to workflow:** https://workflows.innovareai.com/workflow/FNwzHH1WTHGMtdEe

2. **Click the "Activate" toggle** (top right corner)

3. **Verify webhook URL:**
   - Should be: `https://workflows.innovareai.com/webhook/sam-campaign-execute`
   - This is what SAM will call to trigger the workflow

---

## 🧪 Testing Instructions

### Test 1: Dry Run

```bash
curl -X POST https://app.meet-sam.com/api/campaigns/linkedin/execute-live \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_AUTH_COOKIE" \
  -d '{
    "campaignId": "YOUR_CAMPAIGN_ID",
    "maxProspects": 1,
    "dryRun": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "messages_queued": 0,
  "execution_mode": "n8n_async",
  "message": "Would queue 1 prospects in N8N"
}
```

### Test 2: Live Execution (1 Prospect)

```bash
curl -X POST https://app.meet-sam.com/api/campaigns/linkedin/execute-live \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_AUTH_COOKIE" \
  -d '{
    "campaignId": "YOUR_CAMPAIGN_ID",
    "maxProspects": 1,
    "dryRun": false
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "messages_queued": 1,
  "queued_prospects": [
    {
      "prospect": "John Doe",
      "linkedin_url": "https://linkedin.com/in/johndoe",
      "status": "queued_in_n8n"
    }
  ],
  "execution_mode": "n8n_async"
}
```

### Test 3: Monitor N8N Execution

1. **Go to N8N Executions:**
   ```
   https://workflows.innovareai.com/executions
   ```

2. **Look for:**
   - New execution with status "Running"
   - Webhook trigger node should have prospect data
   - Each node should execute in sequence

3. **Expected flow:**
   ```
   Webhook → Split Prospects → Extract Username →
   Get Profile → Personalize Message → Send Connection Request →
   Update Status → Wait 24-48h → Check Connection →
   If Accepted: Send FU1
   ```

### Test 4: Verify LinkedIn

1. **Go to LinkedIn:**
   ```
   https://linkedin.com/mynetwork/invitation-manager/sent/
   ```

2. **Look for:**
   - New connection request matching test prospect
   - Request sent within last few minutes

### Test 5: Check Database

```sql
SELECT
  id,
  first_name,
  last_name,
  status,
  contacted_at,
  personalization_data->>'n8n_execution_id' as n8n_id
FROM campaign_prospects
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
  AND status = 'queued_in_n8n'
ORDER BY updated_at DESC
LIMIT 5;
```

**Expected:**
- Status: `queued_in_n8n`
- n8n_execution_id: Present
- contacted_at: NULL initially (N8N updates after sending)

---

## 🔧 Troubleshooting

### Issue 1: N8N Webhook Not Receiving Data

**Symptoms:**
- SAM returns success but no N8N execution
- N8N executions page shows no new runs

**Debug:**
1. Check N8N workflow is activated (green toggle)
2. Verify webhook URL matches: `https://workflows.innovareai.com/webhook/sam-campaign-execute`
3. Check N8N_CAMPAIGN_WEBHOOK_URL in Netlify environment

**Solution:**
```bash
# Test webhook directly
curl -X POST https://workflows.innovareai.com/webhook/sam-campaign-execute \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Issue 2: Environment Variables Not Found

**Symptoms:**
- N8N node fails with "UNIPILE_DSN is not defined"

**Solution:**
1. Go to N8N workflow settings
2. Add UNIPILE_DSN and UNIPILE_API_KEY
3. Save and re-execute

### Issue 3: Connection Request Not Sending

**Symptoms:**
- N8N shows success but no LinkedIn connection request

**Debug:**
1. Check N8N execution logs for "Send Connection Request" node
2. Look for Unipile API response
3. Verify provider_id was retrieved

**Possible Causes:**
- Wrong Unipile account_id (use base ID, not source ID)
- LinkedIn account not connected in Unipile
- Invalid provider_id

---

## 📊 Success Metrics

After successful setup, you should see:

| Metric | Expected Value | Where to Check |
|--------|----------------|----------------|
| N8N Workflow Active | ✅ Yes | N8N dashboard |
| Campaign Execution | ✅ Success | SAM UI |
| Prospects Queued | ≥ 1 | SAM API response |
| N8N Execution Status | ✅ Running | N8N executions page |
| LinkedIn Request Sent | ✅ Visible | LinkedIn sent invitations |
| Database Status | `queued_in_n8n` | Supabase SQL |

---

## 📚 Documentation

- **Full Migration Guide:** `/docs/N8N_MIGRATION_SUMMARY.md`
- **Quick Reference:** `/docs/N8N_QUICK_REFERENCE.md`
- **Original Setup Doc:** `/docs/N8N_LINKEDIN_MESSAGING_SETUP.md`

---

## 🎯 Next Steps After Testing

Once you've verified 1 prospect works:

1. **Scale Up:**
   - Test with 5 prospects
   - Monitor N8N executions
   - Verify all connection requests sent

2. **Wait 24-48 Hours:**
   - N8N workflow will auto-check connection acceptance
   - If accepted, sends Follow-Up 1 automatically

3. **Add Follow-Ups 2-4:**
   - Duplicate "Personalize FU1" and "Send Follow-Up 1" nodes
   - Add for FU2, FU3, FU4, Goodbye
   - Connect with 3-7 day wait nodes

4. **Monitor & Optimize:**
   - Check N8N execution success rate
   - Monitor LinkedIn response rates
   - Adjust message templates as needed

---

## ⚠️ Important Notes

1. **Do NOT test with real prospects yet** - Use test data first
2. **Monitor LinkedIn account health** - Watch for rate limits or restrictions
3. **N8N executions can take days** - Due to 24-48h waits built into workflow
4. **Check Unipile quota** - Profile lookups count toward Sales Navigator limit
5. **Keep direct API as fallback** - In case N8N has issues (git commit b6af9851)

---

**Status:** ✅ READY FOR TESTING
**Created:** October 30, 2025
**Workflow ID:** FNwzHH1WTHGMtdEe
**Production URL:** https://app.meet-sam.com
