# N8N Workflow Fix - Handoff to Claude Desktop

**Date:** November 2, 2025
**Status:** Ready for Claude Desktop to complete
**Estimated Time:** 15-20 minutes

---

## 🎯 Mission

Fix the N8N workflow so LinkedIn connection requests are actually sent when campaigns are executed.

## 📊 Current Situation

**Problem:**
- Sam AI sends campaign data to N8N webhook ✅
- N8N workflow executes successfully (116ms) ✅
- **BUT:** No LinkedIn connection requests are sent ❌
- **AND:** Prospect statuses stay "queued_in_n8n" instead of "connection_requested" ❌

**Root Cause:**
- The existing N8N workflow has **empty HTTP request bodies**
- All the Unipile API nodes are configured but have no data in the body parameters
- It's like sending an envelope with no letter inside

## 🔧 Solution Created

I've created a **complete fixed workflow** ready to import:

**File Location:** `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/n8n-campaign-workflow-FIXED.json`

**What it does:**
1. ✅ Receives webhook from Sam AI
2. ✅ Extracts campaign data and prospects
3. ✅ Loops through each prospect
4. ✅ Looks up LinkedIn profile ID via Unipile API
5. ✅ Sends connection request via Unipile API (with proper payload!)
6. ✅ Updates prospect status in Supabase database
7. ✅ Adds random 2-5 minute delay between requests (anti-spam)
8. ✅ Loops back for next prospect

---

## 📋 Step-by-Step Tasks for Claude Desktop

### Task 1: Access N8N Dashboard

**URL:** https://innovareai.app.n8n.cloud

**Login credentials:** (user should provide if needed)

**What to verify:**
- Can you access the dashboard?
- Do you see existing workflows?

### Task 2: Check Environment Variables

**Location:** Profile Icon (bottom left) → Settings → Variables

**Required variables:**
```
UNIPILE_DSN = api6.unipile.com:13670
UNIPILE_API_KEY = [value from .env.local file]
```

**Actions:**
- Check if these exist
- If missing, add them
- Get values from: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/.env.local`

### Task 3: Import Fixed Workflow

**Actions:**
1. Click "Workflows" in sidebar
2. Click "+" button (Add Workflow)
3. Click "..." menu (top right)
4. Select "Import from File"
5. Choose file: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/n8n-campaign-workflow-FIXED.json`
6. Click "Import"

**Expected result:**
- New workflow appears: "SAM Campaign Execution - FIXED"
- Shows 9 nodes connected in sequence

### Task 4: Verify Workflow Structure

**Click through each node to verify:**

1. **Campaign Execute Webhook**
   - Path: `campaign-execute-fixed`
   - Method: POST
   - Response mode: On Received

2. **Extract Campaign Data**
   - Type: Code node
   - Should have JavaScript code extracting campaign_id, prospects, messages

3. **Process Each Prospect**
   - Type: Split In Batches
   - Batch size: 1

4. **Get LinkedIn Profile ID**
   - Type: HTTP Request
   - Method: GET
   - URL: `https://{{ $env.UNIPILE_DSN }}/api/v1/users/...`
   - Headers: X-API-KEY with `{{ $env.UNIPILE_API_KEY }}`

5. **Send Connection Request**
   - Type: HTTP Request
   - Method: POST
   - URL: `https://{{ $env.UNIPILE_DSN }}/api/v1/users/invite`
   - **CRITICAL:** Check that "Body Parameters" section has JSON with:
     ```json
     {
       "account_id": "{{ ... }}",
       "user_id": "{{ ... }}",
       "message": "{{ ... }}"
     }
     ```

6. **Update Prospect Status**
   - Type: HTTP Request
   - Method: POST
   - URL: `https://app.meet-sam.com/api/campaigns/update-contacted`

7. **Random Delay (2-5 min)**
   - Type: Wait
   - Amount: Random 2-5 minutes

8. **Loop Back**
   - Type: No Op (just connects back to Process Each Prospect)

### Task 5: Activate Workflow

**Actions:**
1. Click the toggle switch in top right corner
2. Should turn GREEN with text "Active"

**Webhook URL generated:**
`https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed`

### Task 6: Test with Sample Data

**Use N8N's "Test Workflow" feature:**

1. Click "Test workflow" button (top left)
2. The webhook node should show "Waiting for webhook call..."
3. In a terminal, run:

```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
source .env.local

curl -X POST "https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "campaign_id": "test-campaign-123",
  "workspace_id": "babdcab8-1a78-4b2f-913e-6e9fd9821009",
  "campaign_data": {
    "message_templates": {
      "connection_request": "Hi {first_name}, I noticed your work at {company_name}. Would love to connect!"
    },
    "prospects": [
      {
        "id": "test-prospect-1",
        "first_name": "Test",
        "last_name": "User",
        "company": "Test Corp",
        "job_title": "CEO",
        "linkedin_url": "https://linkedin.com/in/testuser"
      }
    ]
  },
  "workspace_config": {
    "integration_config": {
      "linkedin_accounts": [
        {
          "unipile_account_id": "REPLACE_WITH_REAL_UNIPILE_ACCOUNT_ID"
        }
      ]
    }
  }
}
EOF
```

**Note:** Replace `REPLACE_WITH_REAL_UNIPILE_ACCOUNT_ID` with actual Unipile account ID from workspace_accounts table

**Expected behavior:**
- Each node should execute and turn green
- You should see data flowing through each node
- "Send Connection Request" node should show Unipile API response
- "Update Prospect Status" node should show 200 OK response

**If any node fails:**
- Click on the red node
- Check the error message
- Common issues:
  - Missing environment variables
  - Invalid Unipile account ID
  - LinkedIn profile not found
  - Unipile API authentication failed

### Task 7: Update Sam AI API to Use New Webhook

**File to update:** `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/campaigns/linkedin/execute-via-n8n/route.ts`

**Current webhook URL:**
```typescript
const N8N_MASTER_FUNNEL_WEBHOOK = process.env.N8N_CAMPAIGN_WEBHOOK_URL || 'https://innovareai.app.n8n.cloud/webhook/campaign-execute';
```

**Change to:**
```typescript
const N8N_MASTER_FUNNEL_WEBHOOK = process.env.N8N_CAMPAIGN_WEBHOOK_URL || 'https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed';
```

**Or set environment variable:**
```bash
netlify env:set N8N_CAMPAIGN_WEBHOOK_URL "https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed"
```

### Task 8: Test End-to-End

**From Sam AI UI:**

1. Reset test prospects to pending:
   ```bash
   node /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/scripts/js/reset-to-pending.mjs
   ```

2. Go to Sam AI UI: https://app.meet-sam.com
3. Navigate to the campaign: "20251101-IAI-Outreach Campaign"
4. Click "Execute Campaign"
5. Wait for success message

**Verify in N8N:**
- Go to Executions tab in N8N
- Should see new execution
- All nodes should be green
- Check execution time (should be > 2 minutes with delays)

**Verify in Database:**
```bash
node /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/scripts/js/check-campaign-prospects.mjs
```

**Expected output:**
- Status should be `connection_requested` (not `queued_in_n8n`)
- `contacted_at` should have timestamp
- `personalization_data` should have `unipile_message_id`

**Verify on LinkedIn:**
1. Log into LinkedIn account used for campaign
2. Go to: My Network → Manage → Sent
3. Should see connection requests to test prospects

---

## 🔍 Troubleshooting Guide

### Issue 1: "Cannot find environment variable UNIPILE_DSN"

**Solution:**
- Go to N8N Settings → Variables
- Add missing variable with value from `.env.local`

### Issue 2: "Unipile API returned 401 Unauthorized"

**Solution:**
- Check UNIPILE_API_KEY is correct
- Verify API key has not expired
- Test API key manually:
  ```bash
  curl -X GET "https://api6.unipile.com:13670/api/v1/accounts" \
    -H "X-API-KEY: YOUR_KEY"
  ```

### Issue 3: "LinkedIn profile not found"

**Causes:**
- LinkedIn URL format incorrect
- Profile is private
- Unipile account doesn't have access

**Solution:**
- Verify LinkedIn URL format: `https://linkedin.com/in/username`
- Test with a known public profile first

### Issue 4: Node shows "Continue On Fail" but no data passed

**Solution:**
- The node failed but workflow continued
- Click the node to see error details
- Fix the root cause (usually missing data or API error)

### Issue 5: "Random delay too long" (workflow takes hours)

**Solution:**
- The delay is working as intended (2-5 min between each prospect)
- For testing, you can:
  - Reduce delay in "Random Delay" node settings
  - Or skip delay by disconnecting that node temporarily

---

## 📁 Important Files

**Fixed Workflow JSON:**
`/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/n8n-campaign-workflow-FIXED.json`

**Environment Variables:**
`/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/.env.local`

**Sam API Route:**
`/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/campaigns/linkedin/execute-via-n8n/route.ts`

**Test Scripts:**
- Reset prospects: `scripts/js/reset-to-pending.mjs`
- Check status: `scripts/js/check-campaign-prospects.mjs`
- Test webhook: `scripts/js/test-n8n-webhook.mjs`

**Diagnostic Report:**
`/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/N8N_WORKFLOW_CONFIG_REQUIRED.md`

---

## ✅ Success Criteria

**You'll know it's working when:**

1. ✅ N8N execution completes with all green nodes
2. ✅ Execution time is > 2 minutes (due to delays)
3. ✅ Database shows `status='connection_requested'`
4. ✅ Database has `unipile_message_id` in personalization_data
5. ✅ LinkedIn shows connection request in "Sent" folder
6. ✅ No errors in N8N execution logs
7. ✅ Sam AI UI shows "X connection requests sent"

---

## 🎯 Your Mission Summary

**Claude Desktop, please:**

1. Access N8N at https://innovareai.app.n8n.cloud
2. Import the fixed workflow from `n8n-campaign-workflow-FIXED.json`
3. Verify environment variables are set
4. Activate the workflow
5. Test with sample data
6. Update Sam AI to use new webhook URL
7. Test end-to-end from Sam UI
8. Verify LinkedIn connection requests actually sent

**Report back:**
- ✅ Which steps completed successfully
- ❌ Any errors encountered
- 📊 Screenshots of successful execution
- 🔍 Verification that connection requests appeared on LinkedIn

---

**Good luck! This should take about 15-20 minutes total.**

**If you get stuck, reference the detailed diagnostic report in:**
`N8N_WORKFLOW_CONFIG_REQUIRED.md`
