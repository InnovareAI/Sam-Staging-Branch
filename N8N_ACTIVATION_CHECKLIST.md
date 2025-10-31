# N8N Cloud Workflows - Pre-Activation Checklist

**Date:** October 31, 2025
**Status:** Ready for Activation

---

## ✅ Pre-Activation Verification Complete

### 1. ✅ Master Campaign Orchestrator (Workflow ID: 2bmFPN5t2y6A4Rx2)

**Configuration Status:**
- ✅ Workflow imported (33 nodes)
- ✅ All nodes configured with actual API endpoints
- ✅ Unipile DSN replaced: `https://api6.unipile.com:13670`
- ✅ SAM API URL replaced: `https://app.meet-sam.com`
- ✅ Webhook tested successfully
- ✅ Test execution completed (ID: 234686, Status: success)

**URL:** https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2

**Webhook:** `https://innovareai.app.n8n.cloud/webhook/campaign-execute`

**What it does:**
- Receives campaign data from Sam App
- Sends connection requests via Unipile
- Waits for connection acceptance
- Sends 5 follow-up messages (FU1-4, GB)
- Checks for prospect replies before each message
- Updates Supabase database with status

---

### 2. ✅ Scheduled Campaign Checker (Workflow ID: 7QJZcRwQBI0wPRS4)

**Configuration Status:**
- ✅ Workflow created with schedule trigger (every 2 minutes)
- ✅ Supabase URL configured: `https://latxadqrvrrrcvkktrog.supabase.co`
- ✅ Supabase Service Key configured
- ✅ SAM API URL configured: `https://app.meet-sam.com`
- ✅ All nodes updated with actual values

**URL:** https://innovareai.app.n8n.cloud/workflow/7QJZcRwQBI0wPRS4

**Schedule:** Every 2 minutes (automatic)

**What it does:**
- Runs every 2 minutes automatically
- Queries Supabase for campaigns with `status='scheduled'` and `auto_execute=true`
- Checks if `next_execution_time` has passed
- Calls Sam App's `/api/campaigns/linkedin/execute-live` endpoint
- Sam App then triggers the Master Campaign Orchestrator

---

## 🔍 Pre-Activation Testing Checklist

### Test #1: Master Campaign Orchestrator Webhook
**Status:** ✅ PASSED

**Test Command:**
```bash
curl -X POST "https://innovareai.app.n8n.cloud/webhook/campaign-execute" \
  -H "Content-Type: application/json" \
  -d '{"workspaceId":"test","campaignId":"test","prospects":[...]}'
```

**Result:**
- Response: `{"message":"Workflow was started"}`
- Execution ID: 234686
- Status: success
- Duration: 123ms

---

### Test #2: Sam App Integration
**Status:** ✅ CONFIGURED

**What was updated:**
- `/app/api/campaigns/linkedin/execute-live/route.ts`
- Payload format matches n8n workflow expectations
- Includes all required fields (prospects, messages, timing, credentials)

---

### Test #3: Environment Variables
**Status:** ✅ SET

**Local (.env.local):**
```
✅ N8N_INSTANCE_URL=https://innovareai.app.n8n.cloud
✅ N8N_API_BASE_URL=https://innovareai.app.n8n.cloud
✅ N8N_API_KEY=[configured]
✅ N8N_CAMPAIGN_WEBHOOK_URL=https://innovareai.app.n8n.cloud/webhook/campaign-execute
```

**Netlify (Production):**
```
✅ N8N_INSTANCE_URL - Set
✅ N8N_API_BASE_URL - Set
✅ N8N_API_KEY - Set
✅ N8N_CAMPAIGN_WEBHOOK_URL - Set
```

---

## 🚀 Activation Steps

### Step 1: Activate Master Campaign Orchestrator

1. Go to: https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2
2. Click the toggle switch at the top right
3. Verify it shows "Active" status
4. **Leave this workflow active** - it handles campaign execution

---

### Step 2: Test Manual Campaign Execution (BEFORE Activating Scheduler)

**Before activating the scheduler, test with a real campaign:**

1. **Find or Create a Test Campaign:**
   ```sql
   -- Find a campaign with 1-2 prospects
   SELECT id, name, status
   FROM campaigns
   WHERE status = 'active'
   LIMIT 5;
   ```

2. **Execute via Sam UI:**
   - Go to Sam App: https://app.meet-sam.com
   - Navigate to the campaign
   - Click "Launch Campaign" or "Execute"

3. **Monitor Execution:**
   - Check n8n execution logs: https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2
   - Should see new execution appear
   - Verify it completes successfully

4. **Verify Results:**
   ```sql
   -- Check prospect status updated
   SELECT id, first_name, last_name, status, contacted_at
   FROM campaign_prospects
   WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
   ORDER BY contacted_at DESC;
   ```

5. **Check LinkedIn:**
   - Go to LinkedIn → My Network → Manage → Sent
   - Verify connection request was sent

---

### Step 3: Activate Scheduled Campaign Checker (ONLY AFTER Step 2 Passes)

1. Go to: https://innovareai.app.n8n.cloud/workflow/7QJZcRwQBI0wPRS4
2. Click "Execute Workflow" button to test manually
3. Check execution logs - should show "No campaigns due" or trigger a campaign
4. If manual test passes, click the toggle switch to activate
5. **Monitor for first 30 minutes** after activation

---

## ⚠️ Important Warnings

### Before Activation:

1. **Test with 1 prospect first** - Don't activate with large campaigns queued
2. **Verify LinkedIn account is connected** - Check Unipile integration
3. **Confirm working hours** - Scheduler respects campaign timing settings
4. **Check rate limits** - LinkedIn: 100 requests/week per account

### After Activation:

1. **Monitor first hour closely** - Watch for errors in execution logs
2. **Check prospect status updates** - Verify database updates happening
3. **Verify LinkedIn invitations** - Confirm actual sends on LinkedIn
4. **Watch for reply detection** - Ensure campaigns stop if prospects reply

---

## 🔧 If Issues Occur

### Issue: Workflow execution fails

**Check:**
1. n8n execution logs for error details
2. Sam App logs in Netlify functions
3. Supabase database connectivity
4. Unipile API status

**Fix:**
- Review node configurations
- Verify API credentials still valid
- Check rate limits not exceeded

---

### Issue: Scheduler triggers too many campaigns

**Fix:**
1. Deactivate scheduler immediately
2. Check `campaigns` table for incorrect `next_execution_time` values
3. Update campaigns to proper schedule
4. Reactivate scheduler

---

### Issue: LinkedIn account disconnected

**Fix:**
1. Go to Sam App → Settings → Integrations
2. Disconnect and reconnect LinkedIn via Unipile
3. Verify `workspace_accounts.unipile_account_id` populated
4. Test with manual campaign first

---

## 📊 Monitoring After Activation

### Check Every Hour (First Day):

```bash
# Check recent n8n executions
curl "https://innovareai.app.n8n.cloud/api/v1/executions?workflowId=2bmFPN5t2y6A4Rx2&limit=10" \
  -H "X-N8N-API-KEY: YOUR_KEY"

# Check campaign prospect statuses
SELECT
  c.name as campaign_name,
  cp.status,
  COUNT(*) as count,
  MAX(cp.contacted_at) as last_contacted
FROM campaigns c
JOIN campaign_prospects cp ON c.id = cp.campaign_id
WHERE cp.contacted_at > NOW() - INTERVAL '1 hour'
GROUP BY c.name, cp.status;
```

---

## ✅ Success Criteria

**Master Campaign Orchestrator:**
- ✅ Receives webhook from Sam App
- ✅ Processes prospects in sequence
- ✅ Sends connection requests via Unipile
- ✅ Updates Supabase with status changes
- ✅ Sends follow-up messages on schedule

**Scheduled Campaign Checker:**
- ✅ Runs every 2 minutes without errors
- ✅ Finds and triggers due campaigns
- ✅ Respects working hours and timezone
- ✅ Calls Sam App endpoint correctly
- ✅ Triggers Master Orchestrator successfully

---

## 🎯 Ready to Activate?

**Checklist:**
- ✅ Both workflows configured with actual values
- ✅ Master Orchestrator tested successfully
- ✅ Sam App integration updated and deployed
- ✅ Environment variables set in production
- ✅ Test campaign identified for validation
- ⏳ Manual test campaign execution pending
- ⏳ Scheduler activation pending

**Next Action:**
Execute Step 2 (Test Manual Campaign) before activating scheduler!

---

**Last Updated:** October 31, 2025
**Ready for:** Manual testing → Scheduler activation
**Estimated Time to Full Activation:** 1-2 hours (including testing)
