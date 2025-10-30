# LinkedIn Campaign Execution - End-to-End Workflow & Open Challenges

**Date:** October 30, 2025
**Status:** Partially Working - LinkedIn messages send successfully, but database tracking incomplete

---

## Executive Summary

**What Works:**
- ✅ LinkedIn connection requests ARE being sent successfully
- ✅ Prospects can see invitations on LinkedIn
- ✅ Campaign API correctly queues prospects
- ✅ N8N workflow receives webhooks and sends messages

**What Doesn't Work:**
- ❌ Database not updated with `contacted_at` timestamp after sending
- ❌ Prospects stuck in `queued_in_n8n` status indefinitely
- ❌ No tracking of which messages were actually sent
- ❌ N8N workflow may be inactive (needs verification)

---

## End-to-End Workflow Architecture

### Overview
There are **TWO separate workflow systems** handling LinkedIn campaign execution:

1. **Browser-Triggered Workflow** (execute-live)
2. **Cron-Triggered Polling Workflow** (poll-pending)

Both use the same N8N workflow but are triggered differently.

---

## Workflow 1: Browser-Triggered Execution

### Flow Diagram
```
Browser/API Request
    ↓
POST /api/campaigns/linkedin/execute-live
    ↓
Update prospects: status = 'queued_in_n8n'
    ↓
Send webhook to N8N
    ↓
N8N: "SAM Master Campaign Orchestrator" (aVG6LC4ZFRMN7Bw6)
    ↓
N8N sends LinkedIn connection request via Unipile
    ↓
✅ LinkedIn invitation appears on prospect's LinkedIn
    ↓
❌ DATABASE NEVER UPDATED - prospects stay 'queued_in_n8n'
```

### API Endpoint Details

**Endpoint:** `POST /api/campaigns/linkedin/execute-live`

**Location:** `/app/api/campaigns/linkedin/execute-live/route.ts`

**Authentication:**
- Browser: Requires valid session cookie
- Internal: Header `x-internal-trigger: cron-pending-prospects`

**Request Body:**
```json
{
  "campaignId": "uuid",
  "maxProspects": 3,
  "dryRun": false
}
```

**What It Does:**
1. Fetches campaign details from database
2. Gets prospects with status: `['pending', 'approved', 'ready_to_message']`
3. Filters prospects with `linkedin_url` populated and `contacted_at = null`
4. Updates prospects to `status = 'queued_in_n8n'`
5. Sends webhook to N8N with payload:
   ```json
   {
     "campaignId": "uuid",
     "campaignName": "Campaign Name",
     "workspaceId": "uuid",
     "unipileAccountId": "unipile_id",
     "unipile_dsn": "app.unipile.com",
     "unipile_api_key": "key",
     "prospects": [
       {
         "id": "uuid",
         "first_name": "John",
         "last_name": "Doe",
         "linkedin_url": "https://linkedin.com/in/johndoe"
       }
     ],
     "messages": {
       "cr": "Connection request message",
       "connection_request": "Connection request message"
     }
   }
   ```

**N8N Webhook URL:**
```
https://workflows.innovareai.com/webhook/campaign-execute
```

**Environment Variable:** `N8N_CAMPAIGN_WEBHOOK_URL`

---

## Workflow 2: Cron-Triggered Polling

### Flow Diagram
```
Cron-jobs.org (every 5 minutes)
    ↓
Triggers N8N Schedule Trigger
    ↓
N8N calls: GET /api/campaigns/poll-pending
    ↓
API returns up to 10 pending prospects
    ↓
N8N sends LinkedIn connection requests via Unipile
    ↓
✅ LinkedIn invitation appears on prospect's LinkedIn
    ↓
❌ DATABASE NEVER UPDATED - prospects stay in original status
```

### API Endpoint Details

**Endpoint:** `GET /api/campaigns/poll-pending`

**Location:** `/app/api/campaigns/poll-pending/route.ts`

**Authentication:** Header `x-internal-trigger: n8n-polling`

**What It Does:**
1. Fetches up to 10 prospects with:
   - Status: `['pending', 'approved', 'ready_to_message']`
   - `linkedin_url IS NOT NULL`
   - `contacted_at IS NULL`
2. Groups prospects by campaign
3. Returns first campaign with prospects:
   ```json
   {
     "campaign_id": "uuid",
     "campaign_name": "Campaign Name",
     "workspace_id": "uuid",
     "unipile_dsn": "app.unipile.com",
     "unipile_api_key": "key",
     "unipile_account_id": "unipile_id",
     "prospects": [
       {
         "id": "uuid",
         "first_name": "John",
         "last_name": "Doe",
         "linkedin_url": "https://linkedin.com/in/johndoe",
         "campaign_id": "uuid",
         "personalized_message": "Hi John, ..."
       }
     ],
     "count": 1
   }
   ```

**Cron Schedule:** Every 5 minutes (configured on cron-jobs.org)

---

## N8N Workflow Details

### Workflow Information
- **Name:** SAM Master Campaign Orchestrator
- **ID:** `aVG6LC4ZFRMN7Bw6`
- **URL:** https://workflows.innovareai.com/workflow/aVG6LC4ZFRMN7Bw6
- **Webhook Path:** `/webhook/campaign-execute`
- **Status:** ⚠️ **INACTIVE** (needs to be activated in N8N UI)

### Current Workflow Nodes

1. **Campaign Execute Webhook** (n8n-nodes-base.webhook)
   - Receives POST from execute-live API
   - Path: `campaign-execute`

2. **Campaign Handler** (n8n-nodes-base.function)
   - Extracts campaign data from webhook payload

3. **Prepare Prospects List** (n8n-nodes-base.function)
   - Maps prospects to individual items

4. **Split Prospects** (n8n-nodes-base.splitInBatches)
   - Processes prospects one at a time (batch size: 1)

5. **Send CR** (n8n-nodes-base.httpRequest)
   - Sends LinkedIn connection request to Unipile
   - URL: `https://{unipile_dsn}/api/v1/messaging/messages`
   - Method: POST
   - Headers: `X-API-KEY: {unipile_api_key}`
   - Body:
     ```json
     {
       "account_id": "{unipile_account_id}",
       "attendees": [{ "identifier": "{linkedin_url}" }],
       "text": "{messages.cr}",
       "type": "LINKEDIN"
     }
     ```

6. **Log Result** (n8n-nodes-base.function)
   - Logs success to N8N console

7. **Should Loop Again?** (n8n-nodes-base.if)
   - Checks if more prospects to process

8. **Loop Done** (n8n-nodes-base.noOp)
   - Ends workflow execution

### ❌ Missing Node: Database Update Callback

**Problem:** After "Send CR" succeeds, the workflow does NOT call back to update the database.

**Impact:**
- Prospects remain in `queued_in_n8n` status forever
- `contacted_at` stays `NULL`
- No way to track which prospects were actually contacted
- Analytics incomplete
- Can't prevent duplicate sends

---

## Database Schema

### Table: `campaign_prospects`

**Relevant Columns:**
```sql
id                   UUID PRIMARY KEY
campaign_id          UUID NOT NULL
first_name           TEXT
last_name            TEXT
linkedin_url         TEXT
status               TEXT (pending, approved, queued_in_n8n, contacted, etc.)
contacted_at         TIMESTAMP (NULL = not yet contacted)
personalization_data JSONB
created_at           TIMESTAMP
```

**Status Flow (Intended):**
```
approved → queued_in_n8n → contacted
```

**Current Reality:**
```
approved → queued_in_n8n → [STUCK HERE FOREVER]
```

**Expected personalization_data after contact:**
```json
{
  "unipile_message_id": "msg_abc123",
  "contacted_via": "n8n_workflow",
  "contacted_method": "linkedin_connection_request",
  "contacted_at": "2025-10-30T13:45:00Z"
}
```

---

## Open Challenges

### 1. ❌ N8N Workflow Doesn't Update Database

**Issue:** After successfully sending LinkedIn message, N8N doesn't call back to update `campaign_prospects` table.

**Current Behavior:**
- Prospect status: `queued_in_n8n`
- Prospect contacted_at: `NULL`
- No tracking of sent messages

**Expected Behavior:**
- Prospect status: `contacted`
- Prospect contacted_at: `2025-10-30T13:45:00Z`
- personalization_data includes Unipile message ID

**Solution Created:**
New API endpoint: `/api/campaigns/update-contacted`
- Location: `/app/api/campaigns/update-contacted/route.ts`
- Auth: `x-internal-trigger: n8n-callback`
- Request:
  ```json
  {
    "prospect_id": "uuid",
    "unipile_message_id": "msg_abc123"
  }
  ```
- Updates database with contacted timestamp and status

**Action Required:**
Add new HTTP Request node to N8N workflow after "Send CR" node:
- URL: `https://app.meet-sam.com/api/campaigns/update-contacted`
- Method: POST
- Headers:
  - `Content-Type: application/json`
  - `x-internal-trigger: n8n-callback`
- Body:
  ```json
  {
    "prospect_id": "{{ $('Split Prospects').item.json.id }}",
    "unipile_message_id": "{{ $('Send CR').item.json.object.id }}"
  }
  ```

---

### 2. ⚠️ N8N Workflow May Be Inactive

**Issue:** Workflow export shows `"active": false`

**Evidence:**
```json
{
  "id": "aVG6LC4ZFRMN7Bw6",
  "name": "SAM Master Campaign Orchestrator",
  "active": false,  // ← THIS IS THE PROBLEM
  "isArchived": false
}
```

**Impact:**
- Webhook calls ignored
- No messages sent (but we confirmed messages ARE being sent, so this may be stale data)

**Solution:**
1. Go to: https://workflows.innovareai.com/workflow/aVG6LC4ZFRMN7Bw6
2. Find "Active" toggle (top-right)
3. Toggle to **ON** (green)
4. Workflow immediately starts processing webhooks

**Status:** Needs manual verification in N8N UI

---

### 3. 🔄 Two Workflow Systems = Maintenance Burden

**Issue:** Maintaining two separate triggers for same workflow

**System 1: Browser/API Trigger**
- Endpoint: `/api/campaigns/linkedin/execute-live`
- Trigger: Manual button click or API call
- Use case: Immediate execution
- Pro: On-demand execution
- Con: Requires user action

**System 2: Cron Polling**
- Endpoint: `/api/campaigns/poll-pending`
- Trigger: Cron-jobs.org every 5 minutes
- Use case: Background processing
- Pro: Automatic execution
- Con: 5-minute delay, polling overhead

**Recommendation:**
Consolidate to single system using cron polling for all campaigns. Remove browser trigger to simplify architecture.

---

### 4. 📊 No Message Send Confirmation

**Issue:** No way to verify if Unipile successfully sent message

**Current Flow:**
```
N8N → Unipile API → ??? (hope it worked)
```

**Desired Flow:**
```
N8N → Unipile API → Parse response → Check success → Update database
```

**Unipile Response Example:**
```json
{
  "object": {
    "id": "msg_abc123",
    "status": "sent"
  }
}
```

**Solution:**
In N8N "Send CR" node, add error handling:
- If HTTP 200: Extract `object.id` and pass to callback
- If HTTP 4xx/5xx: Log error, don't update database
- If no message ID: Use fallback tracking ID

---

### 5. 🔍 No Retry Logic for Failed Sends

**Issue:** If Unipile API fails, prospect lost forever

**Scenarios:**
- Unipile API timeout
- Rate limit exceeded
- LinkedIn account disconnected
- Invalid LinkedIn URL

**Current Behavior:**
- Prospect marked as `queued_in_n8n`
- Never retried
- Lost in limbo

**Solution Needed:**
1. Capture errors in N8N workflow
2. Update prospect with error status
3. Create retry queue for failed sends
4. Implement exponential backoff

---

### 6. 📈 No Analytics or Reporting

**Issue:** Can't track campaign performance

**Missing Metrics:**
- How many connection requests sent today?
- What's the acceptance rate?
- Which prospects haven't been contacted?
- How many are stuck in queued status?

**Solution:**
Create analytics dashboard querying:
```sql
-- Contacted prospects
SELECT COUNT(*)
FROM campaign_prospects
WHERE contacted_at IS NOT NULL;

-- Stuck prospects
SELECT COUNT(*)
FROM campaign_prospects
WHERE status = 'queued_in_n8n'
  AND contacted_at IS NULL;

-- Acceptance rate (requires reply tracking)
SELECT
  COUNT(*) FILTER (WHERE replied_at IS NOT NULL) * 100.0 /
  COUNT(*) FILTER (WHERE contacted_at IS NOT NULL) AS acceptance_rate
FROM campaign_prospects;
```

---

## Testing & Verification

### Manual Test Results (Oct 30, 2025)

**Campaign ID:** `ade10177-afe6-4770-a64d-b4ac0928b66a`

**Test Prospects:**
1. Brian Lee - https://www.linkedin.com/in/wmbrianlee
   - Status: `contacted` (manually fixed)
   - Result: ✅ LinkedIn invitation visible

2. Aliya Jasrai - https://www.linkedin.com/in/aliyajasrai
   - Status: `approved` (reset from queued)
   - Result: ✅ LinkedIn invitation visible

3. Matt Zuvella - https://www.linkedin.com/in/mattzuvella
   - Status: `approved` (reset from queued)
   - Result: ✅ LinkedIn invitation visible

**Conclusion:** N8N workflow IS sending LinkedIn messages successfully. The only issue is database tracking.

---

## Immediate Action Items

### Priority 1: Add Database Callback to N8N Workflow

**Steps:**
1. Open N8N workflow: https://workflows.innovareai.com/workflow/aVG6LC4ZFRMN7Bw6
2. Click on workflow canvas to edit
3. After "Send CR" node, add new "HTTP Request" node:
   - Name: "Update Database"
   - URL: `https://app.meet-sam.com/api/campaigns/update-contacted`
   - Method: POST
   - Headers:
     - `Content-Type`: `application/json`
     - `x-internal-trigger`: `n8n-callback`
   - Body (JSON):
     ```json
     {
       "prospect_id": "={{ $('Split Prospects').item.json.id }}",
       "unipile_message_id": "={{ $json.object?.id || null }}"
     }
     ```
4. Connect "Send CR" → "Update Database" → "Log Result"
5. Save workflow
6. Verify workflow is **Active** (toggle on)

**Expected Result:**
Future prospects will be automatically marked as `contacted` after N8N sends LinkedIn message.

---

### Priority 2: Verify N8N Workflow is Active

**Steps:**
1. Go to: https://workflows.innovareai.com/workflow/aVG6LC4ZFRMN7Bw6
2. Check "Active" toggle (top-right corner)
3. If OFF (gray), toggle to ON (green)
4. Verify webhook URL shows: `https://workflows.innovareai.com/webhook/campaign-execute`

**Expected Result:**
Workflow starts processing webhooks immediately.

---

### Priority 3: Test End-to-End Flow

**Steps:**
1. Create test campaign with 1 prospect
2. Ensure prospect has:
   - Valid `linkedin_url`
   - Status: `approved`
   - `contacted_at`: NULL
3. Run: `node scripts/js/test-execute-live-api.mjs`
4. Wait 30 seconds
5. Check database:
   ```sql
   SELECT id, first_name, last_name, status, contacted_at
   FROM campaign_prospects
   WHERE id = 'prospect_id';
   ```
6. Verify:
   - Status changed to `contacted`
   - `contacted_at` populated
   - LinkedIn invitation visible on prospect's LinkedIn

**Expected Result:**
Complete end-to-end tracking working.

---

## Future Enhancements

### 1. Reply Monitoring System

**Goal:** Automatically track when prospects accept connection requests

**Implementation:**
- Unipile webhook for LinkedIn events
- Update `replied_at` when connection accepted
- Trigger follow-up sequence

### 2. Smart Rate Limiting

**Goal:** Avoid LinkedIn detection/blocking

**Implementation:**
- Limit to 50 connection requests per day per account
- Add random delays between sends (2-10 minutes)
- Business hours only (9am-5pm in prospect's timezone)

### 3. A/B Testing for Messages

**Goal:** Optimize connection request acceptance rate

**Implementation:**
- Multiple message variants per campaign
- Track which variant has highest acceptance rate
- Auto-select winning variant

### 4. Enrichment Integration

**Goal:** Populate company names before sending

**Implementation:**
- Call `/lib/data-enrichment/enrichment-pipeline.ts`
- Scrape LinkedIn profile for company info
- Update `company_name` field
- Use in personalized message

---

## Related Files

### API Endpoints
- `/app/api/campaigns/linkedin/execute-live/route.ts` - Browser-triggered execution
- `/app/api/campaigns/poll-pending/route.ts` - Cron-triggered polling
- `/app/api/campaigns/update-contacted/route.ts` - N8N callback (NEW)

### Database
- Table: `campaign_prospects`
- Table: `campaigns`
- Table: `workspace_accounts`

### N8N
- Workflow ID: `aVG6LC4ZFRMN7Bw6`
- Workflow Name: SAM Master Campaign Orchestrator
- Workflow URL: https://workflows.innovareai.com/workflow/aVG6LC4ZFRMN7Bw6

### Test Scripts
- `/scripts/js/test-execute-live-api.mjs` - Test campaign execution
- `/scripts/js/check-campaign-status.mjs` - Check prospect statuses
- `/scripts/js/mark-prospects-contacted.mjs` - Manually mark as contacted
- `/scripts/js/reset-queued-prospects.mjs` - Reset stuck prospects

### Environment Variables
```bash
N8N_CAMPAIGN_WEBHOOK_URL=https://workflows.innovareai.com/webhook/campaign-execute
UNIPILE_DSN=app.unipile.com
UNIPILE_API_KEY=<key>
NEXT_PUBLIC_SUPABASE_URL=<url>
SUPABASE_SERVICE_ROLE_KEY=<key>
```

---

## Contact & Support

**Questions?** Check N8N execution logs at:
https://workflows.innovareai.com/executions

**Recent Execution:**
https://workflows.innovareai.com/workflow/aVG6LC4ZFRMN7Bw6/executions/62165

**Database Access:** Supabase Dashboard
https://supabase.com/dashboard/project/<project-id>

---

**Last Updated:** October 30, 2025
**Author:** Claude AI (Sonnet 4.5)
**Status:** Document created during debugging session
