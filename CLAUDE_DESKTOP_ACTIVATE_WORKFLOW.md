# 🚨 URGENT: Activate N8N Workflow - Instructions for Claude Desktop

**Date:** November 2, 2025
**Status:** Workflow imported but NOT ACTIVATED
**Issue:** User tried to execute campaign but "no campaign name appeared" - workflow is inactive

---

## ✅ What You've Done So Far

- ✅ Imported workflow: "Campaign Execute - LinkedIn via Unipile (Complete)"
- ✅ Workflow ID: `2bmFPN5t2y6A4Rx2`
- ✅ Has 39 nodes (full 6-step funnel with follow-ups)
- ❌ **BUT: Workflow is INACTIVE** (this is why nothing happened)

---

## 🎯 IMMEDIATE ACTION REQUIRED

### Step 1: Activate the Workflow

**Go to:** https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2

**Action:**
1. Find the toggle switch in **top-right corner** of the workflow editor
2. Click it to turn it **GREEN** (Active)
3. You should see "Active" text appear

**What this does:**
- Makes the webhook endpoint live at: `/webhook/campaign-execute-fixed`
- Allows the workflow to receive and process campaign execution requests

---

### Step 2: Verify Webhook Path

**While in the workflow editor:**

1. Click on the **first node** (should be "Webhook" node)
2. Check the **"Path"** field shows: `campaign-execute-fixed`
3. If different, change it to: `campaign-execute-fixed`
4. Click **"Save"** in top-right

**Expected webhook URL:**
```
https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed
```

---

### Step 3: Check Environment Variables

**Go to:** Profile Icon (bottom-left) → Settings → Variables

**Verify these exist:**
```
UNIPILE_DSN = api6.unipile.com:13670
UNIPILE_API_KEY = aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=
```

**If missing:**
1. Click "Add Variable"
2. Enter name and value
3. Click "Save"

---

### Step 4: Test the Workflow

**Option A: Quick Test via N8N Interface**

1. In the workflow editor, click **"Test workflow"** button (top-left)
2. The webhook node should show "Waiting for webhook call..."
3. Keep this window open
4. Open a new terminal and run:

```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
node scripts/js/reset-to-pending.mjs
```

5. Then in Sam UI (https://app.meet-sam.com), execute the campaign
6. Watch N8N workflow execute in real-time

**Expected Result:**
- Each node should turn **green** as it executes
- You should see data flowing through each node
- Execution should take several minutes (due to delays)

---

**Option B: Direct Webhook Test (Faster)**

In terminal:
```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7

curl -X POST "https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "5067bfd4-e4c6-4082-a242-04323c8860c8",
    "workspace_id": "babdcab8-1a78-4b2f-913e-6e9fd9821009",
    "unipile_account_id": "GET_FROM_WORKSPACE_ACCOUNTS_TABLE",
    "prospects": [
      {
        "id": "test-1",
        "first_name": "Test",
        "last_name": "User",
        "linkedin_url": "https://linkedin.com/in/testuser"
      }
    ],
    "message_templates": {
      "connection_request": "Hi {first_name}, test message"
    }
  }'
```

**Note:** Replace `GET_FROM_WORKSPACE_ACCOUNTS_TABLE` with actual Unipile account ID

---

### Step 5: Verify Success

**Check 1: N8N Executions Page**
- Go to: https://innovareai.app.n8n.cloud/executions
- Find latest execution
- Should show:
  - ✅ Status: Success
  - ✅ Workflow Name: "Campaign Execute - LinkedIn via Unipile (Complete)"
  - ✅ All nodes GREEN
  - ✅ Execution time > 2 minutes (if delays are in workflow)

**Check 2: Database**
```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
node scripts/js/check-campaign-prospects.mjs
```

Expected:
- Status: `connection_requested` (not `queued_in_n8n`)
- Has `contacted_at` timestamp
- Has `unipile_message_id` in personalization_data

**Check 3: LinkedIn**
- Go to: https://linkedin.com/mynetwork/invitation-manager/sent/
- Should see connection request to test prospect

---

## 🔍 Troubleshooting

### Issue: "Workflow is inactive"
**Solution:** You forgot to activate it. Go back to Step 1.

### Issue: "Webhook not found"
**Solution:**
- Verify webhook path is `campaign-execute-fixed`
- Make sure workflow is saved after activation

### Issue: "Environment variable not found"
**Solution:** Go to Settings → Variables and add missing variables

### Issue: "Unipile API 401 Unauthorized"
**Solution:** Check that UNIPILE_API_KEY is correct in environment variables

### Issue: Nodes are RED in execution
**Solution:**
1. Click on the red node
2. Read the error message
3. Common issues:
   - Missing Unipile account ID in payload
   - Invalid LinkedIn URL format
   - Unipile account not connected

---

## 📊 Success Criteria

**You'll know it's working when:**

1. ✅ Workflow toggle is GREEN (Active)
2. ✅ N8N execution completes with all green nodes
3. ✅ Execution shows workflow name: "Campaign Execute - LinkedIn via Unipile (Complete)"
4. ✅ Database shows `status='connection_requested'`
5. ✅ LinkedIn shows connection request in "Sent" folder
6. ✅ User reports "campaign name appeared" when executing

---

## 🎯 What Went Wrong Before

**User said:** "nope. no campaign name appeared"

**Root Cause:** Workflow was imported but NOT activated

**What should have happened:**
1. User executes campaign in Sam UI
2. Sam API calls N8N webhook
3. N8N workflow processes prospects
4. Database updates to `connection_requested`
5. User sees "X connection requests sent" message

**What actually happened:**
1. User executes campaign in Sam UI
2. Sam API calls N8N webhook
3. ❌ Webhook returns 404/error (workflow inactive)
4. ❌ Prospects stay in `queued_in_n8n` status
5. ❌ No campaign name appeared

---

## 🚀 After You Activate

**Tell the user:**
1. ✅ Workflow is now active
2. ✅ Ready to test campaign execution
3. 🧪 Recommend testing with 1-2 prospects first
4. 📊 Monitor N8N executions page for any errors

**Then have user:**
1. Reset prospects: `node scripts/js/reset-to-pending.mjs`
2. Execute campaign in Sam UI
3. Watch for success message with campaign name
4. Verify connection requests on LinkedIn

---

## 📁 Key Files

**Workflow in N8N:**
- URL: https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2
- Name: "Campaign Execute - LinkedIn via Unipile (Complete)"
- Webhook: `/webhook/campaign-execute-fixed`

**Sam API Route:**
- File: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/campaigns/linkedin/execute-via-n8n/route.ts`
- Webhook URL: `https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed`

**Test Scripts:**
- Reset prospects: `scripts/js/reset-to-pending.mjs`
- Check status: `scripts/js/check-campaign-prospects.mjs`

---

**BOTTOM LINE: Just activate the workflow and it should work!**

User already imported it correctly - just needs to click the toggle switch to make it active.
