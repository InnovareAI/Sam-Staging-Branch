# N8N Workflow Testing & Verification Guide

**Created:** November 1, 2025
**Status:** Ready for Testing
**Workflows:** 2 (Main Campaign + Scheduler)

---

## Pre-Testing Checklist

### 1. Verify N8N Environment Variables

Login to N8N: https://innovareai.app.n8n.cloud

Go to: Settings → Variables → Check these exist:

```
✅ UNIPILE_DSN
✅ UNIPILE_API_KEY
✅ NEXT_PUBLIC_SUPABASE_URL
✅ SUPABASE_SERVICE_ROLE_KEY
```

**If any missing, add them from your `.env.local` file.**

### 2. Verify Workflows Are Active

#### Main Campaign Workflow (2bmFPN5t2y6A4Rx2)
- URL: https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2
- Status: Should show "Active" toggle ON
- Nodes: Should show 39 nodes
- Webhook: Should show webhook URL ending in `/webhook/campaign-execute`

#### Scheduler Workflow (7QJZcRwQBI0wPRS4)
- URL: https://innovareai.app.n8n.cloud/workflow/7QJZcRwQBI0wPRS4
- Status: Should show "Active" toggle ON
- Nodes: Should show 7 nodes
- Schedule: Runs every 120 minutes (2 hours)

### 3. Verify Webhook URL in API

Check that your API is calling the correct N8N webhook:

```bash
# View the webhook URL configured
grep -r "webhook/campaign-execute" app/api/campaigns/linkedin/execute-live/

# Should return something like:
# const n8nWebhookUrl = 'https://innovareai.app.n8n.cloud/webhook/campaign-execute';
```

---

## Test 1: Manual Campaign Execution (Single Prospect)

### Step 1: Create Test Campaign

1. Go to: https://app.meet-sam.com/workspace/YOUR_WORKSPACE_ID/campaigns
2. Click "New Campaign"
3. Fill in:
   - **Name:** "N8N Test - Single Prospect"
   - **Type:** LinkedIn
   - **Status:** Draft
4. Add 1 test prospect (someone you know or a test LinkedIn account)
5. Write simple messages:
   ```
   CR: "Hi {{first_name}}, let's connect!"
   FU1: "Following up on my connection request."
   FU2: "Hope you're doing well!"
   FU3: "Just checking in again."
   FU4: "Still interested in connecting."
   FU5: "Let me know if you'd like to chat."
   FU6: "This is my final follow-up."
   ```
6. Save campaign

### Step 2: Execute Campaign via API

```bash
# Get your campaign ID from the database or URL
CAMPAIGN_ID="your-campaign-id-here"
WORKSPACE_ID="your-workspace-id-here"

# Execute campaign with 1 prospect
curl -X POST https://app.meet-sam.com/api/campaigns/linkedin/execute-live \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "'$CAMPAIGN_ID'",
    "workspaceId": "'$WORKSPACE_ID'",
    "maxProspects": 1
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Campaign started! Queued 1 prospects for execution",
  "n8nResponse": {
    "executionId": "abc123..."
  }
}
```

### Step 3: Monitor N8N Execution

1. Go to: https://innovareai.app.n8n.cloud/executions
2. Find the most recent execution of "Campaign Execute - Complete"
3. Click to view details

**What to check:**
- ✅ Execution status: "Success" (green)
- ✅ All nodes executed without errors
- ✅ "Send CR via Unipile" node shows success
- ✅ "Extract Message ID" node shows provider_id extracted
- ✅ "Update Status CR Sent" node shows database updated
- ✅ "Wait 6 Hours for FU1" node shows waiting (execution paused)

### Step 4: Verify in Database

```sql
-- Check prospect status
SELECT
  id,
  first_name,
  last_name,
  status,
  contacted_at,
  personalization_data->>'unipile_message_id' as message_id,
  personalization_data->>'provider_id' as provider_id
FROM campaign_prospects
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
ORDER BY contacted_at DESC
LIMIT 1;
```

**Expected Results:**
- `status` = 'connection_requested'
- `contacted_at` = recent timestamp (within last few minutes)
- `message_id` = Unipile message ID (msg_...)
- `provider_id` = LinkedIn provider ID

### Step 5: Verify on LinkedIn

1. Login to the LinkedIn account used for sending
2. Go to: My Network → Manage → Sent
3. Look for connection request to your test prospect
4. **Should see:** Recent connection request matching your CR message

---

## Test 2: Connection Check After 6 Hours

**Note:** This requires waiting 6 hours after Test 1, OR you can manually trigger the next step in N8N.

### Option A: Wait 6 Hours (Production Test)

Simply wait 6 hours and then check the execution again.

### Option B: Manual Trigger (Testing Only)

1. Go to N8N execution from Test 1
2. Find the "Wait 6 Hours for FU1" node
3. Click "Execute Node" to skip the wait
4. Monitor subsequent nodes

**What should happen:**
1. "Check Connection via Unipile" node calls Unipile API
2. "Parse Connection Status" node checks if prospect in relations list
3. "Connection Accepted?" IF node branches:
   - **If YES (connected):** → Personalize FU1 → Send FU1 → Update FU1 Sent
   - **If NO (not connected):** → Mark Not Accepted → End Sequence

### Verify Connection Check Results

```sql
-- Check if connection was accepted
SELECT
  status,
  personalization_data->>'connection_accepted' as accepted,
  personalization_data->>'fu1_sent_at' as fu1_sent
FROM campaign_prospects
WHERE id = 'PROSPECT_ID';
```

**If Connected:**
- `status` = 'follow_up_1_sent'
- `accepted` = 'true'
- `fu1_sent` = timestamp

**If NOT Connected:**
- `status` = 'connection_not_accepted'
- `accepted` = 'false'
- `fu1_sent` = NULL

---

## Test 3: Scheduler Auto-Execution

### Step 1: Create Scheduled Campaign

1. Create a new campaign (similar to Test 1)
2. Set status to "scheduled"
3. Set auto_execute to TRUE:

```sql
UPDATE campaigns
SET
  status = 'scheduled',
  auto_execute = true
WHERE id = 'YOUR_CAMPAIGN_ID';
```

### Step 2: Wait for Next Scheduler Run

The scheduler runs every 120 minutes (2 hours).

**Next run times:**
- 12:00 AM
- 2:00 AM
- 4:00 AM
- ... every 2 hours

### Step 3: Monitor Scheduler Execution

1. Go to: https://innovareai.app.n8n.cloud/executions
2. Find "SAM Scheduled Campaign Checker"
3. View latest execution

**What to check:**
- ✅ "Get Due Campaigns" node fetched your scheduled campaign
- ✅ "Any Campaigns Due?" IF node = TRUE
- ✅ "Execute Campaign" node called your API
- ✅ API response shows success

### Step 4: Verify Campaign Executed

```sql
-- Check if campaign was executed
SELECT
  c.name,
  c.status,
  COUNT(cp.id) as prospects_queued,
  MAX(cp.contacted_at) as last_contacted
FROM campaigns c
LEFT JOIN campaign_prospects cp ON c.id = cp.campaign_id
WHERE c.id = 'YOUR_CAMPAIGN_ID'
GROUP BY c.name, c.status;
```

**Expected:**
- `prospects_queued` > 0
- `last_contacted` = recent timestamp (within last 2 hours)

---

## Test 4: Full Sequence Test (Accelerated)

**Purpose:** Verify entire CR → FU1 → FU2 → ... → FU6 sequence

**Note:** This requires manually advancing wait nodes in N8N for testing.

### Steps:

1. Execute campaign (Test 1)
2. Wait 6 hours OR manually trigger next step
3. Verify FU1 sent
4. Manually advance "Wait for FU2" node (skip 3 days)
5. Verify FU2 sent
6. Repeat for FU3, FU4, FU5, FU6

### Expected Status Progression:

```
queued_in_n8n
  ↓
connection_requested (CR sent)
  ↓ (6 hours OR connection check passed)
follow_up_1_sent
  ↓ (3 days)
follow_up_2_sent
  ↓ (5 days)
follow_up_3_sent
  ↓ (5 days)
follow_up_4_sent
  ↓ (5 days)
follow_up_5_sent
  ↓ (5 days)
follow_up_6_sent
  ↓
completed
```

---

## Common Issues & Troubleshooting

### Issue 1: "Workflow not found" Error

**Symptom:** API returns error about N8N workflow not found

**Fix:**
1. Check webhook URL in `execute-live/route.ts`
2. Verify workflow is active in N8N
3. Check webhook exists: https://innovareai.app.n8n.cloud/webhook/campaign-execute

### Issue 2: "Missing environment variable" Error

**Symptom:** N8N execution shows "Cannot read property of undefined"

**Fix:**
1. Go to N8N Settings → Variables
2. Add missing variable (UNIPILE_DSN, UNIPILE_API_KEY, etc.)
3. Re-execute workflow

### Issue 3: Connection Check Always Fails

**Symptom:** All prospects marked as "connection_not_accepted" even when connected

**Debug:**
1. Check N8N execution → "Check Connection via Unipile" node
2. View response from Unipile API
3. Verify `provider_id` matches what's in relations list
4. Check Unipile documentation: https://developer.unipile.com/docs/detecting-accepted-invitations

**Possible cause:** Provider ID format mismatch

### Issue 4: Messages Not Sending

**Symptom:** N8N execution successful but no LinkedIn messages appear

**Check:**
1. Unipile account is active and connected
2. LinkedIn account hasn't hit weekly limit (100 connection requests/week)
3. Unipile API key is valid
4. Message personalization completed successfully

### Issue 5: Wait Nodes Not Resuming

**Symptom:** Execution pauses at wait node and never resumes

**Cause:** Webhook mode requires N8N to be running continuously

**Fix:**
- Verify N8N is not in maintenance mode
- Check webhook is registered correctly
- Test with shorter wait time (e.g., 5 minutes) to verify mechanism works

---

## Validation Checklist

Before marking workflows as production-ready:

### Main Campaign Workflow (2bmFPN5t2y6A4Rx2)

- [ ] Webhook URL is correct and accessible
- [ ] All 39 nodes present and connected
- [ ] Environment variables configured
- [ ] CR sends successfully
- [ ] 6-hour wait functions correctly
- [ ] Connection check queries Unipile
- [ ] FU1 sends only if connected
- [ ] FU2-6 send at correct intervals
- [ ] Database updates at each step
- [ ] Error handling routes to Error Handler node

### Scheduler Workflow (7QJZcRwQBI0wPRS4)

- [ ] Schedule trigger set to 120 minutes
- [ ] Queries Supabase for scheduled campaigns
- [ ] IF node correctly checks for campaigns
- [ ] Calls API with correct campaignId and workspaceId
- [ ] Loops through multiple campaigns if needed
- [ ] Error handling for failed API calls

### Overall System

- [ ] Tested with 1 prospect successfully
- [ ] Tested with 5 prospects successfully
- [ ] Verified LinkedIn connection requests appear
- [ ] Confirmed database status updates correctly
- [ ] Checked N8N execution logs show no errors
- [ ] Validated full sequence (CR → FU6) works
- [ ] Tested scheduler auto-execution
- [ ] Verified connection check prevents messaging unaccepted connections

---

## Next Steps After Successful Testing

Once all tests pass:

1. **Mark workflows as production-ready** ✅
2. **Implement Priority 1: Reply-Stop Mechanism** (see N8N_SESSION_SUMMARY_NOV1.md)
3. **Monitor production usage** for 1 week
4. **Implement Priority 2: Timezone/Business Hours Validation**
5. **Add message randomization**
6. **Scale to multiple accounts** (bypass LinkedIn limits)

---

## Support & Resources

**N8N Workflow URLs:**
- Main: https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2
- Scheduler: https://innovareai.app.n8n.cloud/workflow/7QJZcRwQBI0wPRS4

**Documentation:**
- Session Summary: `/N8N_SESSION_SUMMARY_NOV1.md`
- Standard Funnel: `/N8N_STANDARD_FUNNEL.md`
- Complete Implementation: `/N8N_STANDARD_FUNNEL_COMPLETE.md`
- Send-Time Requirements: `/N8N_SEND_TIME_REQUIREMENTS.md`

**Files:**
- Main Workflow JSON: `/n8n-workflows/campaign-execute-complete.json`
- Scheduler Workflow JSON: `/Users/tvonlinz/Downloads/SAM Scheduled Campaign Checker.json`
- API Route: `/app/api/campaigns/linkedin/execute-live/route.ts`

---

**Testing Status:** Ready for verification
**Priority:** HIGH - Test before implementing additional features
**Estimated Time:** 2-3 hours (including wait times)
