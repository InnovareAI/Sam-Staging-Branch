# N8N Complete Campaign Workflow - Implementation Guide

**Date:** November 1, 2025
**Workflow:** Campaign Execute - LinkedIn via Unipile (Complete)
**File:** `n8n-workflows/campaign-execute-complete.json`
**Status:** ✅ Ready for import

---

## What's New - Complete Workflow

### Previous Version (campaign-execute.json)
- ❌ Only handled Connection Request (CR)
- ❌ No follow-up messages
- ❌ No waiting periods
- ❌ Campaign ended after first message

### New Complete Version (campaign-execute-complete.json)
- ✅ Connection Request (CR)
- ✅ Follow-Up 1 (FU1) after 24-48 hours
- ✅ Follow-Up 2 (FU2) after 48-72 hours
- ✅ Follow-Up 3 (FU3) after 72-96 hours
- ✅ Follow-Up 4 (FU4) after 96-120 hours
- ✅ Follow-Up 5 (FU5) after 120-144 hours
- ✅ Goodbye Message after 168-192 hours
- ✅ Connection acceptance checking
- ✅ Randomized wait times (natural human behavior)

---

## Campaign Sequence Timeline

```
Day 1:  Connection Request (CR) sent
        ↓
Day 2-3: Wait 24-48 hours (random)
        ↓ [Check if connection accepted]
        ↓ [If not accepted → mark as not_accepted, end]
        ↓ [If accepted → continue]
        ↓
Day 3:  Follow-Up 1 (FU1) sent
        ↓
Day 5-6: Wait 48-72 hours (random)
        ↓
Day 6:  Follow-Up 2 (FU2) sent
        ↓
Day 9-10: Wait 72-96 hours (random)
        ↓
Day 10: Follow-Up 3 (FU3) sent
        ↓
Day 14-15: Wait 96-120 hours (random)
        ↓
Day 15: Follow-Up 4 (FU4) sent
        ↓
Day 20-21: Wait 120-144 hours (random)
        ↓
Day 21: Follow-Up 5 (FU5) sent
        ↓
Day 28-29: Wait 168-192 hours (random)
        ↓
Day 29: Goodbye Message sent
        ↓
        Campaign sequence complete
```

**Total Campaign Duration:** ~30 days (4 weeks)

---

## Quick Import (5 Minutes)

### Step 1: Go to N8N
URL: https://innovareai.app.n8n.cloud

### Step 2: Open Existing Workflow
Open workflow: **2bmFPN5t2y6A4Rx2**
URL: https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2

### Step 3: Replace Workflow
1. Delete all existing nodes in the workflow
2. Click: **⋯** (3-dot menu) → **Import from file**
3. Select: `n8n-workflows/campaign-execute-complete.json`
4. Click: **Import**

### Step 4: Verify Environment Variables
Settings → Environment Variables (should already be set):

| Variable | Value |
|----------|-------|
| `UNIPILE_DSN` | `api6.unipile.com:13670` |
| `UNIPILE_API_KEY` | From .env.local |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://latxadqrvrrrcvkktrog.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | From .env.local |

### Step 5: Activate & Save
1. Ensure workflow is **Active** (toggle switch top right)
2. Click: **Save**

---

## Complete Workflow Architecture

### 38 Nodes Total

**Main Success Path (32 nodes):**
1. Webhook (trigger)
2. Split Prospects
3. Extract Username
4. Lookup LinkedIn Profile
5. Personalize CR
6. Send Connection Request
7. Extract Message ID
8. Update Status CR Sent
9. Wait 24-48 Hours
10. Check Connection Status
11. Connection Accepted? (IF node)
12-13. Personalize FU1 → Send FU1
14. Update FU1 Sent
15. Wait 48-72 Hours
16-17. Personalize FU2 → Send FU2
18. Update FU2 Sent
19. Wait 72-96 Hours
20-21. Personalize FU3 → Send FU3
22. Update FU3 Sent
23. Wait 96-120 Hours
24-25. Personalize FU4 → Send FU4
26. Update FU4 Sent
27. Wait 120-144 Hours
28-29. Personalize FU5 → Send FU5
30. Update FU5 Sent
31. Wait 168-192 Hours
32-33. Personalize Goodbye → Send Goodbye
34. Update Sequence Complete
35. Success

**Error Path (3 nodes):**
36. Mark Not Accepted (if connection not accepted)
37. Error Handler (catches all errors)
38. Update Failed Status

---

## Message Personalization

All messages support these placeholders:

```
{{first_name}}    → Prospect's first name
{{last_name}}     → Prospect's last name
{{company_name}}  → Company name
{{title}}         → Job title
```

**Example:**
```
Message template:
"Hi {{first_name}}, I noticed you work at {{company_name}} as a {{title}}..."

Rendered:
"Hi John, I noticed you work at Acme Corp as a Senior Engineer..."
```

---

## Message Configuration

### Required Messages in Payload

```javascript
{
  "prospects": [...],
  "campaign": {...},
  "messages": {
    "cr": "Connection request message...",
    "fu1": "First follow-up message...",
    "fu2": "Second follow-up message...",  // Optional
    "fu3": "Third follow-up message...",   // Optional
    "fu4": "Fourth follow-up message...",  // Optional
    "fu5": "Fifth follow-up message...",   // Optional
    "goodbye": "Final goodbye message..."  // Optional
  }
}
```

### Graceful Degradation

If a follow-up message is not provided:
- Workflow logs: `⚠️ No FU2 configured, ending sequence`
- Campaign ends gracefully at that step
- Prospect status shows last successful step

**Example:**
- If only `cr` and `fu1` provided
- Sequence: CR → Wait → FU1 → End
- Missing FU2-5 and goodbye are skipped

---

## Wait Time Randomization

### Why Randomize?

LinkedIn detects automated behavior. Randomized timing appears more human.

### Randomization Logic

```javascript
// Wait 24-48 hours (random)
Math.floor(Math.random() * 24) + 24

// Breakdown:
// Math.random() → 0.0 to 0.999
// * 24 → 0 to 23.99
// + 24 → 24 to 47.99
// Math.floor() → 24 to 47 hours
```

**All Wait Periods:**
- 24-48 hours (after CR)
- 48-72 hours (after FU1)
- 72-96 hours (after FU2)
- 96-120 hours (after FU3)
- 120-144 hours (after FU4)
- 168-192 hours (after FU5)

---

## Connection Acceptance Check

### How It Works

After CR sent and 24-48 hour wait:
1. Query Supabase for prospect status
2. Check `personalization_data.connection_accepted`
3. If `true` → Continue to FU1
4. If `false` → Mark as `connection_not_accepted`, end sequence

### Setting Connection Accepted

**Manual Update:**
```sql
UPDATE campaign_prospects
SET personalization_data = jsonb_set(
  personalization_data,
  '{connection_accepted}',
  'true'
)
WHERE id = 'prospect-id';
```

**Automated (future):**
- Monitor Unipile for connection acceptance events
- Webhook from Unipile → Update Supabase
- N8N will automatically pick this up

---

## Database Status Progression

### Status Values Throughout Campaign

```
1. queued_in_n8n           (initial, set by API)
   ↓
2. connection_requested     (CR sent)
   ↓ [wait 24-48h]
   ↓
3. connection_not_accepted  (if not accepted, END)
   OR
   follow_up_1_sent         (if accepted, continue)
   ↓ [wait 48-72h]
   ↓
4. follow_up_2_sent
   ↓ [wait 72-96h]
   ↓
5. follow_up_3_sent
   ↓ [wait 96-120h]
   ↓
6. follow_up_4_sent
   ↓ [wait 120-144h]
   ↓
7. follow_up_5_sent
   ↓ [wait 168-192h]
   ↓
8. sequence_completed       (goodbye sent, END)
```

### Timestamp Tracking

```javascript
personalization_data: {
  unipile_message_id: "msg_123",
  provider_id: "linkedin_internal_id",
  fu1_sent_at: "2025-11-03T10:30:00Z",
  fu2_sent_at: "2025-11-06T14:45:00Z",
  fu3_sent_at: "2025-11-10T09:15:00Z",
  fu4_sent_at: "2025-11-15T16:20:00Z",
  fu5_sent_at: "2025-11-21T11:10:00Z",
  goodbye_sent_at: "2025-11-29T13:00:00Z",
  sequence_completed_at: "2025-11-29T13:00:00Z",
  connection_accepted: true,
  connection_checked_at: "2025-11-03T08:00:00Z"
}
```

---

## Error Handling

### Error Scenarios

1. **Invalid LinkedIn URL**
   - Caught in "Extract Username" node
   - Error handler updates status to `failed`
   - Error message stored in `personalization_data.error`

2. **Unipile API Errors**
   - Connection request fails (401, 403, 500)
   - Follow-up message fails
   - Error handler catches and logs

3. **Supabase Update Failures**
   - Database connection issues
   - Invalid prospect ID
   - Error handler attempts to log to database

### Error Flow

```
Any Node Error
  ↓
Error Handler (logs error)
  ↓
Update Failed Status (updates database)
  ↓
Campaign ends for that prospect
```

---

## Testing the Complete Workflow

### Test with 1 Prospect (Dry Run)

```bash
# 1. Run campaign with 1 prospect
curl -X POST "https://app.meet-sam.com/api/campaigns/linkedin/execute-live" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "YOUR_CAMPAIGN_ID",
    "maxProspects": 1
  }'

# 2. Check N8N Executions
# → Should show "Campaign Execute" execution
# → Status: Running (will run for days)

# 3. Check database
SELECT id, first_name, status, contacted_at
FROM campaign_prospects
WHERE status = 'connection_requested'
ORDER BY contacted_at DESC
LIMIT 1;

# 4. Manually mark connection accepted (to test FU1)
UPDATE campaign_prospects
SET personalization_data = jsonb_set(
  personalization_data,
  '{connection_accepted}',
  'true'
)
WHERE id = 'prospect-id-from-above';

# 5. Wait for execution to resume
# → After 24-48 hours, FU1 should send
```

### Monitor Long-Running Execution

1. Go to N8N: **Executions** tab
2. Find execution (may show "Running" for days)
3. Click execution to see progress
4. Each wait node shows remaining time
5. Completed nodes show green checkmarks

---

## Production Deployment

### Step 1: Import Workflow ✅

Follow "Quick Import" steps above

### Step 2: Test with 1-2 Prospects

Run small test campaign:
- 1-2 prospects
- All messages configured (CR + FU1-5 + Goodbye)
- Monitor for 48 hours

### Step 3: Verify Each Stage

**After CR sent:**
- [ ] Prospect status = `connection_requested`
- [ ] `contacted_at` timestamp set
- [ ] LinkedIn invitation appears

**After 24-48 hours:**
- [ ] Connection status checked
- [ ] If accepted, FU1 sent
- [ ] Status = `follow_up_1_sent`

**Continue monitoring** through FU2-5 and goodbye

### Step 4: Scale Up

Once 1-2 test prospects complete successfully:
- Run campaigns with 10-50 prospects
- Monitor for errors/failures
- Adjust message timing if needed

---

## Troubleshooting

### Issue: Workflow Not Executing

**Check:**
1. Is workflow ACTIVE? (toggle in top right)
2. Is webhook path correct? (`/webhook/campaign-execute`)
3. Check N8N Executions for errors

### Issue: Wait Nodes Not Resuming

**Check:**
1. N8N instance running?
2. Webhook IDs unique? (each wait node has unique ID)
3. Check N8N execution logs

### Issue: Connection Never Marked Accepted

**Solution:**
Manually update for testing:
```sql
UPDATE campaign_prospects
SET personalization_data = jsonb_set(
  personalization_data,
  '{connection_accepted}',
  'true'
)
WHERE id = 'prospect-id';
```

Future: Implement Unipile webhook to auto-detect acceptance

### Issue: Follow-Ups Not Sending

**Check:**
1. Are messages configured? (`messages.fu1`, `messages.fu2`, etc.)
2. Check N8N logs for "No FU2 configured" warnings
3. Verify Unipile API working:
```bash
curl -X POST "https://api6.unipile.com:13670/api/v1/messaging/messages" \
  -H "X-API-KEY: $UNIPILE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"provider_id": "test", "text": "test"}'
```

---

## Files Reference

**Complete Workflow:**
- `n8n-workflows/campaign-execute-complete.json` (38 nodes)

**Previous Workflows (for reference):**
- `n8n-workflows/campaign-execute.json` (9 nodes, CR only)
- `n8n-workflows/sam-linkedin-campaign-v2.json` (14 nodes, partial)

**Documentation:**
- `N8N_COMPLETE_WORKFLOW_GUIDE.md` (this file)
- `N8N_WORKFLOW_SETUP_INSTRUCTIONS.md` (general setup)
- `N8N_FIX_SUMMARY.md` (why we created this)

---

## Comparison: Simple vs Complete

| Feature | Simple (9 nodes) | Complete (38 nodes) |
|---------|-----------------|---------------------|
| Connection Request | ✅ | ✅ |
| Follow-Ups | ❌ | ✅ (FU1-5 + Goodbye) |
| Wait Times | ❌ | ✅ (Randomized) |
| Connection Check | ❌ | ✅ |
| Personalization | ✅ | ✅ |
| Error Handling | ✅ | ✅ |
| Campaign Duration | 1 day | ~30 days |
| Message Count | 1 | Up to 7 |
| Use Case | Quick testing | Production campaigns |

---

## Next Steps

1. **Import Complete Workflow**
   - Replace workflow 2bmFPN5t2y6A4Rx2
   - Use `campaign-execute-complete.json`

2. **Test with 1 Prospect**
   - Configure all messages (CR + FU1-5 + Goodbye)
   - Monitor execution for 48 hours
   - Manually mark connection accepted

3. **Monitor & Iterate**
   - Check execution logs daily
   - Adjust message timing if needed
   - Add connection auto-detection (future)

4. **Scale to Production**
   - Run full campaigns with 50-100 prospects
   - Monitor for rate limits
   - Track response rates per message

---

**Status:** ✅ Complete workflow ready for import
**Workflow:** campaign-execute-complete.json (38 nodes)
**Replaces:** Workflow 2bmFPN5t2y6A4Rx2
**Next:** Import → Test → Deploy
