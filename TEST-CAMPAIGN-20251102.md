# Testing Campaign: 20251102-IAI-Outreach Campaign

## 📋 Campaign Details
- **Campaign Name**: 20251102-IAI-Outreach Campaign
- **Account**: mg@innovareai.com
- **Status**: Ready to execute
- **N8N Instance**: https://workflows.innovareai.com (Self-Hosted on Hetzner)
- **Target Workflow**: SAM Campaign Execution v2 - Clean (ID: 79ZgBvhtNyx0wEGj)

## 🚀 How to Test (Step-by-Step)

### Step 1: Ensure Dev Server is Running
If your dev server is running, **restart it** to pick up the new environment variable:

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 2: Execute Campaign from UI

1. **Navigate to**: Campaigns page in Sam UI
2. **Find**: "20251102-IAI-Outreach Campaign"
3. **Click**: The ▶️ **Play** or **Activate** button

### Step 3: Monitor the Execution

#### In Browser (Open DevTools - Press F12):

**Network Tab:**
1. Look for: `POST /api/campaigns/linkedin/execute-via-n8n`
2. Click on the request
3. Check **Response** tab - should see:

```json
{
  "success": true,
  "message": "V1 Campaign Orchestration launched - HITL approval required",
  "execution_id": "...",
  "n8n_execution_id": "...",
  "workspace_tier": "startup",
  "prospects_processing": X,
  "channels_enabled": {
    "linkedin": true,
    "email": ...,
    "primary_channel": "linkedin"
  },
  "hitl_approval": {
    "required": true,
    "method": "email",
    "approver_email": "mg@innovareai.com"
  }
}
```

**Console Tab:**
- Should show: `✅ N8N Master Funnel response: ...`
- Should NOT show: `falling back to https://innovareai.app.n8n.cloud` (old cloud)
- Should show: `Sending to N8N Master Funnel: https://workflows.innovareai.com/webhook/campaign-execute-v2`

#### In N8N Dashboard:

1. **Open**: https://workflows.innovareai.com
2. **Login** (if needed)
3. **Click**: "Executions" in left sidebar
4. **Look for**: New execution of "SAM Campaign Execution v2 - Clean"
5. **Timestamp**: Should match when you clicked activate
6. **Status**: Should be "Running" or "Success"

#### Click on the Execution to See:

**Input Data:**
- Should see your campaign data
- Workspace ID
- Prospect information
- Message templates
- HITL configuration

**Output/Logs:**
- Workflow processing steps
- Any errors or warnings
- Final status

## ✅ Success Indicators

- [ ] Browser shows success toast/message
- [ ] Network tab shows `200 OK` response
- [ ] Response includes `n8n_execution_id`
- [ ] Console shows correct webhook URL (self-hosted, not cloud)
- [ ] N8N dashboard shows new execution
- [ ] Execution status is "Success" or "Running"
- [ ] No errors in browser console or N8N logs

## 🎯 What Should Happen

### Immediate (in UI):
1. Success message appears
2. Campaign status changes to "HITL Approval Pending" or similar
3. Prospect status updates to "hitl_approval"

### In N8N (within seconds):
1. New execution appears in dashboard
2. Workflow receives payload with campaign data
3. Workflow processes based on configuration
4. HITL approval step triggered

### Next Steps (after successful execution):
1. Check email (mg@innovareai.com) for HITL approval request
2. Approve messages in approval system
3. Campaign proceeds to send messages via Unipile
4. Status updates come back via webhooks

## ❌ Troubleshooting

### Issue: "Campaign not found"
**Solution:**
- Refresh the page
- Ensure campaign status is "active" or "draft"
- Check you're in the correct workspace

### Issue: "Unauthorized" error
**Solution:**
- Confirm you're logged in as mg@innovareai.com
- Refresh browser and try again
- Check session hasn't expired

### Issue: No execution in N8N dashboard
**Possible Causes:**

1. **Webhook URL not configured**
   - Run: `cat .env | grep N8N_CAMPAIGN_WEBHOOK`
   - Should show: `N8N_CAMPAIGN_WEBHOOK_URL=https://workflows.innovareai.com/webhook/campaign-execute-v2`
   - If missing, it's using the fallback cloud URL

2. **Dev server not restarted**
   - Stop and restart: `npm run dev`
   - Environment variables only load on startup

3. **Workflow not active**
   - Go to: https://workflows.innovareai.com/workflow/79ZgBvhtNyx0wEGj
   - Check if "Active" toggle is ON (should be green)

4. **Webhook path incorrect**
   - Verify in workflow: webhook path should be `campaign-execute-v2`
   - Check trigger node configuration

### Issue: Execution shows in N8N but failed
**Check:**
- Click on the failed execution
- Look at error message
- Common issues:
  - Missing data in payload
  - Database connection errors
  - Unipile API credentials
  - Rate limits exceeded

### Issue: Console shows old cloud URL
**This means env variable didn't load:**

```bash
# Check if variable is in .env
grep N8N_CAMPAIGN_WEBHOOK .env

# Should show:
# N8N_CAMPAIGN_WEBHOOK_URL=https://workflows.innovareai.com/webhook/campaign-execute-v2

# If missing, add it and restart dev server
```

## 🔍 Debug Commands

### Check if webhook URL is set correctly:
```bash
cat .env | grep N8N
```

Should show:
```
N8N_INSTANCE_URL=https://workflows.innovareai.com
N8N_API_KEY=eyJ...
N8N_CAMPAIGN_WEBHOOK_URL=https://workflows.innovareai.com/webhook/campaign-execute-v2
```

### Test webhook directly (without campaign):
```bash
curl -X POST https://workflows.innovareai.com/webhook/campaign-execute-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "test": "manual webhook test",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

Should return: `{"message": "Workflow was started"}`

### View recent n8n executions via API:
```bash
curl -s "https://workflows.innovareai.com/api/v1/executions?workflowId=79ZgBvhtNyx0wEGj&limit=5" \
  -H "X-N8N-API-KEY: YOUR_API_KEY" | jq
```

## 📊 After Successful Test

### Verify in Database:
- Campaign status updated
- Prospects status changed to 'hitl_approval'
- N8N execution record created

### Check Logs:
- Browser console: No errors
- N8N execution logs: Successful steps
- Server logs (if running locally): Campaign processing

### Email Check:
- HITL approval email sent to mg@innovareai.com
- Email contains campaign details
- Approval link works

## 🎉 Ready to Execute!

**Everything is configured and ready. When you're ready:**

1. Go to Sam UI
2. Find "20251102-IAI-Outreach Campaign"
3. Click Activate/Play
4. Watch the magic happen! ✨

---

**Need help?** Check the troubleshooting section above or review the n8n execution logs for detailed error messages.
