# Unipile & N8N Messaging Investigation

**Created:** November 12, 2025
**Status:** 🔍 Investigation Phase
**Priority:** P0 - Critical

---

## 📋 Current Status

### What We Know

**✅ Files Found:**
- Updated N8N workflow: `/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator - UPDATED.json`
- Current workflow: `/workflows/SAM-Master-Campaign-Orchestrator-FIXED.json`
- Backup: `/workflows/n8n-campaign-orchestrator-BACKUP-20251110.json`

**✅ Known Issues (from N8N_WORKFLOW_FIXES_NEEDED.md):**
1. Missing cadence delay before sending CR
2. Missing status update after CR sent
3. Connection acceptance not tracked properly

**⚠️ Unknown:**
- Is Unipile account connected?
- Are messenger campaigns actually broken?
- What's the actual error users are seeing?

---

## 🔍 Investigation Plan

### Step 1: Check Unipile Account Status (5 min)

**Run this SQL:**
```sql
-- Check all Unipile accounts
SELECT
  wa.id,
  wa.account_name,
  wa.account_email,
  wa.unipile_account_id,
  wa.provider,
  wa.connection_status,
  wa.last_sync_at,
  wa.updated_at,
  w.name as workspace_name
FROM workspace_accounts wa
JOIN workspaces w ON w.id = wa.workspace_id
WHERE wa.provider IN ('linkedin', 'gmail', 'outlook')
  OR wa.unipile_account_id IS NOT NULL
ORDER BY wa.updated_at DESC;
```

**Expected Result:**
```
| account_name | unipile_account_id | connection_status | workspace |
|--------------|-------------------|-------------------|-----------|
| Michelle     | MT39bAEDTJ6e...   | connected         | InnovareAI|
```

**Red Flags:**
- ❌ `connection_status = 'disconnected'`
- ❌ `unipile_account_id IS NULL`
- ❌ `last_sync_at` > 7 days ago

---

### Step 2: Test Unipile API Directly (10 min)

**Test 1: Check Unipile Authentication**
```bash
# Get Unipile accounts
curl -X GET \
  "https://api6.unipile.com:13670/api/v1/accounts" \
  -H "X-API-KEY: ${UNIPILE_API_KEY}" \
  -H "Accept: application/json"
```

**Expected Response:**
```json
{
  "items": [
    {
      "id": "MT39bAEDTJ6e_ZPY337UgQ",
      "name": "Michelle LinkedIn",
      "type": "LINKEDIN",
      "status": "active",
      "sources": [
        {
          "id": "...",
          "status": "active"
        }
      ]
    }
  ]
}
```

**Red Flags:**
- ❌ HTTP 401 (API key invalid)
- ❌ HTTP 403 (No permission)
- ❌ `status: "disconnected"`
- ❌ `sources: []` (empty)

---

**Test 2: Get Specific Account Details**
```bash
# Replace with actual account ID
ACCOUNT_ID="MT39bAEDTJ6e_ZPY337UgQ"

curl -X GET \
  "https://api6.unipile.com:13670/api/v1/accounts/${ACCOUNT_ID}" \
  -H "X-API-KEY: ${UNIPILE_API_KEY}"
```

**Expected:**
```json
{
  "id": "MT39bAEDTJ6e_ZPY337UgQ",
  "name": "Michelle",
  "type": "LINKEDIN",
  "status": "active",
  "sources": [
    {
      "id": "source_123",
      "type": "LINKEDIN",
      "status": "active",
      "can_send_messages": true,
      "can_send_invitations": true
    }
  ]
}
```

**Red Flags:**
- ❌ `can_send_messages: false`
- ❌ `can_send_invitations: false`
- ❌ `status: "disconnected"`

---

**Test 3: Send Test Connection Request**
```bash
# Test sending a CR (to yourself or test account)
curl -X POST \
  "https://api6.unipile.com:13670/api/v1/users/invite" \
  -H "X-API-KEY: ${UNIPILE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "MT39bAEDTJ6e_ZPY337UgQ",
    "provider_id": "YOUR_LINKEDIN_PROVIDER_ID",
    "message": "Test CR - please ignore"
  }'
```

**Expected Response:**
```json
{
  "object": {
    "id": "msg_123456",
    "status": "sent"
  }
}
```

**Red Flags:**
- ❌ HTTP 400 (Bad request - check payload)
- ❌ HTTP 429 (Rate limited - hit daily limit)
- ❌ HTTP 500 (Unipile server error)
- ❌ Error: "Account not found"
- ❌ Error: "Provider limit reached"

---

**Test 4: Send Test Message**
```bash
# Test sending a LinkedIn message
curl -X POST \
  "https://api6.unipile.com:13670/api/v1/messaging/messages" \
  -H "X-API-KEY: ${UNIPILE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "MT39bAEDTJ6e_ZPY337UgQ",
    "attendees_ids": ["YOUR_LINKEDIN_PROVIDER_ID"],
    "text": "Test message - please ignore"
  }'
```

**Expected Response:**
```json
{
  "object": {
    "id": "msg_789012",
    "text": "Test message - please ignore",
    "date": "2025-11-12T...",
    "from": "account_id"
  }
}
```

**Red Flags:**
- ❌ Error: "Not connected"
- ❌ Error: "Rate limit"
- ❌ Error: "Invalid attendees"

---

### Step 3: Check Campaign Database State (5 min)

**Find Recent Campaign Activity:**
```sql
-- Check recent campaigns and their execution
SELECT
  c.id,
  c.name,
  c.campaign_type,
  c.status,
  c.created_at,
  COUNT(cp.id) as total_prospects,
  COUNT(CASE WHEN cp.status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN cp.status = 'queued_in_n8n' THEN 1 END) as queued,
  COUNT(CASE WHEN cp.status = 'connection_requested' THEN 1 END) as cr_sent,
  COUNT(CASE WHEN cp.status = 'message_sent' THEN 1 END) as messages_sent,
  COUNT(CASE WHEN cp.status = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN cp.status = 'error' THEN 1 END) as errors,
  MAX(cp.contacted_at) as last_activity,
  MAX(cp.updated_at) as last_update
FROM campaigns c
LEFT JOIN campaign_prospects cp ON cp.campaign_id = c.id
WHERE c.campaign_type IN ('connector', 'messenger')
  AND c.created_at > NOW() - INTERVAL '30 days'
GROUP BY c.id, c.name, c.campaign_type, c.status, c.created_at
ORDER BY c.created_at DESC;
```

**What to Look For:**
- ✅ `cr_sent > 0` = Connector campaigns working
- ✅ `messages_sent > 0` = Messenger campaigns working
- ❌ `queued_in_n8n > 0` AND `last_activity IS NULL` = Stuck in queue
- ❌ `failed + errors > 50%` = Something broken

---

**Check Error Messages:**
```sql
-- Get detailed error info from failed prospects
SELECT
  c.name as campaign_name,
  c.campaign_type,
  cp.first_name,
  cp.last_name,
  cp.status,
  cp.contacted_at,
  cp.updated_at,
  cp.personalization_data->>'error' as error_message,
  cp.personalization_data->>'unipile_response' as unipile_response
FROM campaign_prospects cp
JOIN campaigns c ON c.id = cp.campaign_id
WHERE cp.status IN ('failed', 'error')
  AND cp.updated_at > NOW() - INTERVAL '7 days'
ORDER BY cp.updated_at DESC
LIMIT 20;
```

**Common Error Patterns:**
- ❌ "Unipile API error: 401" → API key invalid
- ❌ "LinkedIn account not active" → Account disconnected
- ❌ "No message ID returned" → Unipile response format changed
- ❌ "Rate limit exceeded" → Hit daily quota
- ❌ "Account not found" → Wrong account ID

---

### Step 4: Check N8N Workflow Status (10 min)

**Test 1: Check if Workflow is Active**
```bash
# List all workflows
curl -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  https://workflows.innovareai.com/api/v1/workflows | jq '.data[] | {id, name, active}'

# Expected output should include:
# {
#   "id": "aVG6LC4ZFRMN7Bw6",
#   "name": "SAM Master Campaign Orchestrator",
#   "active": true
# }
```

**Red Flags:**
- ❌ `"active": false` → Workflow not running
- ❌ Workflow not in list → Deleted or wrong instance

---

**Test 2: Check Recent Executions**
```bash
# Get last 10 executions
curl -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  "https://workflows.innovareai.com/api/v1/executions?workflowId=aVG6LC4ZFRMN7Bw6&limit=10" \
  | jq '.data[] | {id, startedAt, stoppedAt, status, error}'
```

**Expected:**
```json
[
  {
    "id": "123",
    "startedAt": "2025-11-12T10:00:00Z",
    "stoppedAt": "2025-11-12T10:01:00Z",
    "status": "success",
    "error": null
  }
]
```

**Red Flags:**
- ❌ `"status": "error"` → Execution failed
- ❌ `"error": "..."` → Check error message
- ❌ No executions in last 24h → Workflow not triggered

---

**Test 3: Trigger Test Execution**
```bash
# Manually trigger workflow with test data
curl -X POST \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -H "Content-Type: application/json" \
  "https://workflows.innovareai.com/webhook/campaign-execute" \
  -d '{
    "workspaceId": "test-workspace",
    "campaignId": "test-campaign",
    "unipileAccountId": "MT39bAEDTJ6e_ZPY337UgQ",
    "unipile_dsn": "api6.unipile.com:13670",
    "unipile_api_key": "your-key-here",
    "prospects": [
      {
        "id": "test-prospect-1",
        "first_name": "Test",
        "last_name": "User",
        "linkedin_url": "https://linkedin.com/in/test",
        "send_delay_minutes": 0
      }
    ],
    "messages": {
      "connection_request": "Hi {first_name}, test CR"
    }
  }'
```

**Expected:** Webhook should return 200 and execution should start

**Red Flags:**
- ❌ HTTP 404 → Webhook URL wrong
- ❌ HTTP 401 → Authentication issue
- ❌ HTTP 500 → Server error

---

### Step 5: Compare Current vs. Updated Workflow (10 min)

**Files to Compare:**
1. **Current Production:** `workflows/SAM-Master-Campaign-Orchestrator-FIXED.json`
2. **Updated Version:** `/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator - UPDATED.json`

**Key Differences to Check:**
```bash
# Count nodes in each
echo "Current workflow nodes:"
cat workflows/SAM-Master-Campaign-Orchestrator-FIXED.json | jq '.nodes | length'

echo "Updated workflow nodes:"
cat "/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator - UPDATED.json" | jq '.nodes | length'

# List node names
echo "Current nodes:"
cat workflows/SAM-Master-Campaign-Orchestrator-FIXED.json | jq '.nodes[] | .name'

echo "Updated nodes:"
cat "/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator - UPDATED.json" | jq '.nodes[] | .name'
```

**Expected Changes in Updated Version:**
- ✅ "Wait for Cadence Delay" node added
- ✅ "Update Status - CR Sent" node added
- ✅ "Update Status - Connected" node added
- ✅ Error handling on HTTP nodes (continueOnFail: true)

---

## 🔧 Common Issues & Quick Fixes

### Issue 1: Unipile Account Disconnected

**Symptoms:**
```sql
-- Shows disconnected
SELECT connection_status FROM workspace_accounts
WHERE unipile_account_id = 'MT39bAEDTJ6e_ZPY337UgQ';
-- Returns: 'disconnected'
```

**Fix:**
1. User goes to SAM → Settings → Integrations
2. Click "Disconnect" on LinkedIn account
3. Click "Connect LinkedIn Account"
4. Complete OAuth flow
5. Verify connection:
```sql
SELECT unipile_account_id, connection_status
FROM workspace_accounts
WHERE account_email LIKE '%michelle%';
-- Should show: connection_status = 'connected'
```

---

### Issue 2: N8N Workflow Inactive

**Symptoms:**
```bash
curl -H "X-N8N-API-KEY: $N8N_API_KEY" \
  https://workflows.innovareai.com/api/v1/workflows/aVG6LC4ZFRMN7Bw6 \
  | jq '.active'
# Returns: false
```

**Fix:**
```bash
# Activate workflow
curl -X PATCH \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  https://workflows.innovareai.com/api/v1/workflows/aVG6LC4ZFRMN7Bw6 \
  -d '{"active": true}'
```

---

### Issue 3: Missing Unipile DSN

**Symptoms:**
```
Error: Cannot read property 'unipile_dsn' of undefined
```

**Fix:**
Check N8N workflow payload includes DSN:
```json
{
  "unipile_dsn": "api6.unipile.com:13670",  // Must include protocol prefix
  "unipile_api_key": "..."
}
```

Or hardcode in N8N node:
```
URL: https://api6.unipile.com:13670/api/v1/users/invite
```

---

### Issue 4: Rate Limits Blocking All Sends

**Symptoms:**
```sql
-- All prospects rate limited
SELECT status, COUNT(*)
FROM campaign_prospects
WHERE campaign_id = 'your-campaign-id'
GROUP BY status;

-- Shows: rate_limited_cr: 50
```

**Check if legitimate:**
```sql
-- Count CRs sent today per account
SELECT
  unipile_account_id,
  COUNT(*) as crs_sent_today
FROM campaign_prospects
WHERE status = 'connection_requested'
  AND contacted_at::DATE = CURRENT_DATE
GROUP BY unipile_account_id;

-- If > 20: Legitimate rate limit
-- If < 20: False positive, reset
```

**Fix (if false positive):**
```sql
UPDATE campaign_prospects
SET status = 'pending',
    updated_at = NOW()
WHERE status = 'rate_limited_cr'
  AND contacted_at::DATE < CURRENT_DATE;  -- Only reset old ones
```

---

## 📊 Investigation Checklist

Complete this checklist to diagnose the issue:

**Unipile Connectivity:**
- [ ] Unipile API key works (HTTP 200 on accounts endpoint)
- [ ] Michelle's account shows `status: "active"`
- [ ] Account has `can_send_messages: true`
- [ ] Account has `can_send_invitations: true`
- [ ] Test CR sends successfully
- [ ] Test message sends successfully

**Database State:**
- [ ] Campaigns exist with `campaign_type IN ('connector', 'messenger')`
- [ ] Prospects have `status IN ('pending', 'queued_in_n8n')`
- [ ] No massive spike in `status = 'failed'` or `'error'`
- [ ] Error messages in `personalization_data` are clear
- [ ] `workspace_accounts` shows `connection_status = 'connected'`

**N8N Workflow:**
- [ ] Workflow is `active: true`
- [ ] Recent executions exist (last 24h)
- [ ] Executions show `status: "success"`
- [ ] No errors in execution logs
- [ ] Webhook URL is correct
- [ ] Test execution completes

**Updated Workflow:**
- [ ] Updated JSON file exists in Downloads
- [ ] Contains new "Wait for Cadence Delay" node
- [ ] Contains "Update Status - CR Sent" node
- [ ] Contains error handling (continueOnFail)

---

## 🚀 Next Steps Based on Findings

### If Unipile Account Disconnected:
→ **Action:** Reconnect account via UI (5 min)

### If N8N Workflow Inactive:
→ **Action:** Activate workflow via API (2 min)

### If Workflow Missing Updates:
→ **Action:** Upload updated workflow from Downloads (10 min)

### If Rate Limits Hit:
→ **Action:** Wait 24h or add more accounts (varies)

### If API Key Invalid:
→ **Action:** Generate new Unipile API key (5 min)

### If Unknown Error:
→ **Action:** Check N8N execution logs in detail (20 min)

---

## 📝 Report Template

After running investigation, fill this out:

```
## Investigation Results

**Date:** 2025-11-12
**Investigator:** [Your Name]

### Unipile Status
- API Key Valid: [ ] Yes [ ] No
- Account Active: [ ] Yes [ ] No
- Account ID: MT39bAEDTJ6e_ZPY337UgQ
- Can Send CRs: [ ] Yes [ ] No
- Can Send Messages: [ ] Yes [ ] No
- Test CR Result: [ ] Success [ ] Failed
- Test Message Result: [ ] Success [ ] Failed

### Database Status
- Active Campaigns: X connector, Y messenger
- Prospects Pending: X
- Prospects Failed: X
- Common Error: [error message]

### N8N Status
- Workflow Active: [ ] Yes [ ] No
- Recent Executions: X in last 24h
- Success Rate: X%
- Common Error: [error message]

### Root Cause
[Describe what's actually broken]

### Recommended Fix
[What needs to be done]

### Time Estimate
[How long to fix]
```

---

**STATUS:** Ready to begin investigation

**NEXT STEP:** Run Step 1 (Check Unipile Account Status)
