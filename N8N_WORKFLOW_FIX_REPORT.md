# N8N Workflow Bug - Root Cause & Fix Report

**Date:** October 29, 2025
**Workflow ID:** aVG6LC4ZFRMN7Bw6
**Workflow Name:** SAM Master Campaign Orchestrator

---

## 🐛 Problem Summary

N8N workflow receives webhook triggers but doesn't execute. Executions complete in 0.03s with NO nodes running and NO data captured. LinkedIn connection requests never sent.

### Symptoms
1. ✅ Webhook responds HTTP 200
2. ✅ Execution record created in N8N
3. ❌ Duration: 0.03s (too fast)
4. ❌ **0 nodes executed** (should be 35 nodes)
5. ❌ No webhook payload captured
6. ❌ LinkedIn CRs never sent

---

## 🔍 Diagnosis Completed

### What I Checked

1. **Workflow Structure** ✅
   - 35 nodes present
   - Connections properly defined
   - Webhook → Workspace Router → Template Selector → Campaign Handler → [rest of flow]

2. **Webhook Configuration** ✅ FIXED
   - **BEFORE:** `responseMode: "lastNode"` ❌
   - **AFTER:** `responseMode: "onReceived"` ✅
   - Path: `/webhook/campaign-execute` ✅
   - Method: POST ✅

3. **Workflow Activation Status** ⚠️ PROBLEM FOUND
   - API shows: `active: true` ✅
   - BUT webhook NOT registered in N8N ❌
   - Test endpoint returns: `"The requested webhook \"campaign-execute\" is not registered"`

4. **Execution Data** ❌ ROOT CAUSE
   - Executions created: Yes
   - Nodes executed: **0** (should be multiple)
   - Status: "success" (false positive)
   - Duration: 0.03s (immediate exit)

---

## 🎯 Root Cause Identified

**N8N webhook NOT properly registered despite workflow showing active=true**

### Why This Happens

N8N has two types of activation:
1. **API activation** (sets `active: true` in database)
2. **Runtime activation** (registers webhook endpoints in memory)

The workflow is API-activated but NOT runtime-activated. This causes:
- Webhook endpoint returns generic "Workflow was started"
- Execution record created (to appear successful)
- Workflow never actually runs
- 0 nodes execute
- Immediate completion (0.03s)

### Evidence

```bash
# Test webhook registration
curl https://workflows.innovareai.com/webhook-test/campaign-execute

# Response:
{
  "code": 404,
  "message": "The requested webhook \"campaign-execute\" is not registered.",
  "hint": "Click the 'Execute workflow' button on the canvas, then try again"
}
```

---

## ✅ Fixes Applied

### 1. Fixed Webhook Response Mode

**File:** `scripts/js/deploy-full-6-message-workflow.mjs`

**Change:**
```javascript
// BEFORE (line 136)
responseMode: "lastNode",  // ❌ Responds immediately, doesn't execute

// AFTER
responseMode: "onReceived", // ✅ Executes asynchronously
```

**Why:** `lastNode` mode responds after workflow completes but N8N has a bug where if the workflow exits immediately (0 nodes), it responds instantly. `onReceived` mode responds immediately then executes in background.

### 2. Fixed Broken .env.local

**File:** `.env.local` (line 46)

**BEFORE:**
```bash
N8N_API_KEY=eyJ...IaAAPIFY_API_TOKEN=apify_api_C79mv...  # ❌ Two keys concatenated
```

**AFTER:**
```bash
N8N_API_KEY=eyJ...IaA
APIFY_API_TOKEN=apify_api_C79mv...
```

### 3. Redeployed Workflow

**Command:** `node scripts/js/deploy-full-6-message-workflow.mjs`

**Result:** ✅ Workflow updated with corrected responseMode

---

## ⚠️ MANUAL FIX REQUIRED

**The workflow requires manual UI activation to register the webhook properly.**

### Steps to Fix (MUST BE DONE):

1. **Access N8N UI:**
   ```
   https://workflows.innovareai.com/workflow/aVG6LC4ZFRMN7Bw6
   ```

2. **Toggle Workflow OFF:**
   - Click the switch at top-right to DEACTIVATE
   - Wait 2-3 seconds

3. **Toggle Workflow ON:**
   - Click the switch again to ACTIVATE
   - Wait 2-3 seconds

4. **Execute Test:**
   - Click "Execute Workflow" button (play icon)
   - This forces N8N to register the webhook

5. **Verify Registration:**
   ```bash
   # Should now work (not return 404)
   curl https://workflows.innovareai.com/webhook-test/campaign-execute
   ```

---

## 🧪 Testing After Fix

### Test 1: Verify Webhook Registration

```bash
curl -X GET https://workflows.innovareai.com/webhook-test/campaign-execute
```

**Expected:** Any response OTHER than "not registered" error

### Test 2: Trigger Workflow

```bash
curl -X POST https://workflows.innovareai.com/webhook/campaign-execute \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "test-fix",
    "campaign_id": "test-campaign",
    "unipile_account_id": "test-account",
    "prospects": [{
      "id": "p1",
      "first_name": "Test",
      "linkedin_url": "https://www.linkedin.com/in/test"
    }],
    "messages": {
      "cr": "Test connection request message"
    },
    "timing": {
      "fu1_delay_days": 2
    }
  }'
```

**Expected:** `{"message":"Workflow was started"}`

### Test 3: Check Execution

```bash
node scripts/js/check-workflow-status.mjs
```

**Expected:**
- Nodes run: **> 0** (should be 5-8 nodes minimum)
- Duration: **> 1s** (should take actual time)
- Status: success or running

### Test 4: Real Campaign

```bash
# Via Next.js API
curl -X POST https://app.meet-sam.com/api/campaigns/linkedin/execute-live \
  -H "Cookie: YOUR_AUTH_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "YOUR_CAMPAIGN_ID",
    "maxProspects": 1
  }'
```

**Expected:**
- Execution ID returned
- LinkedIn CR sent
- Prospect status updated to `connection_requested`

---

## 📊 Verification Checklist

After manual UI activation, verify:

- [ ] Webhook test endpoint returns success (not 404)
- [ ] Webhook triggers return "Workflow was started"
- [ ] Executions show nodes > 0 (not 0)
- [ ] Execution duration > 1s (not 0.03s)
- [ ] Execution details show node data (webhook payload captured)
- [ ] LinkedIn CR actually sends (check LinkedIn UI)
- [ ] Prospect status updates in database

---

## 🔧 Diagnostic Scripts Created

1. **`scripts/js/fix-webhook-response-mode.mjs`**
   - Fixes responseMode configuration
   - Updates workflow via API

2. **`scripts/js/activate-workflow-properly.mjs`**
   - Attempts API activation (insufficient)
   - Provides manual UI instructions

3. **`scripts/js/check-workflow-status.mjs`**
   - Shows workflow structure
   - Lists recent executions
   - Displays nodes executed

---

## 📝 What Was Wrong vs What Is Fixed

| Issue | Before | After | Status |
|-------|--------|-------|--------|
| responseMode | `lastNode` | `onReceived` | ✅ Fixed |
| .env.local API key | Concatenated | Separated | ✅ Fixed |
| Workflow deployment | Old config | New config | ✅ Fixed |
| Webhook registration | Not registered | **Needs manual activation** | ⚠️ Requires UI |

---

## 🎯 Next Steps

### Immediate (Required Before Use):

1. **Manual UI activation** (see steps above)
2. **Verify webhook registration** (Test 1)
3. **Test with 1 prospect** (Test 4)

### After Verification:

1. ✅ Confirm LinkedIn CR sent successfully
2. ✅ Check execution logs in N8N UI
3. ✅ Verify prospect status updated
4. ✅ Monitor for any errors

### Future Prevention:

1. Always activate workflows via UI (not just API)
2. Test webhook registration after deployment
3. Check execution nodes > 0 before considering "success"
4. Add monitoring for 0-node executions (false positives)

---

## 📞 Support Information

**If workflow still doesn't work after UI activation:**

1. Check N8N server logs:
   ```bash
   # SSH into N8N server
   docker logs n8n-container --tail 100
   ```

2. Verify Unipile credentials configured in N8N:
   - Go to: Settings → Credentials
   - Check for Unipile API key credential
   - Test connection

3. Check environment variables in N8N:
   - `UNIPILE_DSN`
   - `UNIPILE_API_KEY`
   - `SAM_API_URL`

4. Contact N8N support with:
   - Workflow ID: `aVG6LC4ZFRMN7Bw6`
   - Execution IDs: 58950, 58951, 58952, 58955
   - Issue: "Webhook executions complete with 0 nodes run"

---

## 🏁 Conclusion

**What was the bug:**
N8N workflow not properly activated, causing webhook to accept requests but never execute nodes.

**What I fixed:**
1. ✅ Webhook responseMode (lastNode → onReceived)
2. ✅ Environment variable (separated N8N and Apify keys)
3. ✅ Redeployed workflow with correct configuration

**What you must do:**
1. ⚠️ **MANUAL UI ACTIVATION** (toggle OFF/ON in N8N UI)
2. ⚠️ **TEST WEBHOOK** (verify registration)
3. ⚠️ **VERIFY EXECUTION** (nodes > 0, duration > 1s)

**When it's working:**
- Executions will show 5-8+ nodes executed (not 0)
- Duration will be 2-5+ seconds (not 0.03s)
- LinkedIn CRs will actually send
- Prospect statuses will update

---

**Created by:** Claude AI (Sonnet 4.5)
**Session:** N8N Workflow Debug - October 29, 2025
**Status:** Fix ready for deployment, requires manual UI activation
