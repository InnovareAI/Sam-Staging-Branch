# N8N Issue Diagnosis - October 31, 2025

**Status:** ✅ N8N IS WORKING
**Issue:** Workflow not completing prospect execution
**Campaign Test:** "20251031-IAI-test 1" (InnovareAI Workspace)

---

## Test Results

### ✅ N8N Webhook Connection: WORKING

**Test Command:**
```bash
node scripts/js/test-n8n-webhook.mjs
```

**Result:**
```
✅ Response Status: 200 OK
✅ Webhook Response: {"message": "Workflow was started"}
```

**N8N URL:** `https://innovareai.app.n8n.cloud`
**Webhook Endpoint:** `/webhook/campaign-execute`
**Authentication:** Bearer token configured correctly

---

## Current Situation

### Campaign Execution Flow

1. ✅ **User triggers campaign** → `/api/campaigns/linkedin/execute-live`
2. ✅ **API queues prospects** → Sets status to `queued_in_n8n`
3. ✅ **API calls N8N webhook** → Returns "Workflow was started"
4. ⚠️ **N8N workflow processes queue** → **NOT COMPLETING**
5. ❌ **Prospects remain queued** → Never contacted

### Current Database State

**Campaign:** "20251031-IAI-test 1"
- Campaign ID: `e33716ce-453f-436d-bb54-bcd16d20a92f`
- Workspace: InnovareAI Workspace
- Status: `active`
- Updated: 11/1/2025, 2:44:52 AM

**Prospects:**
- Total: 2
- Status: Both `queued_in_n8n`
- Contacted: None (contacted_at = null)
- Message IDs: None

**Prospects Details:**
1. waitechelsea User (Unknown company)
2. odiakosa obazeh (Unknown company)

---

## Root Cause Analysis

### Issue: N8N Workflow Not Processing Queued Prospects

**Possible causes:**

1. **N8N Workflow Not Active**
   - Workflow exists but may be paused/inactive
   - Can't verify via API (401 Unauthorized on workflow list)
   - Need to check N8N UI directly

2. **N8N Workflow Configuration Missing Steps**
   - Receives webhook payload ✅
   - May not have Unipile integration configured
   - May not update database after sending

3. **N8N Workflow Error Handling**
   - Workflow may be failing silently
   - No error callback to update prospect status
   - Prospects stay in `queued_in_n8n` forever

4. **N8N Missing Unipile Credentials**
   - Workflow needs Unipile API key to send messages
   - May not be configured in N8N environment

---

## What the N8N Workflow SHOULD Do

Based on code comments in `execute-live/route.ts` (lines 576-582):

```typescript
// N8N will handle:
// - LinkedIn profile lookup (GET /api/v1/users/{username})
// - Connection request (POST /api/v1/users/invite)
// - Wait 24-48 hours
// - Check connection acceptance
// - Send follow-ups (FU1-4, Goodbye)
// - Reply detection
```

### Expected N8N Workflow Steps

```
1. Receive webhook payload
   ↓
2. For each prospect in payload:
   a. Extract LinkedIn username from URL
   b. Call Unipile: GET /api/v1/users/{username}
   c. Get LinkedIn internal ID
   ↓
3. Send connection request:
   a. Call Unipile: POST /api/v1/users/invite
   b. Body: { user_id, message }
   c. Get message_id from response
   ↓
4. Update Supabase:
   a. UPDATE campaign_prospects
   b. SET status = 'connection_requested'
   c. SET contacted_at = NOW()
   d. SET personalization_data->unipile_message_id
   ↓
5. Schedule follow-ups (24-48 hours later)
6. Monitor for replies
7. Send FU1-4 messages
8. Handle goodbyes
```

---

## Diagnostic Steps Required

### Step 1: Check N8N UI (Manual)

**Action:** Log into N8N and verify:
- [ ] Workflow named "Campaign Execute" or similar exists
- [ ] Workflow is ACTIVE (not paused)
- [ ] Workflow has webhook trigger configured
- [ ] Workflow has Unipile integration steps
- [ ] Workflow has Supabase update steps

**N8N Login:** https://innovareai.app.n8n.cloud

### Step 2: Check Workflow Execution Logs

**Action:** In N8N UI, check executions:
- [ ] Recent execution for test campaign visible
- [ ] Execution shows success or error
- [ ] If error, what step failed?
- [ ] If success, did it complete all steps?

### Step 3: Verify Unipile Credentials in N8N

**Action:** In N8N workflow, verify:
- [ ] Unipile API credentials configured
- [ ] Unipile DSN configured
- [ ] Test connection to Unipile API

### Step 4: Check N8N Environment Variables

**Action:** In N8N settings, verify:
- [ ] UNIPILE_API_KEY set
- [ ] UNIPILE_DSN set
- [ ] NEXT_PUBLIC_SUPABASE_URL set
- [ ] SUPABASE_SERVICE_ROLE_KEY set

---

## Quick Fix Options

### Option A: Use Direct Unipile API (Bypass N8N)

**Pros:**
- Immediate execution (no async delay)
- Direct control over execution
- Easier to debug
- No N8N dependency

**Cons:**
- Lose follow-up automation
- Lose reply monitoring
- Need to manually handle delays and sequencing

**Implementation:** Use the backup code in route.ts (lines 575+)

### Option B: Fix N8N Workflow

**Pros:**
- Full automation (follow-ups, reply monitoring)
- Centralized orchestration
- Proper sequencing and delays

**Cons:**
- Requires N8N workflow debugging
- More complex setup
- Async makes debugging harder

**Implementation:** Fix N8N workflow configuration

### Option C: Hybrid Approach

**Pros:**
- Initial send via direct API (fast, reliable)
- Follow-ups via N8N (automated)
- Best of both worlds

**Cons:**
- More complex
- Two systems to maintain

---

## Recommendations

### Immediate Action (Next 10 Minutes)

1. **Check N8N workflow in UI**
   - Log into https://innovareai.app.n8n.cloud
   - Find campaign execution workflow
   - Check if active and configured correctly
   - Review recent execution logs

2. **Verify workflow has Unipile steps**
   - Should have HTTP Request nodes calling Unipile API
   - Should have Supabase nodes updating prospects
   - Should have error handling

### If Workflow is Broken (Next 30 Minutes)

**Option 1: Quick Fix - Use Direct API**
```typescript
// Temporarily bypass N8N for testing
const USE_N8N = false; // Set to false

if (USE_N8N) {
  // Call N8N webhook
} else {
  // Send directly via Unipile
}
```

**Option 2: Fix N8N Workflow**
- Import working workflow template
- Configure Unipile credentials
- Configure Supabase credentials
- Test with 1 prospect

### Long Term (Next Sprint)

1. **Document N8N workflow**
   - Export workflow JSON
   - Document each step
   - Add to docs/n8n/

2. **Add N8N monitoring**
   - Alert on failed executions
   - Dashboard for queued prospects
   - Auto-retry on failure

3. **Consider hybrid approach**
   - Direct send for initial contact
   - N8N for follow-ups only

---

## Environment Check

### ✅ N8N Configuration (from .env.local)

```bash
N8N_INSTANCE_URL=https://innovareai.app.n8n.cloud
N8N_API_KEY=eyJhbGciOiJIUzI1NiIs... (valid JWT)
N8N_API_BASE_URL=https://innovareai.app.n8n.cloud
N8N_CAMPAIGN_WEBHOOK_URL=https://innovareai.app.n8n.cloud/webhook/campaign-execute
```

**Status:** ✅ All configured correctly

### ✅ Unipile Configuration (for N8N to use)

N8N workflow needs these to send messages:
```bash
UNIPILE_DSN=<from .env.local>
UNIPILE_API_KEY=<from .env.local>
```

**Action Required:** Verify these are set in N8N environment variables

---

## Test Campaign Details

**For reference when debugging in N8N UI:**

**Campaign:**
- ID: `e33716ce-453f-436d-bb54-bcd16d20a92f`
- Name: "20251031-IAI-test 1"
- Workspace ID: `babdcab8-1a78-4b2f-913e-6e9fd9821009` (InnovareAI)

**Prospects:**
1. **waitechelsea User**
   - ID: (check database)
   - LinkedIn: (check database)
   - Status: `queued_in_n8n`
   - Queued: 11/1/2025, 2:44:37 AM

2. **odiakosa obazeh**
   - ID: (check database)
   - LinkedIn: (check database)
   - Status: `queued_in_n8n`
   - Queued: 11/1/2025, 2:44:37 AM

**Expected in N8N logs:**
- Execution timestamp around 2:44 AM
- Should show webhook received
- Should show 2 prospects processed
- Should show Unipile API calls (success or error)

---

## Next Steps

1. ✅ **Confirmed:** N8N webhook is responding
2. ⏳ **Required:** Check N8N UI for workflow status
3. ⏳ **Required:** Check N8N execution logs for errors
4. ⏳ **Required:** Verify Unipile credentials in N8N

**Status:** Waiting for N8N UI verification

---

**Created:** October 31, 2025
**Test Campaign:** "20251031-IAI-test 1"
**Webhook Test:** ✅ PASSED
**Issue:** N8N workflow not completing execution
