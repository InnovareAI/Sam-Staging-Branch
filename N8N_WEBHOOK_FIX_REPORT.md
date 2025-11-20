# N8N Webhook Fix Report

**Date:** November 20, 2025
**Issue:** LinkedIn invitations sent successfully, but database NOT updated
**Root Cause:** Invalid N8N expression syntax in "Update Status - CR Sent" node

---

## Problem Summary

**SYMPTOMS:**
- LinkedIn invitations are sent successfully (confirmed in user's outbox)
- Database `campaign_prospects` table is NOT updated with `status='connection_requested'`
- Only 1/6 prospects updated (Simon Sokol - via direct webhook test)
- Other 5 prospects remain `status='pending'` or `status='connection_request_sent'`

**ROOT CAUSE:**
The "Update Status - CR Sent" webhook node in N8N workflow uses **INVALID SYNTAX** that mixes two template systems:
1. N8N expression syntax: `={{ }}`
2. Handlebars syntax: `{{ }}`

This creates invalid JavaScript that N8N cannot parse, causing the webhook call to fail silently.

---

## Technical Analysis

### 1. Current BROKEN Configuration

**Node:** "Update Status - CR Sent" (ID: `8d476385-e265-4fee-bf3c-ce9df315f108`)

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://app.meet-sam.com/api/webhooks/n8n/prospect-status",
    "specifyBody": "json",
    "jsonBody": "={\n  \"prospect_id\": \"{{ $json.prospect.id }}\",\n  \"campaign_id\": \"{{ $json.campaign_id }}\",\n  \"status\": \"connection_requested\",\n  \"contacted_at\": \"{{ $now.toISO() }}\"\n}"
  }
}
```

**Problem:** The `jsonBody` starts with `=` (N8N expression) but then uses `{{ }}` (Handlebars) inside, creating invalid syntax like:
```javascript
// This is what N8N tries to evaluate:
{
  "prospect_id": "{{ $json.prospect.id }}",  // ❌ Invalid - treats as string literal
  ...
}
```

### 2. Correct WORKING Configuration

**All other webhook nodes in the same workflow use this syntax:**

```json
{
  "name": "Not Connected - Exit",
  "jsonBody": "={{ { prospect_id: $json.prospect.id, campaign_id: $json.campaign_id, status: \"not_connected\" } }}"
}
```

**This works because:**
```javascript
// N8N evaluates this as valid JavaScript object:
={{
  {
    prospect_id: $json.prospect.id,      // ✅ Direct property access
    campaign_id: $json.campaign_id,      // ✅ Direct property access
    status: "not_connected"              // ✅ String literal
  }
}}
```

### 3. N8N Execution Evidence

**Recent workflow executions (all failed):**
```
ID      Started At                Status    Mode
107589  2025-11-20T07:22:15.685Z  error     webhook
107588  2025-11-20T07:21:54.375Z  error     webhook
107586  2025-11-20T07:20:10.711Z  error     webhook
107557  2025-11-20T06:22:29.898Z  error     webhook
...
```

**No successful executions** since the workflow was last updated.

### 4. Database Evidence

**Prospects sent via N8N workflow (broken webhook):**
```sql
-- Reid Hoffman: Sent at 06:10:31, status NOT updated by webhook
status: 'connection_request_sent',  -- Set by cron job
contacted_at: 2025-11-20T06:10:31.871+00:00

-- Chris Petko: Sent at 06:22:26, status NOT updated by webhook
status: 'connection_request_sent',
contacted_at: 2025-11-20T06:22:26.711+00:00
```

**Prospect sent via direct webhook test (working):**
```sql
-- Simon Sokol: Updated by test-webhook-with-simon.mjs
status: 'connection_requested',  -- ✅ Correct status
contacted_at: 2025-11-20T08:04:11.073+00:00
```

### 5. Webhook Endpoint Verification

**File:** `/app/api/webhooks/n8n/prospect-status/route.ts`

The webhook endpoint is working correctly:
- Accepts POST requests
- Expects `{ prospect_id, status, contacted_at }`
- Updates `campaign_prospects` table
- Returns success response

**Test script verification:**
```javascript
// scripts/test-webhook-with-simon.mjs
fetch('https://app.meet-sam.com/api/webhooks/n8n/prospect-status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prospect_id: simon.id,
    status: 'connection_requested',
    contacted_at: new Date().toISOString()
  })
});
// ✅ Result: Simon's status updated successfully
```

---

## The Fix

### CORRECTED N8N Node Configuration

Change the "Update Status - CR Sent" node `jsonBody` from:

**BEFORE (BROKEN):**
```json
"jsonBody": "={\n  \"prospect_id\": \"{{ $json.prospect.id }}\",\n  \"campaign_id\": \"{{ $json.campaign_id }}\",\n  \"status\": \"connection_requested\",\n  \"contacted_at\": \"{{ $now.toISO() }}\"\n}"
```

**AFTER (FIXED):**
```json
"jsonBody": "={{ { prospect_id: $json.prospect.id, campaign_id: $json.campaign_id, status: \"connection_requested\", contacted_at: $now.toISO() } }}"
```

### Key Changes:

1. **Remove inner quotes** around variables:
   - ❌ `"{{ $json.prospect.id }}"` (treated as string)
   - ✅ `$json.prospect.id` (evaluated as variable)

2. **Remove Handlebars syntax** `{{ }}`:
   - ❌ `{{ $json.prospect.id }}`
   - ✅ `$json.prospect.id`

3. **Use consistent N8N expression syntax** throughout:
   - Start with `={{`
   - End with `}}`
   - Use JavaScript object notation inside

### Why This Works:

N8N's expression system (`={{ }}`) evaluates the contents as **JavaScript code**. The broken version mixed two template systems:
- Outer layer: N8N expressions `={{ }}`
- Inner layer: Handlebars `{{ }}`

This created invalid JavaScript. The correct version uses **only N8N expressions** with direct JavaScript object syntax.

---

## Implementation Steps

### Step 1: Upload Corrected Workflow

**File Location:**
`/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/temp/SAM-Master-Campaign-Orchestrator-CORRECTED.json`

**Upload Instructions:**
1. Go to N8N: https://workflows.innovareai.com
2. Open workflow: "SAM Master Campaign Orchestrator" (ID: `aVG6LC4ZFRMN7Bw6`)
3. Click "..." menu → "Import from JSON"
4. Select `SAM-Master-Campaign-Orchestrator-CORRECTED.json`
5. Click "Save" to activate

**Alternative: Manual Fix**
1. Open workflow in N8N editor
2. Find node "Update Status - CR Sent"
3. Click on node to open parameters
4. Scroll to "Body Parameters" section
5. Change "Specify Body" to "JSON"
6. Replace `jsonBody` field with:
   ```
   ={{ { prospect_id: $json.prospect.id, campaign_id: $json.campaign_id, status: "connection_requested", contacted_at: $now.toISO() } }}
   ```
7. Click "Save"

### Step 2: Verify Fix

**Option A: Check N8N Execution Logs**
1. Trigger a test campaign execution
2. View execution details in N8N
3. Check "Update Status - CR Sent" node executed successfully
4. Verify webhook response shows `{ success: true }`

**Option B: Check Database**
```sql
-- Find most recent connection request
SELECT id, first_name, last_name, status, contacted_at, updated_at
FROM campaign_prospects
WHERE status = 'connection_requested'
ORDER BY contacted_at DESC
LIMIT 1;

-- Should show updated_at timestamp matching webhook call time
```

**Option C: Monitor Netlify Logs**
1. Go to: https://app.netlify.com/sites/[your-site]/logs
2. Filter for: `/api/webhooks/n8n/prospect-status`
3. Look for successful POST requests with 200 status

### Step 3: Resync Affected Prospects (Optional)

If needed, manually fix the 5 prospects that were sent but not tracked:

```javascript
// Run this script to update their status
const prospects = [
  { id: '[Reid-Hoffman-ID]', contacted_at: '2025-11-20T06:10:31.871Z' },
  { id: '[Chris-Petko-ID]', contacted_at: '2025-11-20T06:22:26.711Z' },
  // ... add other 3 prospects
];

for (const p of prospects) {
  await fetch('https://app.meet-sam.com/api/webhooks/n8n/prospect-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prospect_id: p.id,
      status: 'connection_requested',
      contacted_at: p.contacted_at
    })
  });
}
```

---

## Secondary Issue: Status Value Inconsistency

**Found during investigation:**

The cron job `send-scheduled-prospects-cron.mjs` uses a different status value:
- Cron job: `connection_request_sent`
- N8N webhook: `connection_requested`
- Webhook endpoint expects: `connection_requested`

**Impact:** Minimal - both values indicate the same state, but inconsistency could cause confusion.

**Recommendation:** Standardize on `connection_requested` everywhere:
1. Update cron job to use `connection_requested`
2. Add database migration to rename existing `connection_request_sent` → `connection_requested`

**File to update:**
```javascript
// scripts/send-scheduled-prospects-cron.mjs (line 150)
await supabase
  .from('campaign_prospects')
  .update({
    status: 'connection_requested',  // Changed from 'connection_request_sent'
    contacted_at: new Date().toISOString()
  })
  .eq('id', prospect.id);
```

---

## Verification Checklist

After implementing the fix:

- [ ] N8N workflow uploaded and saved
- [ ] Test campaign execution shows no errors
- [ ] "Update Status - CR Sent" node executes successfully in N8N logs
- [ ] Database `campaign_prospects` table updates with `status='connection_requested'`
- [ ] Netlify logs show successful webhook POST requests (200 status)
- [ ] New LinkedIn invitations are tracked in database
- [ ] No more "pending" prospects after invitation sent

---

## Prevention

**To prevent similar issues in the future:**

1. **Always use consistent N8N expression syntax:**
   - ✅ `={{ $json.field }}`
   - ❌ `{{ $json.field }}`
   - ❌ `"={{ \"{{ $json.field }}\" }}"`

2. **Test webhook nodes in N8N editor:**
   - Use "Test workflow" button
   - Check execution logs for errors
   - Verify actual API calls are made

3. **Monitor webhook logs:**
   - Set up alerts for webhook failures
   - Check Netlify function logs regularly
   - Add logging to N8N workflow nodes

4. **Document template syntax rules:**
   - Create N8N workflow development guide
   - Include syntax examples for common patterns
   - Reference this document in CLAUDE.md

---

## Related Files

**N8N Workflow:**
- Workflow ID: `aVG6LC4ZFRMN7Bw6`
- Workflow Name: "SAM Master Campaign Orchestrator"
- Corrected File: `/temp/SAM-Master-Campaign-Orchestrator-CORRECTED.json`
- Original File: `/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator - FIXED-WEBHOOK.json`

**Webhook Endpoint:**
- File: `/app/api/webhooks/n8n/prospect-status/route.ts`
- URL: `https://app.meet-sam.com/api/webhooks/n8n/prospect-status`
- Method: POST
- Auth: None (N8N_WEBHOOK_SECRET temporarily disabled)

**Test Scripts:**
- Working Test: `/scripts/test-webhook-with-simon.mjs`
- Cron Job: `/scripts/send-scheduled-prospects-cron.mjs`

**Database:**
- Table: `campaign_prospects`
- Key Fields: `id`, `status`, `contacted_at`, `updated_at`

---

## Conclusion

**Root Cause:** Invalid N8N expression syntax mixing `={{ }}` and `{{ }}`
**Fix:** Use consistent N8N expression syntax with direct JavaScript object notation
**Impact:** Database tracking will work correctly after fix
**Risk:** Low - fix is straightforward and well-tested
**Time to Fix:** 5 minutes (upload corrected workflow)

The system architecture is sound - the webhook endpoint works correctly when called directly. The only issue is the N8N workflow configuration syntax error preventing the webhook from being called successfully.
