# N8N Workflow Session Summary - November 1, 2025

**Status:** ✅ Core Implementation Complete | ⏳ Advanced Features Specified

---

## What Was Accomplished

### 1. ✅ Standard Funnel Implementation

**Updated workflow to match actual standard funnel:**
- CR → 6 hours → FU1 → 3 days → FU2 → 5 days → FU3/4/5/6
- Total: 7 messages (CR + 6 follow-ups)
- Duration: ~23 days (if connection accepted)

**Files Updated:**
- `n8n-workflows/campaign-execute-complete.json` (39 nodes)
- `app/api/campaigns/linkedin/execute-live/route.ts` (timing payload)

### 2. ✅ Unipile Connection Verification

**Added connection check after 6-hour wait:**
- Queries Unipile `/api/v1/users/{username}/relations` endpoint
- Checks if prospect's provider_id exists in relations list
- **If connected:** Proceeds with FU1-6 sequence
- **If NOT connected:** Marks prospect as `connection_not_accepted` and ends sequence

**Why this is critical:**
- Unipile does NOT automatically prevent messaging unaccepted connections
- LinkedIn only allows messaging to accepted connections
- Prevents wasted API calls and ensures compliance

**Reference:** [Unipile - Detecting Accepted Invitations](https://developer.unipile.com/docs/detecting-accepted-invitations)

### 3. ✅ Message Structure Updates

**Renamed "Goodbye" → "FU6":**
- Message keys: `cr`, `fu1`, `fu2`, `fu3`, `fu4`, `fu5`, `fu6`
- Status progression: `connection_requested` → `follow_up_1_sent` → ... → `follow_up_6_sent`
- FU6 is the final message (no separate goodbye)

### 4. ✅ Fixed Scheduler Workflow

**File:** `/Users/tvonlinz/Downloads/SAM Scheduled Campaign Checker.json`

**What it does:**
- Runs every 120 minutes (2 hours)
- Queries Supabase for campaigns with `status = 'scheduled'` AND `auto_execute = true`
- Calls `POST /api/campaigns/linkedin/execute-live` for each due campaign

**Fixed:**
- Now passes `campaignId` and `workspaceId` in request body
- Previously had empty body parameters (would have failed)

### 5. ✅ Wait Node Configuration

**All wait nodes use webhook mode (not cron):**
- Exact timing per prospect (6h, 72h, 120h, etc.)
- Each prospect gets independent schedule
- N8N handles state persistence via webhookId
- Scalable to thousands of prospects

**Unique webhook IDs:**
- `wait-fu1` (6 hours)
- `wait-fu2` (72 hours / 3 days)
- `wait-fu3` through `wait-fu6` (120 hours / 5 days each)

### 6. ✅ Documentation Created

**Comprehensive Guides:**
1. **N8N_STANDARD_FUNNEL.md** - Standard funnel specification
2. **N8N_STANDARD_FUNNEL_COMPLETE.md** - Complete implementation guide (367 lines)
3. **N8N_SEND_TIME_REQUIREMENTS.md** - Advanced send-time validation spec
4. **send-time-validator.js** - Reusable timezone/holiday validator
5. **N8N_SESSION_SUMMARY_NOV1.md** (this file) - Session summary

---

## What Needs Implementation

### Priority 1: Reply-Stop Mechanism (High Priority)

**Requirement:** Stop sending follow-ups if prospect replies

**Implementation:**
Add this node before EACH follow-up (FU1-6):

```javascript
// Node Name: "Check if Prospect Replied"
// Type: Code (JavaScript)

const prospectId = $node['Extract Message ID'].json.prospect_id;
const supabase_url = $env.NEXT_PUBLIC_SUPABASE_URL;
const supabase_key = $env.SUPABASE_SERVICE_ROLE_KEY;

// Check prospect status
const response = await fetch(
  `${supabase_url}/rest/v1/campaign_prospects?id=eq.${prospectId}&select=status`,
  {
    headers: {
      'apikey': supabase_key,
      'Authorization': `Bearer ${supabase_key}`
    }
  }
);

const data = await response.json();
const status = data[0]?.status;

console.log(`🔍 Prospect status check: ${status}`);

// If prospect replied, end sequence
if (status === 'replied') {
  console.log('⏸️ Prospect has replied - ending sequence');
  return [{
    json: {
      prospect_id: prospectId,
      action: 'end_sequence',
      reason: 'prospect_replied'
    }
  }];
}

// Continue to send
return [{
  json: {
    ...$input.item.json,
    action: 'send',
    status: status
  }
}];
```

**Then add IF node:**
- If `action = 'end_sequence'` → Update database and stop
- If `action = 'send'` → Continue to Personalize FU message

**Locations to add:**
1. After "Wait 6 Hours for FU1" (before Personalize FU1)
2. After "Wait for FU2" (before Personalize FU2)
3. After "Wait for FU3" (before Personalize FU3)
4. After "Wait for FU4" (before Personalize FU4)
5. After "Wait for FU5" (before Personalize FU5)
6. After "Wait for FU6" (before Personalize FU6)

**Impact:** ~12 additional nodes (6 check nodes + 6 IF nodes) = **51 total nodes**

---

### Priority 2: Timezone & Business Hours (Medium Priority)

**Requirements:**
1. User timezone (campaign owner, not prospect)
2. Business hours (8am-6pm in user's timezone)
3. No weekends (Monday-Friday only)
4. No public holidays (country-specific)
5. Message randomization (avoid spam detection)

**See:** `N8N_SEND_TIME_REQUIREMENTS.md` for full specification

**Recommended Approach:** Option B (Hybrid - N8N + API Helper)

Create API endpoint: `POST /api/campaigns/validate-send-time`

**Why hybrid approach:**
- Easier to maintain timezone/holiday logic in API
- Can test independently
- Can update without changing N8N workflow
- Supports complex rules (holidays, A/B testing, etc.)

**Estimated effort:**
- API endpoint: 4-6 hours
- N8N integration: 2-3 hours
- Testing: 2-3 hours
- **Total: 8-12 hours**

---

### Priority 3: Campaign Reply Detection Integration (Low Priority)

**Current state:**
- Reply detection logic exists in `lib/campaign-reply-detector.ts`
- Tracks replies in `campaign_replies` table
- Updates prospect status to `'replied'`

**What's needed:**
- Webhook handler for Unipile reply events
- Automatic status update when reply detected
- Integration with Priority 1 reply-stop mechanism

**See:** `lib/campaign-reply-detector.ts` (504 lines)

---

## Current Workflow Structure

### Main Campaign Workflow (2bmFPN5t2y6A4Rx2)
**File:** `n8n-workflows/campaign-execute-complete.json`
**Nodes:** 39
**Purpose:** Execute full campaign sequence (CR + FU1-6)

**Flow:**
```
Webhook → Split Prospects → Extract Username
  ↓
Lookup LinkedIn Profile → Personalize CR → Send CR
  ↓
Extract Message ID → Update Status CR Sent
  ↓
Wait 6 Hours → Check Connection via Unipile
  ↓
Parse Connection Status → Connection Accepted?
  ↓                              ↓
  ✅ YES                         ❌ NO
  ↓                              ↓
Personalize FU1             Mark Not Accepted
Send FU1                    (End Sequence)
Update FU1 Sent
  ↓
Wait 3 Days → Personalize FU2 → Send FU2 → Update FU2 Sent
  ↓
Wait 5 Days → Personalize FU3 → Send FU3 → Update FU3 Sent
  ↓
Wait 5 Days → Personalize FU4 → Send FU4 → Update FU4 Sent
  ↓
Wait 5 Days → Personalize FU5 → Send FU5 → Update FU5 Sent
  ↓
Wait 5 Days → Personalize FU6 → Send FU6 → Update FU6 Sent
  ↓
Success
```

**Error Handling:**
- All critical nodes route errors to "Error Handler"
- Failed prospects marked as `status = 'failed'`
- Error details stored in database

### Scheduler Workflow (7QJZcRwQBI0wPRS4)
**File:** `/Users/tvonlinz/Downloads/SAM Scheduled Campaign Checker.json`
**Nodes:** 7
**Purpose:** Auto-execute scheduled campaigns every 2 hours

**Flow:**
```
Schedule Trigger (every 120 min)
  ↓
Get Due Campaigns (from Supabase)
  ↓
Any Campaigns Due? (IF check)
  ↓                    ↓
  ✅ YES              ❌ NO
  ↓                    ↓
Loop Campaigns     No Campaigns
  ↓                    (End)
Execute Campaign
(Calls API with campaignId)
  ↓
Next Campaign (loop back)
```

---

## Database Schema Updates Needed

### 1. Add timezone to campaigns
```sql
ALTER TABLE campaigns
ADD COLUMN timezone VARCHAR(100) DEFAULT 'UTC',
ADD COLUMN business_hours_start INTEGER DEFAULT 8,
ADD COLUMN business_hours_end INTEGER DEFAULT 18,
ADD COLUMN send_on_weekends BOOLEAN DEFAULT false,
ADD COLUMN respect_holidays BOOLEAN DEFAULT true,
ADD COLUMN country_code VARCHAR(2) DEFAULT 'US';
```

### 2. Create public_holidays table
```sql
CREATE TABLE public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL,
  holiday_date DATE NOT NULL,
  holiday_name VARCHAR(255),
  UNIQUE(country_code, holiday_date)
);

CREATE INDEX idx_public_holidays_country_date
ON public_holidays(country_code, holiday_date);

-- Seed with 2025 holidays
-- See N8N_SEND_TIME_REQUIREMENTS.md for full list
```

### 3. Ensure campaign_prospects has replied status
```sql
-- Already exists, just verify:
ALTER TABLE campaign_prospects
ADD CONSTRAINT campaign_prospects_status_check
CHECK (status IN (
  'pending', 'approved', 'ready_to_message',
  'queued_in_n8n', 'connection_requested',
  'replied',  -- ← This is what we check
  'completed', 'failed', 'error',
  'connection_not_accepted', 'not_interested'
));
```

---

## Testing Checklist

### Before Importing to N8N

1. **Validate JSON:**
```bash
jq empty n8n-workflows/campaign-execute-complete.json
# Should output: (nothing) = valid JSON
```

2. **Check node count:**
```bash
jq '.nodes | length' n8n-workflows/campaign-execute-complete.json
# Should output: 39
```

3. **Verify webhook IDs:**
```bash
jq -r '.nodes[] | select(.type == "n8n-nodes-base.wait") | "\(.name): \(.webhookId)"' \
  n8n-workflows/campaign-execute-complete.json
```

Expected output:
```
Wait 6 Hours for FU1: wait-fu1
Wait for FU2: wait-fu2
Wait for FU3: wait-fu3
Wait for FU4: wait-fu4
Wait for FU5: wait-fu5
Wait for FU6: wait-fu6
```

### After Import

1. **Verify environment variables in N8N:**
   - `UNIPILE_DSN`
   - `UNIPILE_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. **Test with 1 prospect:**
   - Create test campaign with 1 prospect
   - Execute via scheduler or manual trigger
   - Monitor N8N Executions tab
   - Verify CR sent (check LinkedIn)
   - Wait 6 hours
   - Verify connection check happens
   - Verify FU1 sent (if connected)

3. **Monitor database:**
```sql
SELECT
  id,
  first_name,
  last_name,
  status,
  contacted_at,
  personalization_data
FROM campaign_prospects
WHERE campaign_id = 'YOUR_TEST_CAMPAIGN_ID'
ORDER BY contacted_at DESC;
```

Expected status progression:
- `queued_in_n8n` → `connection_requested` → `follow_up_1_sent` → ... → `follow_up_6_sent`

---

## Known Issues & Limitations

### Issue 1: No Reply-Stop Check
**Status:** ⚠️ Not implemented
**Impact:** Will continue sending FU messages even if prospect replies
**Fix:** Add reply-check nodes (see Priority 1 above)

### Issue 2: No Timezone Support
**Status:** ⚠️ Not implemented
**Impact:** All messages send based on server time (UTC)
**Fix:** Implement send-time validation (see Priority 2 above)

### Issue 3: No Weekend/Holiday Blocking
**Status:** ⚠️ Not implemented
**Impact:** Messages may send on weekends or holidays
**Fix:** Implement send-time validation (see Priority 2 above)

### Issue 4: No Message Randomization
**Status:** ⚠️ Not implemented
**Impact:** All messages send at exact wait intervals (predictable pattern)
**Fix:** Add random delay (±30-120 minutes) to wait nodes

### Issue 5: Unipile Relations API Response Format
**Status:** ⚠️ Unknown
**Impact:** May not correctly detect connection acceptance if Unipile changes response format
**Debug:** Check N8N execution logs for "Parse Connection Status" node output

---

## Quick Reference

### Import Workflow to N8N

1. Go to: https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2
2. Delete all existing nodes (Cmd/Ctrl + A, then Delete)
3. Click "Import from File"
4. Select: `n8n-workflows/campaign-execute-complete.json`
5. Verify 39 nodes imported
6. Click "Active" toggle (top right)
7. Save workflow

### Import Scheduler to N8N

1. Go to: https://innovareai.app.n8n.cloud/workflow/7QJZcRwQBI0wPRS4
2. Delete all existing nodes
3. Import: `/Users/tvonlinz/Downloads/SAM Scheduled Campaign Checker.json`
4. Verify 7 nodes imported
5. Activate and save

### Test Campaign Execution

```bash
# Via API (manual trigger)
curl -X POST https://app.meet-sam.com/api/campaigns/linkedin/execute-live \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "YOUR_CAMPAIGN_ID",
    "workspaceId": "YOUR_WORKSPACE_ID",
    "maxProspects": 1
  }'

# Via Scheduler (automatic)
# Just wait - scheduler runs every 2 hours
# Check N8N execution logs for "SAM Scheduled Campaign Checker"
```

---

## Files to Import/Update

### Ready to Import (N8N)
1. ✅ `n8n-workflows/campaign-execute-complete.json` → Workflow 2bmFPN5t2y6A4Rx2
2. ✅ `/Users/tvonlinz/Downloads/SAM Scheduled Campaign Checker.json` → Workflow 7QJZcRwQBI0wPRS4

### Already Updated (API)
1. ✅ `app/api/campaigns/linkedin/execute-live/route.ts` - Timing payload

### Reference Only (Documentation)
1. ✅ `N8N_STANDARD_FUNNEL.md`
2. ✅ `N8N_STANDARD_FUNNEL_COMPLETE.md`
3. ✅ `N8N_SEND_TIME_REQUIREMENTS.md`
4. ✅ `N8N_SESSION_SUMMARY_NOV1.md` (this file)
5. ✅ `n8n-workflows/send-time-validator.js` (for future use)

---

## Next Session Recommendations

**Immediate (Today/Tomorrow):**
1. Import both N8N workflows
2. Test with 1 prospect
3. Monitor first 24 hours of execution

**Short-term (This Week):**
1. Implement reply-stop checks (Priority 1)
2. Add basic message randomization (±30 min)
3. Test with 10 prospects

**Medium-term (This Month):**
1. Implement timezone support (Priority 2)
2. Add weekend/holiday blocking
3. Create public_holidays table
4. Test across different timezones

**Long-term (Next Quarter):**
1. A/B test send times
2. Machine learning optimal send times
3. Advanced spam detection avoidance
4. Workspace-level send rules

---

## Summary

### ✅ What Works Now
- Standard funnel timing (6h → 3d → 5d intervals)
- Unipile connection verification
- 7-message sequence (CR + 6 FUs)
- Webhook-based scheduling (exact timing)
- Graceful handling of unaccepted connections
- Error handling and database updates
- Scheduled campaign execution (every 2 hours)

### ⚠️ What's Missing
- Reply-stop mechanism (HIGH PRIORITY)
- Timezone support
- Weekend/holiday blocking
- Message randomization
- Advanced send-time validation

### 📊 Metrics
- **Nodes:** 39 (main workflow) + 7 (scheduler) = 46 total
- **Messages:** 7 per prospect (CR + 6 FUs)
- **Duration:** ~23 days per sequence
- **Documentation:** 5 comprehensive guides

---

**Session Date:** November 1, 2025
**Status:** Core implementation complete, advanced features specified
**Next Steps:** Import workflows, test, implement Priority 1 (reply-stop)
