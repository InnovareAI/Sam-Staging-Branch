# 🚨 EMERGENCY: Fix Messenger & Connector Campaigns

**Created:** November 12, 2025
**Priority:** P0 - CRITICAL
**Timeline:** ASAP (Today)
**Status:** 🔴 CAMPAIGNS BLOCKED

---

## 🎯 Immediate Objective

**Fix messenger and connector campaigns so current campaigns can continue running**

Current campaigns are broken and need immediate attention before any new feature development.

---

## 🔍 Diagnostic Checklist

### What to Check First (30 minutes)

**1. Check if campaigns are actually broken:**
```sql
-- See recent campaign executions
SELECT
  c.name,
  c.campaign_type,
  c.status,
  COUNT(cp.id) as total_prospects,
  COUNT(CASE WHEN cp.status = 'connection_requested' THEN 1 END) as sent,
  COUNT(CASE WHEN cp.status = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN cp.status = 'error' THEN 1 END) as errors,
  MAX(cp.contacted_at) as last_activity
FROM campaigns c
LEFT JOIN campaign_prospects cp ON cp.campaign_id = c.id
WHERE c.campaign_type IN ('connector', 'messenger')
  AND c.status = 'active'
GROUP BY c.id, c.name, c.campaign_type, c.status
ORDER BY last_activity DESC NULLS LAST;
```

**2. Check for error patterns:**
```sql
-- See failed prospects and error messages
SELECT
  c.name as campaign_name,
  c.campaign_type,
  cp.status,
  cp.first_name,
  cp.last_name,
  cp.contacted_at,
  cp.personalization_data->>'error' as error_message,
  cp.updated_at
FROM campaign_prospects cp
JOIN campaigns c ON c.id = cp.campaign_id
WHERE cp.status IN ('failed', 'error', 'rate_limited')
  AND cp.updated_at > NOW() - INTERVAL '24 hours'
ORDER BY cp.updated_at DESC
LIMIT 20;
```

**3. Check N8N workflow status:**
```bash
# Is the N8N workflow running?
curl -H "X-N8N-API-KEY: $N8N_API_KEY" \
  https://workflows.innovareai.com/api/v1/workflows/aVG6LC4ZFRMN7Bw6

# Check recent executions
curl -H "X-N8N-API-KEY: $N8N_API_KEY" \
  https://workflows.innovareai.com/api/v1/executions?workflowId=aVG6LC4ZFRMN7Bw6&limit=10
```

**4. Check Unipile account status:**
```sql
-- Are LinkedIn accounts connected?
SELECT
  wa.account_name,
  wa.unipile_account_id,
  wa.connection_status,
  wa.updated_at,
  w.name as workspace_name
FROM workspace_accounts wa
JOIN workspaces w ON w.id = wa.workspace_id
WHERE wa.unipile_account_id IS NOT NULL
ORDER BY wa.updated_at DESC;
```

**5. Check for Michelle's specific issue:**
```sql
-- Michelle's account and campaigns
SELECT
  c.name,
  c.status,
  c.campaign_type,
  COUNT(cp.id) as prospects,
  MAX(cp.contacted_at) as last_contacted
FROM campaigns c
LEFT JOIN campaign_prospects cp ON cp.campaign_id = c.id
WHERE c.workspace_id = (
  SELECT workspace_id FROM workspace_members WHERE user_id = (
    SELECT id FROM auth.users WHERE email LIKE '%michelle%'
  )
)
GROUP BY c.id, c.name, c.status, c.campaign_type;
```

---

## 🩺 Common Issues & Fixes

### Issue 1: "No active LinkedIn account found"

**Symptoms:**
- Campaigns fail immediately
- Error: "LinkedIn account not active"
- No messages sent

**Root Cause:**
Michelle's LinkedIn disconnected from Unipile

**Fix:**
1. Michelle goes to: Settings → Integrations → LinkedIn
2. Click "Disconnect" (if showing connected but broken)
3. Click "Connect LinkedIn Account"
4. Follow OAuth flow
5. Verify `unipile_account_id` populated in database

**Verification:**
```sql
SELECT
  unipile_account_id,
  connection_status,
  account_name
FROM workspace_accounts
WHERE workspace_id = 'Michelle_workspace_id';
```

---

### Issue 2: "Unipile API error - 401 Unauthorized"

**Symptoms:**
- Campaigns fail when trying to send
- Error: "Unipile authentication failed"
- HTTP 401 responses

**Root Cause:**
- Unipile API key expired or invalid
- Account credentials need refresh

**Fix:**
```bash
# Test Unipile API key
curl -X GET \
  "https://${UNIPILE_DSN}/api/v1/accounts" \
  -H "X-API-KEY: ${UNIPILE_API_KEY}"

# If fails, get new API key from:
# https://app.unipile.com/dashboard/api-keys
```

**Update in Supabase:**
```sql
-- Update Unipile credentials (if changed)
UPDATE workspace_accounts
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{unipile_api_key}',
  '"new_key_here"'
)
WHERE unipile_account_id = 'Michelle_account_id';
```

---

### Issue 3: "Rate limited - too many requests"

**Symptoms:**
- Prospects stuck in `rate_limited_cr` status
- No new CRs being sent
- All accounts showing rate limited

**Root Cause:**
- Hit LinkedIn's 20 CRs/day limit
- Automation functions not resetting status

**Fix:**
```sql
-- Manually reset rate limits (ONLY if confirmed false positive)
UPDATE campaign_prospects
SET status = 'pending',
    updated_at = NOW()
WHERE status = 'rate_limited_cr'
  AND updated_at < NOW() - INTERVAL '24 hours'
  AND campaign_id IN (
    SELECT id FROM campaigns WHERE workspace_id = 'Michelle_workspace_id'
  );

-- Check cron jobs are running
SELECT * FROM cron.job WHERE jobname LIKE 'sam-%';

-- Manually trigger retry
SELECT auto_retry_rate_limited_prospects();
```

---

### Issue 4: "N8N workflow not triggered"

**Symptoms:**
- Prospects stuck in `pending` or `queued`
- No execution happening
- N8N shows no recent executions

**Root Cause:**
- N8N workflow not active
- Webhook URL changed
- Authentication failed

**Fix:**
1. **Check N8N workflow is active:**
   ```bash
   # List workflows
   curl -H "X-N8N-API-KEY: $N8N_API_KEY" \
     https://workflows.innovareai.com/api/v1/workflows

   # Activate workflow
   curl -X PATCH \
     -H "X-N8N-API-KEY: $N8N_API_KEY" \
     -H "Content-Type: application/json" \
     https://workflows.innovareai.com/api/v1/workflows/aVG6LC4ZFRMN7Bw6 \
     -d '{"active": true}'
   ```

2. **Upload updated workflow** (from our fixed version):
   ```bash
   # Upload the error-handling workflow
   # File: /Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator - UPDATED.json

   # Via N8N UI:
   # 1. Go to https://workflows.innovareai.com
   # 2. Open "SAM Master Campaign Orchestrator"
   # 3. Import JSON file
   # 4. Activate
   ```

---

### Issue 5: "LinkedIn URL missing" for messenger campaigns

**Symptoms:**
- Messenger campaigns fail: "No LinkedIn URL found"
- Connector works but messenger doesn't

**Root Cause:**
- Prospects missing `linkedin_url` field
- Not synced from connector campaign

**Fix:**
```sql
-- Check for missing LinkedIn URLs
SELECT
  id,
  first_name,
  last_name,
  linkedin_url,
  status
FROM campaign_prospects
WHERE campaign_id IN (
  SELECT id FROM campaigns WHERE campaign_type = 'messenger'
)
AND linkedin_url IS NULL
LIMIT 10;

-- Fix: Copy from contact data if available
UPDATE campaign_prospects cp
SET linkedin_url = c.linkedin_url,
    updated_at = NOW()
FROM contacts c
WHERE cp.contact_id = c.id
  AND cp.linkedin_url IS NULL
  AND c.linkedin_url IS NOT NULL
  AND cp.campaign_id IN (
    SELECT id FROM campaigns WHERE campaign_type = 'messenger'
  );
```

---

## ✅ Quick Fix Checklist (Do in Order)

### Step 1: Immediate Triage (5 minutes)
```bash
☐ Run diagnostic SQL queries above
☐ Identify which specific issue (1-5)
☐ Note affected campaigns
```

### Step 2: Fix Michelle's Account (10 minutes)
```bash
☐ Michelle disconnects LinkedIn
☐ Michelle reconnects via OAuth
☐ Verify unipile_account_id populated
☐ Test connection with Unipile API
```

### Step 3: Upload N8N Workflow (10 minutes)
```bash
☐ Go to https://workflows.innovareai.com
☐ Open "SAM Master Campaign Orchestrator"
☐ Import updated JSON from /Downloads
☐ Activate workflow
☐ Test with 1 prospect
```

### Step 4: Resume Campaigns (5 minutes)
```sql
-- Resume all paused campaigns
UPDATE campaigns
SET status = 'active',
    updated_at = NOW()
WHERE workspace_id = 'Michelle_workspace_id'
  AND status = 'paused';

-- Verify
SELECT name, status FROM campaigns
WHERE workspace_id = 'Michelle_workspace_id';
```

### Step 5: Test Campaign Execution (10 minutes)
```bash
# Test connector campaign
curl -X POST https://app.meet-sam.com/api/campaigns/linkedin/execute-live \
  -H "Cookie: your-auth-cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "test-connector-campaign-id",
    "maxProspects": 1,
    "dryRun": false
  }'

# Test messenger campaign
curl -X POST https://app.meet-sam.com/api/campaigns/linkedin/execute-live \
  -H "Cookie: your-auth-cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "test-messenger-campaign-id",
    "maxProspects": 1,
    "dryRun": false
  }'
```

### Step 6: Monitor for 1 Hour
```bash
☐ Watch N8N execution logs
☐ Check campaign_prospects status updates
☐ Verify messages sent in LinkedIn
☐ Check for any new errors
```

---

## 🔥 If Still Broken After Quick Fixes

### Escalation Path

**1. Check Netlify function logs:**
```bash
# Go to: https://app.netlify.com/sites/devin-next-gen-staging/functions
# Filter by: api-campaigns-linkedin-execute-live
# Look for errors in last 1 hour
```

**2. Check Supabase logs:**
```bash
# Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/logs/postgres-logs
# Filter by: campaign_prospects, campaigns
# Look for constraint violations, RLS blocks
```

**3. Check Unipile status:**
```bash
# Test Unipile API directly
curl -X GET \
  "https://${UNIPILE_DSN}/api/v1/accounts/${MICHELLE_ACCOUNT_ID}" \
  -H "X-API-KEY: ${UNIPILE_API_KEY}"

# Check if account is active
# Expected: status: "active", sources: [{ status: "active" }]
```

**4. Manual Campaign Trigger:**
```typescript
// Bypass N8N, trigger directly via API
// This tests if the core execution works

// File: temp/test-campaign-direct.ts
const response = await fetch('https://app.meet-sam.com/api/campaigns/linkedin/execute-live', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': 'your-auth-cookie-here'
  },
  body: JSON.stringify({
    campaignId: 'your-campaign-id',
    maxProspects: 1,
    dryRun: false
  })
});

const result = await response.json();
console.log('Execution result:', result);
```

---

## 📋 Success Criteria

Campaign is FIXED when:
- ✅ Michelle can reconnect LinkedIn (green "Connected" badge)
- ✅ Connector campaign sends 1 test CR successfully
- ✅ Messenger campaign sends 1 test message successfully
- ✅ N8N workflow shows successful execution
- ✅ No errors in logs for 1 hour
- ✅ Campaign status updates correctly in database
- ✅ Michelle can resume all 5 paused campaigns

---

## 🚦 Post-Fix Monitoring (24 hours)

After campaigns are running:
```sql
-- Monitor campaign health every hour
SELECT
  c.name,
  COUNT(CASE WHEN cp.status = 'connection_requested' THEN 1 END) as crs_sent,
  COUNT(CASE WHEN cp.status = 'message_sent' THEN 1 END) as messages_sent,
  COUNT(CASE WHEN cp.status = 'failed' THEN 1 END) as failures,
  MAX(cp.contacted_at) as last_activity
FROM campaigns c
LEFT JOIN campaign_prospects cp ON cp.campaign_id = c.id
WHERE c.status = 'active'
  AND c.campaign_type IN ('connector', 'messenger')
  AND c.updated_at > NOW() - INTERVAL '24 hours'
GROUP BY c.id, c.name;
```

**Alert if:**
- 🔴 No activity for > 2 hours (campaign stuck)
- 🔴 Failure rate > 10% (something wrong)
- 🔴 Rate limits hit before 5pm (sending too fast)

---

## 📞 Emergency Contacts

If you can't fix it:
1. **Check N8N community:** https://community.n8n.io
2. **Unipile support:** support@unipile.com
3. **Supabase status:** https://status.supabase.com

---

**NEXT STEP:** Run diagnostic queries and report back what you find!

**Last Updated:** November 12, 2025
**Status:** Awaiting diagnostic results
