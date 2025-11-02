# 🔍 N8N Campaign Workflow - Challenges & Investigation Required

**Date:** November 2, 2025
**Status:** CRITICAL - Requires Claude Desktop Investigation
**Context:** Multiple issues encountered during N8N workflow setup and testing

---

## 📋 Executive Summary

We've been working on fixing the N8N campaign execution workflow for LinkedIn outreach. While we've made significant progress, **several critical issues remain unresolved**. This document details:

1. All challenges encountered
2. What we've tried
3. What still needs investigation
4. Specific tasks for Claude Desktop

---

## 🚨 CRITICAL ISSUE #1: Workflow Imported But Not Activated

### Problem Description

**User Report:** "nope. no campaign name appeared"

**What happened:**
- User executed a campaign from Sam AI UI
- Expected to see: "Campaign activated! X connection requests sent"
- Actually saw: No campaign name, no confirmation message
- Database shows prospects stuck in `queued_in_n8n` status (never moved to `connection_requested`)

### Root Cause Analysis

**Investigation findings:**

1. **N8N API check revealed:**
   - Workflow ID `2bmFPN5t2y6A4Rx2` exists
   - Name: "Campaign Execute - LinkedIn via Unipile (Complete)"
   - Status: **INACTIVE** ❌
   - Last updated: November 1, 2025, 21:07:17 UTC

2. **Recent N8N executions:**
   ```json
   {
     "id": "234847",
     "workflowName": null,
     "status": "success",
     "startedAt": "2025-11-01T21:00:25.085Z",
     "stoppedAt": "2025-11-01T21:00:25.291Z"
   }
   ```
   - Execution time: **206ms** (way too fast for real campaign)
   - `workflowName: null` (suspicious - workflow not associated)
   - These are executions of a DIFFERENT workflow (Scheduler)

3. **Database state:**
   ```
   Total prospects: 4
   Status: queued_in_n8n (all 4 stuck here)
   contacted_at: null (never contacted)
   ```

### What This Means

**The workflow webhook endpoint is NOT responding because the workflow is INACTIVE.**

When Sam AI calls:
```
POST https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed
```

N8N returns 404/error because no active workflow has that webhook path.

### Required Investigation

**Claude Desktop, please verify:**

1. ✅ **Is the workflow actually activated?**
   - Go to: https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2
   - Check toggle in top-right corner
   - Should be GREEN with "Active" text
   - Current state: Likely still INACTIVE

2. ✅ **What is the webhook path?**
   - Click on the "Webhook" node (first node)
   - Check the "Path" field
   - Expected: `campaign-execute-fixed`
   - Report actual value

3. ✅ **What webhook URL is generated when active?**
   - After activating, N8N should show webhook URL
   - Expected: `https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed`
   - Copy and confirm exact URL

4. ✅ **Test webhook accessibility:**
   ```bash
   curl -X POST "https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed" \
     -H "Content-Type: application/json" \
     -d '{"test": "ping"}'
   ```
   - If 404: Workflow not active or wrong path
   - If 200: Webhook is live and accessible

---

## 🚨 CRITICAL ISSUE #2: Previous Workflow Executions Show No Data

### Problem Description

**Observation:**
Multiple N8N executions completed "successfully" but with:
- Execution time: 116ms - 206ms
- Result data: `null`
- Workflow name: `null`
- No actual LinkedIn requests sent

### Examples

```json
Execution #234846:
- Duration: 116ms
- Status: "success"
- Workflow: null
- Data: null

Execution #234847:
- Duration: 206ms
- Status: "success"
- Workflow: null
- Data: null
```

### Investigation Questions

**Claude Desktop, please investigate:**

1. ✅ **What workflow were these executions running?**
   - Check execution details for #234846 and #234847
   - Look at the workflow ID in execution metadata
   - Verify which workflow was actually triggered

2. ✅ **Why is execution data null?**
   - Click into execution details
   - Check each node's input/output
   - Look for error messages or warnings
   - Report what each node shows

3. ✅ **Did the webhook receive any data?**
   - Check the Webhook node output in executions
   - Should show the campaign data payload from Sam AI
   - If empty: Webhook wasn't called or received no data
   - If has data: Report what was received

4. ✅ **Check for errors in error handler nodes:**
   - Look for "Error Handler" node in executions
   - Check if it was triggered
   - Report any error messages

---

## 🚨 CRITICAL ISSUE #3: Multiple Workflow Versions Exist

### Problem Description

**We found 3+ campaign execution workflows in N8N:**

1. **"SAM Campaign Execution"** (ID: `1bUZ77wUdA2jDvUY`)
   - Status: INACTIVE
   - Last updated: Oct 31, 2025, 03:13:40 UTC

2. **"Campaign Execute - LinkedIn via Unipile (Complete)"** (ID: `2bmFPN5t2y6A4Rx2`)
   - Status: INACTIVE
   - Last updated: Nov 1, 2025, 21:07:17 UTC
   - **This is the one we want to use** ✅
   - Has 39 nodes (full funnel with 6 follow-ups)

3. **"SAM Campaign Execution - FULL"** (ID: `pOchCQ86pHCpOeaV`)
   - Status: INACTIVE
   - Last updated: Oct 31, 2025, 03:16:06 UTC

### Confusion

**Which workflow should be active?**
- All 3 are currently inactive
- They may have different webhook paths
- They may have different node configurations

### Required Investigation

**Claude Desktop, please:**

1. ✅ **Compare the 3 workflows:**
   - Open each workflow in N8N
   - Count how many nodes each has
   - Check webhook paths for each
   - Report differences

2. ✅ **Verify workflow #2 is the correct one:**
   - ID: `2bmFPN5t2y6A4Rx2`
   - Should have ~39 nodes
   - Should include: CR + 6 follow-ups + delays + error handling
   - Confirm this is the complete funnel

3. ✅ **Deactivate/archive old workflows:**
   - We only need ONE active campaign workflow
   - Recommend deactivating or deleting workflows #1 and #3
   - Prevents confusion and accidental triggers

4. ✅ **Update webhook path if needed:**
   - Ensure only workflow #2 uses `/webhook/campaign-execute-fixed`
   - Other workflows should use different paths or be inactive

---

## 🚨 ISSUE #4: Environment Variables Not Verified

### Problem Description

**Required environment variables:**
- `UNIPILE_DSN` = `api6.unipile.com:13670`
- `UNIPILE_API_KEY` = `aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=`

**Status:** Unknown if these are set in N8N

### Why This Matters

**All Unipile API nodes reference these variables:**

```javascript
// In "Get LinkedIn Profile ID" node
URL: https://{{ $env.UNIPILE_DSN }}/api/v1/users/...
Headers: X-API-KEY: {{ $env.UNIPILE_API_KEY }}
```

**If variables are missing:**
- URL becomes: `https:///api/v1/users/...` (broken)
- API calls fail with 401 Unauthorized
- Workflow fails silently or with generic errors

### Required Investigation

**Claude Desktop, please verify:**

1. ✅ **Check N8N environment variables:**
   - Go to: Profile Icon → Settings → Variables
   - Look for: `UNIPILE_DSN` and `UNIPILE_API_KEY`
   - Report if they exist

2. ✅ **Verify values are correct:**
   - `UNIPILE_DSN` should be: `api6.unipile.com:13670`
   - `UNIPILE_API_KEY` should be: `aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=`
   - If different or missing, add them

3. ✅ **Test Unipile API access:**
   ```bash
   curl -X GET "https://api6.unipile.com:13670/api/v1/accounts" \
     -H "X-API-KEY: aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU="
   ```
   - Should return list of Unipile accounts
   - If 401: API key is invalid
   - If connection error: DSN is wrong

4. ✅ **Verify LinkedIn account is connected:**
   - Check Unipile dashboard or API response
   - Should show at least one LinkedIn account
   - Status should be "OK" or "ACTIVE"
   - Get the `account_id` for testing

---

## 🚨 ISSUE #5: Sam AI Route May Be Calling Wrong Webhook

### Problem Description

**Sam AI route configuration:**

File: `/app/api/campaigns/linkedin/execute-via-n8n/route.ts`

**Current webhook URL (line 85 in route.ts):**
```typescript
const N8N_MASTER_FUNNEL_WEBHOOK = process.env.N8N_CAMPAIGN_WEBHOOK_URL
  || 'https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed';
```

**Environment variable in .env.local (line 85):**
```bash
N8N_CAMPAIGN_WEBHOOK_URL=https://innovareai.app.n8n.cloud/webhook/campaign-execute
```

### The Problem

**There's a mismatch:**
- Environment variable says: `/webhook/campaign-execute` (no "-fixed")
- Code fallback says: `/webhook/campaign-execute-fixed` (with "-fixed")

**Which one is Sam AI actually calling?**
- If using env var: Calling `/campaign-execute` (OLD workflow path)
- If env var missing: Calling `/campaign-execute-fixed` (NEW workflow path)

### Required Investigation

**Claude Desktop, please verify:**

1. ✅ **Check which webhook path is actually configured:**
   - Look at N8N workflow #2 webhook node
   - Confirm path is: `campaign-execute-fixed` or `campaign-execute`

2. ✅ **Check if there's a workflow on the OLD path:**
   - Search N8N for workflows with path `campaign-execute`
   - If exists, check if it's active
   - This could be receiving the calls instead!

3. ✅ **Test both webhook URLs:**
   ```bash
   # Test OLD path
   curl -X POST "https://innovareai.app.n8n.cloud/webhook/campaign-execute" \
     -H "Content-Type: application/json" \
     -d '{"test": "old-path"}'

   # Test NEW path
   curl -X POST "https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed" \
     -H "Content-Type: application/json" \
     -d '{"test": "new-path"}'
   ```
   - Report which ones return 200 vs 404

4. ✅ **Update environment variable if needed:**
   - If workflow uses `campaign-execute-fixed`, update .env.local:
   ```bash
   N8N_CAMPAIGN_WEBHOOK_URL=https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed
   ```
   - Then redeploy to Netlify

---

## 🚨 ISSUE #6: Payload Structure Not Verified

### Problem Description

**Sam AI sends this payload structure:**

```typescript
{
  campaign_id: string,
  workspace_id: string,
  campaign_data: {
    message_templates: {
      connection_request: string,
      alternative_message: string,
      follow_up_1?: string,
      // ... etc
    },
    prospects: Array<{
      id: string,
      first_name: string,
      last_name: string,
      company: string,
      job_title: string,
      linkedin_url: string,
      // ... etc
    }>
  },
  workspace_config: {
    integration_config: {
      linkedin_accounts: Array<{
        unipile_account_id: string
      }>
    }
  }
}
```

**N8N workflow expects this in "Extract Campaign Data" node:**

```javascript
const webhookData = $input.all()[0].json;

return [{
  json: {
    campaign_id: webhookData.campaign_id,
    workspace_id: webhookData.workspace_id,
    prospects: webhookData.campaign_data?.prospects || [],
    messages: webhookData.campaign_data?.message_templates || {},
    unipile_account_id: webhookData.workspace_config?.integration_config?.linkedin_accounts?.[0]?.unipile_account_id,
    total_prospects: (webhookData.campaign_data?.prospects || []).length
  }
}];
```

### Potential Issues

1. **Missing fields:** If Sam AI doesn't send all fields, workflow may fail
2. **Wrong nesting:** If payload structure is different, extraction fails
3. **Null values:** If optional fields are missing, nodes may error

### Required Investigation

**Claude Desktop, please:**

1. ✅ **Test webhook with actual payload:**
   ```bash
   cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7

   # First, get a real Unipile account ID
   # Check database: SELECT unipile_account_id FROM workspace_accounts
   # WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'

   # Then test webhook
   curl -X POST "https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed" \
     -H "Content-Type: application/json" \
     -d '{
       "campaign_id": "5067bfd4-e4c6-4082-a242-04323c8860c8",
       "workspace_id": "babdcab8-1a78-4b2f-913e-6e9fd9821009",
       "campaign_data": {
         "message_templates": {
           "connection_request": "Hi {first_name}, noticed your work at {company}. Would love to connect!"
         },
         "prospects": [{
           "id": "test-1",
           "first_name": "Test",
           "last_name": "User",
           "company": "Test Corp",
           "job_title": "CEO",
           "linkedin_url": "https://linkedin.com/in/testuser"
         }]
       },
       "workspace_config": {
         "integration_config": {
           "linkedin_accounts": [{
             "unipile_account_id": "REPLACE_WITH_REAL_ACCOUNT_ID"
           }]
         }
       }
     }'
   ```

2. ✅ **Check N8N execution:**
   - Go to executions page immediately after curl
   - Open the execution
   - Check "Webhook" node output - should show received payload
   - Check "Extract Campaign Data" node output - should show extracted fields
   - Report any null or missing values

3. ✅ **Verify data flows through all nodes:**
   - Each node should show input/output data
   - Check that prospect data reaches "Send Connection Request" node
   - Verify Unipile account ID is present where needed

---

## 🚨 ISSUE #7: Database Update Endpoint Not Tested

### Problem Description

**The workflow has multiple "Update Status" nodes:**

1. "Update Status CR Sent" - After connection request
2. "Update FU1 Sent" - After follow-up 1
3. "Update FU2 Sent" - After follow-up 2
4. ... etc

**Each calls Sam AI API:**
```
POST https://app.meet-sam.com/api/campaigns/update-contacted
```

**Payload:**
```json
{
  "prospect_id": "...",
  "status": "connection_requested",
  "contacted_at": "2025-11-02T...",
  "unipile_message_id": "..."
}
```

### Potential Issues

1. **Endpoint doesn't exist:** Returns 404
2. **Authentication fails:** API requires auth token
3. **Wrong payload structure:** API expects different fields
4. **CORS issues:** API blocks N8N requests

### Required Investigation

**Claude Desktop, please:**

1. ✅ **Verify the API endpoint exists:**
   ```bash
   curl -X POST "https://app.meet-sam.com/api/campaigns/update-contacted" \
     -H "Content-Type: application/json" \
     -d '{
       "prospect_id": "test-prospect-1",
       "status": "connection_requested",
       "contacted_at": "2025-11-02T21:30:00.000Z",
       "unipile_message_id": "msg_test123"
     }'
   ```
   - Report status code
   - If 404: Endpoint doesn't exist
   - If 401: Authentication required
   - If 200: Check response body

2. ✅ **Check if endpoint requires authentication:**
   - Look at Sam AI route code
   - See if it checks for auth headers
   - If yes, N8N needs to send auth token

3. ✅ **Test actual database update:**
   - Use a real prospect ID from database
   - Call the endpoint
   - Check if database was updated:
   ```bash
   node scripts/js/check-campaign-prospects.mjs
   ```

4. ✅ **Check N8N node configuration:**
   - Open workflow
   - Click "Update Status CR Sent" node
   - Verify URL and headers are correct
   - Check if it has authentication configured

---

## 🚨 ISSUE #8: LinkedIn Profile Lookup May Fail

### Problem Description

**The workflow needs to lookup LinkedIn user IDs:**

```
GET https://api6.unipile.com:13670/api/v1/users/{username}
  ?account_id={unipile_account_id}
  &provider=LINKEDIN
```

**Extracts username from LinkedIn URL:**
```javascript
// From: https://linkedin.com/in/johndoe
// Extract: johndoe
const username = linkedin_url.split('/in/')[1].replace('/', '')
```

### Potential Issues

1. **LinkedIn URL format variations:**
   - `https://www.linkedin.com/in/johndoe/`
   - `https://linkedin.com/in/johndoe`
   - `linkedin.com/in/johndoe`
   - `https://www.linkedin.com/in/johndoe?trk=...`

2. **Username extraction fails for:**
   - URLs with trailing slashes
   - URLs with query parameters
   - URLs with other paths (e.g., `/company/`, `/school/`)

3. **Unipile API returns 404:**
   - Profile doesn't exist
   - Profile is private
   - Account doesn't have access

### Required Investigation

**Claude Desktop, please:**

1. ✅ **Test username extraction logic:**
   - Check the "Extract Username" node code
   - Test with various URL formats
   - Report if it handles edge cases

2. ✅ **Test Unipile profile lookup:**
   ```bash
   # Use a real LinkedIn profile
   curl -X GET "https://api6.unipile.com:13670/api/v1/users/williamhgates" \
     -H "X-API-KEY: aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=" \
     -d "account_id=YOUR_UNIPILE_ACCOUNT_ID" \
     -d "provider=LINKEDIN"
   ```
   - Should return profile with `id` field
   - If 404: Profile not accessible
   - Report the response structure

3. ✅ **Verify "Continue on Fail" is enabled:**
   - Open workflow
   - Click "Lookup LinkedIn Profile" node
   - Check "Continue on Fail" checkbox
   - If disabled, failed lookups will stop entire workflow

---

## 🚨 ISSUE #9: Connection Acceptance Check Not Tested

### Problem Description

**The workflow checks if connection was accepted:**

```
GET https://api6.unipile.com:13670/api/v1/users/{username}/relations
```

**Expected response:**
```json
{
  "relations": [
    {
      "type": "CONNECTED",
      "user": { ... }
    }
  ]
}
```

**"Parse Connection Status" node extracts:**
```javascript
const isConnected = response.relations.some(r => r.type === "CONNECTED")
```

### Potential Issues

1. **Unipile doesn't support this endpoint**
2. **Response structure is different**
3. **Connection status is named differently** (e.g., "ACCEPTED", "1ST_DEGREE")
4. **Endpoint requires different parameters**

### Required Investigation

**Claude Desktop, please:**

1. ✅ **Test the relations endpoint:**
   ```bash
   curl -X GET "https://api6.unipile.com:13670/api/v1/users/YOUR_USERNAME/relations" \
     -H "X-API-KEY: aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=" \
     -d "account_id=YOUR_UNIPILE_ACCOUNT_ID"
   ```
   - Report the response structure
   - Check what field indicates connection status

2. ✅ **Verify parsing logic:**
   - Open "Parse Connection Status" node
   - Check the code
   - Verify it matches actual Unipile response format

3. ✅ **Check Unipile documentation:**
   - Go to: https://developer.unipile.com
   - Search for "relations" or "connections" endpoint
   - Confirm the correct endpoint and response format

4. ✅ **Consider alternative approach:**
   - If relations endpoint doesn't work
   - Maybe use: GET /api/v1/messages to check for replies
   - Or skip connection check and send FU1 regardless

---

## 🚨 ISSUE #10: Message Sending Not Verified

### Problem Description

**The workflow sends messages via Unipile:**

```
POST https://api6.unipile.com:13670/api/v1/users/invite
```

**Payload:**
```json
{
  "account_id": "...",
  "user_id": "...",
  "message": "Personalized message here"
}
```

**And for follow-ups:**
```
POST https://api6.unipile.com:13670/api/v1/chats/messages
```

**Payload:**
```json
{
  "account_id": "...",
  "attendees": ["user_id"],
  "text": "Follow-up message"
}
```

### Potential Issues

1. **Connection request endpoint:**
   - Returns 200 but doesn't actually send
   - Requires different fields
   - Message too long (LinkedIn limit: 300 chars)

2. **Follow-up message endpoint:**
   - Wrong endpoint for LinkedIn messages
   - Requires chat thread ID
   - Permissions issue

3. **Message personalization:**
   - Variables not replaced correctly
   - Missing prospect data causes blank fields

### Required Investigation

**Claude Desktop, please:**

1. ✅ **Test connection request sending:**
   ```bash
   # Get user_id from profile lookup first
   # Then send connection request
   curl -X POST "https://api6.unipile.com:13670/api/v1/users/invite" \
     -H "X-API-KEY: aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=" \
     -H "Content-Type: application/json" \
     -d '{
       "account_id": "YOUR_UNIPILE_ACCOUNT_ID",
       "user_id": "USER_ID_FROM_LOOKUP",
       "message": "Hi! Test connection request."
     }'
   ```
   - Should return message ID
   - Check LinkedIn to see if request actually sent

2. ✅ **Test follow-up message sending:**
   ```bash
   curl -X POST "https://api6.unipile.com:13670/api/v1/chats/messages" \
     -H "X-API-KEY: aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=" \
     -H "Content-Type: application/json" \
     -d '{
       "account_id": "YOUR_UNIPILE_ACCOUNT_ID",
       "attendees": ["USER_ID"],
       "text": "Test follow-up message"
     }'
   ```
   - Should return message ID
   - Check LinkedIn inbox for message

3. ✅ **Verify message personalization:**
   - Check "Personalize CR" node
   - Test with sample prospect data
   - Verify all {variables} are replaced

4. ✅ **Check message length limits:**
   - Connection request: Max 300 characters
   - Follow-up messages: Max 2000 characters
   - Workflow should truncate or warn if too long

---

## 🚨 ISSUE #11: Wait/Delay Timing Not Verified

### Problem Description

**The workflow has wait nodes with these configurations:**

1. "Wait 6 Hours for FU1": `6` hours
2. "Wait for FU2": `3 * 24` hours (3 days)
3. "Wait for FU3": `5 * 24` hours (5 days)
4. "Wait for FU4": `5 * 24` hours (5 days)
5. "Wait for FU5": `5 * 24` hours (5 days)
6. "Wait for FU6": `5 * 24` hours (5 days)

**Total duration:** ~23 days per prospect

### Potential Issues

1. **Wait nodes use wrong time unit:**
   - Configured as hours but N8N interprets as minutes
   - Or vice versa

2. **Dynamic timing doesn't work:**
   - Formula: `{{$node['Split Prospects'].json.timing.fu2_delay_days || 3}}`
   - If timing object not in payload, may error instead of using default

3. **N8N doesn't support long waits:**
   - Max wait time might be 24 hours
   - 5-day waits might timeout

4. **Workflow execution pauses:**
   - N8N may not resume after wait completes
   - Requires manual trigger

### Required Investigation

**Claude Desktop, please:**

1. ✅ **Check wait node configuration:**
   - Open each "Wait" node
   - Verify time unit (hours vs minutes vs days)
   - Report exact configuration

2. ✅ **Test short wait:**
   - Temporarily change "Wait 6 Hours" to "Wait 1 Minute"
   - Execute workflow
   - Verify it resumes after 1 minute
   - Check next nodes execute automatically

3. ✅ **Check N8N documentation:**
   - Look up max wait time supported
   - See if long waits require special configuration
   - Report any limitations

4. ✅ **Test with "Execute Once":**
   - Use N8N "Execute Once" mode for testing
   - Set wait to 1 minute
   - Confirm workflow completes end-to-end

---

## 🚨 ISSUE #12: Error Handling Not Verified

### Problem Description

**The workflow has error handling nodes:**

1. "Error Handler" - Catches errors from any node
2. "Update Failed Status" - Marks prospect as failed in database

**Expected behavior:**
- If any node fails, error handler catches it
- Logs the error details
- Updates prospect status to "failed"
- Continues with next prospect (doesn't stop entire workflow)

### Potential Issues

1. **Error handler not connected to all nodes**
2. **Error handler doesn't capture all error types**
3. **Failed prospect blocks the queue**
4. **No retry logic for transient failures**

### Required Investigation

**Claude Desktop, please:**

1. ✅ **Verify error handler connections:**
   - Open workflow in editor
   - Look for red error connection lines
   - Verify error handler is connected to critical nodes

2. ✅ **Test error handling:**
   - Temporarily break a node (e.g., wrong API URL)
   - Execute workflow
   - Verify error handler catches the error
   - Check if workflow continues with next prospect

3. ✅ **Check error logging:**
   - Look at failed execution
   - Verify error message is descriptive
   - Check if error details are saved to database

4. ✅ **Review retry strategy:**
   - Check if critical nodes have retry configured
   - Recommended: 3 retries with exponential backoff
   - Configure if missing

---

## 📊 Investigation Checklist

**Claude Desktop, please complete this checklist:**

### Workflow Activation & Configuration

- [ ] Workflow `2bmFPN5t2y6A4Rx2` is ACTIVE (green toggle)
- [ ] Webhook path is: `campaign-execute-fixed`
- [ ] Webhook URL is accessible (test with curl)
- [ ] Environment variables are set (UNIPILE_DSN, UNIPILE_API_KEY)
- [ ] No other workflows are using the same webhook path

### Workflow Structure

- [ ] Workflow has 39 nodes (counted in editor)
- [ ] All nodes are connected properly
- [ ] Error handler is connected
- [ ] Wait nodes have correct time units
- [ ] Webhook node shows correct path

### External API Testing

- [ ] Unipile API accessible (test with curl)
- [ ] LinkedIn account connected in Unipile
- [ ] Profile lookup works (`GET /users/{username}`)
- [ ] Connection request works (`POST /users/invite`)
- [ ] Follow-up messages work (`POST /chats/messages`)
- [ ] Relations check works (`GET /users/{username}/relations`)

### Sam AI Integration

- [ ] Sam AI route points to correct webhook URL
- [ ] Payload structure matches workflow expectations
- [ ] Database update endpoint exists and works
- [ ] Test campaign execution succeeds
- [ ] Prospects update to `connection_requested` status

### End-to-End Testing

- [ ] Reset test prospects (`node scripts/js/reset-to-pending.mjs`)
- [ ] Execute campaign from Sam AI UI
- [ ] N8N execution appears in executions list
- [ ] All nodes turn green
- [ ] Database updates correctly
- [ ] LinkedIn shows connection requests sent

### Monitoring & Verification

- [ ] Execution time is reasonable (not 100ms)
- [ ] Execution shows workflow name (not null)
- [ ] Webhook node shows received data
- [ ] Each node shows input/output data
- [ ] No error nodes are triggered
- [ ] Wait nodes pause execution correctly

---

## 🎯 Priority Actions

**HIGH PRIORITY (Do First):**

1. **Activate the workflow**
   - Go to workflow and toggle to active
   - This is likely causing 90% of issues

2. **Verify environment variables**
   - Set UNIPILE_DSN and UNIPILE_API_KEY
   - Test Unipile API access

3. **Test webhook endpoint**
   - Use curl to send test payload
   - Verify execution appears in N8N

**MEDIUM PRIORITY (Do Next):**

4. **Test Unipile APIs**
   - Profile lookup
   - Connection request
   - Message sending

5. **Verify database updates**
   - Test update endpoint
   - Check prospects status changes

**LOW PRIORITY (Nice to Have):**

6. **Test error handling**
7. **Verify long wait durations**
8. **Test connection acceptance check**

---

## 📝 Reporting Template

**Claude Desktop, please fill out this report:**

```markdown
# N8N Investigation Report

**Date:** [Fill in]
**Investigator:** Claude Desktop

## Issue #1: Workflow Activation

- **Status:** [ ] Active  [ ] Inactive
- **Webhook Path:** [Fill in]
- **Webhook URL:** [Fill in]
- **Test Result:** [200 / 404 / Error]
- **Notes:** [Any observations]

## Issue #2: Environment Variables

- **UNIPILE_DSN Set:** [ ] Yes  [ ] No
- **UNIPILE_API_KEY Set:** [ ] Yes  [ ] No
- **Unipile API Test:** [ ] Success  [ ] Failed
- **Error Message:** [If failed]

## Issue #3: Workflow Structure

- **Node Count:** [Number]
- **Webhook Path in Node:** [Fill in]
- **Error Handler Connected:** [ ] Yes  [ ] No
- **Wait Nodes Time Unit:** [hours / minutes / days]

## Issue #4: External API Testing

**Profile Lookup:**
- **Endpoint:** [URL tested]
- **Result:** [ ] Success  [ ] Failed
- **Response:** [Paste response]

**Connection Request:**
- **Endpoint:** [URL tested]
- **Result:** [ ] Success  [ ] Failed
- **Message ID Returned:** [Yes / No]

**LinkedIn Verification:**
- **Request Appeared:** [ ] Yes  [ ] No
- **Screenshot:** [Optional]

## Issue #5: Sam AI Integration

**Webhook Test:**
- **Execution Created:** [ ] Yes  [ ] No
- **Execution ID:** [Fill in]
- **Webhook Data Received:** [ ] Yes  [ ] No
- **Data Structure:** [Correct / Missing fields / Wrong format]

**Database Update:**
- **Endpoint Works:** [ ] Yes  [ ] No
- **Prospects Updated:** [ ] Yes  [ ] No
- **Final Status:** [connection_requested / queued_in_n8n / failed]

## End-to-End Test Result

**Campaign Execution:**
- **Sam AI Response:** [Success message / Error]
- **N8N Execution Time:** [Duration]
- **All Nodes Green:** [ ] Yes  [ ] No
- **Failed Nodes:** [List if any]

**LinkedIn Verification:**
- **Connection Requests Sent:** [Number]
- **Visible on LinkedIn:** [ ] Yes  [ ] No

**Database Verification:**
- **Status Updated:** [ ] Yes  [ ] No
- **contacted_at Set:** [ ] Yes  [ ] No
- **unipile_message_id Present:** [ ] Yes  [ ] No

## Critical Issues Found

1. [List any blocking issues]
2. [...]

## Recommended Fixes

1. [List recommended actions]
2. [...]

## Additional Notes

[Any other observations or findings]
```

---

## 📞 Support Information

**If you get stuck:**

1. **Check N8N execution logs** - Most errors show clear messages
2. **Check Unipile API documentation** - https://developer.unipile.com
3. **Test APIs directly with curl** - Isolate issues before testing in workflow
4. **Review this document** - Most issues are covered here
5. **Ask user for clarification** - If something is unclear

**Key files:**
- Workflow JSON: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/n8n-campaign-workflow-FIXED.json`
- Sam AI Route: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/campaigns/linkedin/execute-via-n8n/route.ts`
- Environment: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/.env.local`
- Test Scripts: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/scripts/js/`

**Good luck! 🚀**

---

**Last Updated:** November 2, 2025
**Document Version:** 1.0
**Status:** Ready for Investigation
