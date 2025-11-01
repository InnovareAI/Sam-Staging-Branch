# N8N Workflows - Ready for Testing

**Date:** November 1, 2025
**Status:** ✅ Core workflows uploaded, ready for verification
**Next:** Testing → Reply-Stop Implementation → Timezone Validation

---

## 🎯 Quick Summary

Your N8N workflows have been updated and uploaded. Here's what's ready:

### ✅ Completed (Ready to Test)

1. **Standard Funnel Implemented**
   - CR → 6 hours → FU1 → 3 days → FU2 → 5 days → FU3/4/5/6
   - Total: 7 messages over ~23 days
   - All workspaces use same timing

2. **Unipile Connection Verification Added**
   - Checks if prospect accepted connection after 6-hour wait
   - Only sends follow-ups if connection accepted
   - Prevents wasted API calls to unaccepted connections

3. **Scheduler Workflow Fixed**
   - Auto-executes scheduled campaigns every 2 hours
   - Fixed critical bug (was sending empty body)
   - Now correctly passes campaignId and workspaceId

4. **Comprehensive Documentation Created**
   - N8N_STANDARD_FUNNEL.md - Funnel specification
   - N8N_SESSION_SUMMARY_NOV1.md - Complete session summary
   - N8N_WORKFLOW_TESTING_GUIDE.md - Step-by-step testing instructions
   - N8N_REPLY_STOP_IMPLEMENTATION.md - Reply-stop mechanism design
   - N8N_SEND_TIME_REQUIREMENTS.md - Advanced features specification

### ⏳ Documented (Ready to Implement)

1. **Reply-Stop Mechanism (Priority 1)**
   - Design completed and documented
   - Adds 12 nodes to workflow (51 total)
   - Prevents sending follow-ups to prospects who replied
   - See: `N8N_REPLY_STOP_IMPLEMENTATION.md`

2. **Timezone/Business Hours Validation (Priority 2)**
   - Requirements fully specified
   - Three implementation approaches documented
   - See: `N8N_SEND_TIME_REQUIREMENTS.md`

---

## 📋 What You Should Do Next

### Immediate (Today/Tomorrow)

1. **Verify Workflows Are Active**
   - Main Campaign: https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2
   - Scheduler: https://innovareai.app.n8n.cloud/workflow/7QJZcRwQBI0wPRS4
   - Check both show "Active" toggle ON

2. **Verify Environment Variables in N8N**
   - Go to: N8N Settings → Variables
   - Required: UNIPILE_DSN, UNIPILE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

3. **Test Campaign with 1 Prospect**
   - Follow guide in `N8N_WORKFLOW_TESTING_GUIDE.md`
   - Create test campaign with 1 prospect you know
   - Execute and monitor first 24 hours
   - Verify CR sends correctly
   - Verify 6-hour wait functions
   - Verify connection check happens
   - Verify FU1 sends if connected

### This Week

1. **Implement Reply-Stop Mechanism**
   - Add 12 nodes to workflow (see `N8N_REPLY_STOP_IMPLEMENTATION.md`)
   - Test with manual reply trigger
   - Deploy to production

2. **Monitor Production Usage**
   - Track campaign executions for 1 week
   - Check for any errors in N8N logs
   - Verify LinkedIn invitations are appearing

### This Month

1. **Implement Timezone/Business Hours Validation**
   - Choose implementation approach (recommend Option B - Hybrid)
   - Create API endpoint: `/api/campaigns/validate-send-time`
   - Add validation nodes to workflow
   - Test across different timezones

2. **Add Message Randomization**
   - Randomize send times within allowed window
   - Prevent spam detection patterns

---

## 📁 Key Files

### Workflows (Ready to Import)

```
✅ n8n-workflows/campaign-execute-complete.json
   → Main campaign workflow (39 nodes)
   → Import to: https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2

✅ /Users/tvonlinz/Downloads/SAM Scheduled Campaign Checker.json
   → Scheduler workflow (7 nodes)
   → Import to: https://innovareai.app.n8n.cloud/workflow/7QJZcRwQBI0wPRS4
```

### Documentation (Read These)

```
📖 N8N_WORKFLOW_TESTING_GUIDE.md
   → Step-by-step testing instructions
   → Start here for testing

📖 N8N_SESSION_SUMMARY_NOV1.md
   → Complete session summary
   → What was accomplished, what's next

📖 N8N_REPLY_STOP_IMPLEMENTATION.md
   → Priority 1: Reply-stop design
   → Ready to implement

📖 N8N_SEND_TIME_REQUIREMENTS.md
   → Priority 2: Timezone validation design
   → Implementation approaches

📖 N8N_STANDARD_FUNNEL.md
   → Standard funnel specification
   → Quick reference
```

### Code Files (Already Updated)

```
✅ app/api/campaigns/linkedin/execute-live/route.ts
   → Updated timing payload (lines 490-499)
   → Sends correct funnel timing to N8N
```

---

## 🧪 Testing Quick Start

### Test Campaign Execution (5 minutes)

```bash
# 1. Get your campaign ID
CAMPAIGN_ID="your-campaign-id-here"
WORKSPACE_ID="your-workspace-id-here"

# 2. Execute with 1 prospect
curl -X POST https://app.meet-sam.com/api/campaigns/linkedin/execute-live \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "'$CAMPAIGN_ID'",
    "workspaceId": "'$WORKSPACE_ID'",
    "maxProspects": 1
  }'

# 3. Check N8N execution
# Go to: https://innovareai.app.n8n.cloud/executions
# Find latest execution of "Campaign Execute - Complete"
# Verify: All nodes green, no errors

# 4. Check database
psql $DATABASE_URL -c "
SELECT
  first_name,
  last_name,
  status,
  contacted_at
FROM campaign_prospects
WHERE campaign_id = '$CAMPAIGN_ID'
ORDER BY contacted_at DESC
LIMIT 1;
"

# Expected: status = 'connection_requested', recent contacted_at
```

---

## 🎨 Workflow Visualizations

### Main Campaign Flow

```
Webhook Trigger
  ↓
Split Prospects → Extract Username → Lookup Profile
  ↓
Personalize CR → Send CR → Extract Message ID → Update Status
  ↓
Wait 6 Hours → Check Connection via Unipile
  ↓
Connection Accepted?
  ├─ YES → Personalize FU1 → Send FU1 → Update FU1 Sent
  │          ↓
  │        Wait 3 Days → FU2 sequence...
  │          ↓
  │        Wait 5 Days → FU3 sequence...
  │          ↓
  │        ... → FU6 sequence → Success
  │
  └─ NO → Mark Not Accepted → End Sequence
```

### Standard Funnel Timeline

```
Day 0 (0h):        CR sent
Day 0 (6h):        Connection check → FU1 sent (if accepted)
Day 3 (6h):        FU2 sent
Day 8 (6h):        FU3 sent
Day 13 (6h):       FU4 sent
Day 18 (6h):       FU5 sent
Day 23 (6h):       FU6 sent (final message)
```

---

## 🔍 What to Watch For

### Good Signs ✅

- N8N executions showing all nodes green
- Prospect status: `connection_requested` → `follow_up_1_sent` → ...
- LinkedIn connection requests appearing in "Sent" list
- Database updates happening at each step
- Connection check correctly detecting acceptance

### Warning Signs ⚠️

- N8N executions stuck at "Wait" nodes indefinitely
- No LinkedIn invitations appearing
- Prospect status stuck at `queued_in_n8n`
- Missing environment variables errors in N8N
- Unipile API errors (401, 403, 500)

### Critical Issues ❌

- Multiple prospects showing `status = 'failed'`
- N8N webhook not triggering (HTTP 404)
- Connection check always failing (always marks as not accepted)
- Database not updating (RLS policy issues?)
- Scheduler not running (check schedule trigger)

---

## 📊 Success Metrics

After testing, you should see:

### Week 1
- [ ] 10+ campaigns executed successfully
- [ ] CR send rate: >95%
- [ ] Connection acceptance detection: >90% accurate
- [ ] FU1 send rate: >80% (of accepted connections)
- [ ] Zero workflow errors

### Month 1
- [ ] 100+ campaigns executed
- [ ] Average sequence completion: >60%
- [ ] Reply-stop mechanism active (no spam reports)
- [ ] Timezone validation working (messages only 8am-6pm local time)
- [ ] LinkedIn limits not exceeded

---

## 🚨 Known Limitations (To Be Fixed)

### Current Limitations

1. **No Reply-Stop (HIGH PRIORITY)**
   - Will send all FU1-6 even if prospect replies
   - Fix: Implement reply-stop mechanism (see Priority 1)

2. **No Timezone Support**
   - All messages send based on UTC time
   - May send at 2am prospect's local time
   - Fix: Implement send-time validation (see Priority 2)

3. **No Weekend/Holiday Blocking**
   - Messages may send on Saturday/Sunday
   - Messages may send on public holidays
   - Fix: Part of send-time validation

4. **No Message Randomization**
   - All messages send at exact intervals (predictable)
   - Risk of spam detection
   - Fix: Add random delay to wait nodes (±30-120 min)

5. **Unipile Relations API Unknown Format**
   - Connection check may fail if Unipile response format changes
   - Need to monitor execution logs for actual response structure
   - Fix: Update parsing logic based on real responses

---

## 💡 Tips for Testing

### Tip 1: Use a Test LinkedIn Account

Don't test on real prospects initially. Use:
- Your own secondary LinkedIn account
- Teammate's LinkedIn account
- Test account created specifically for this

### Tip 2: Manually Advance Wait Nodes

For faster testing:
1. Go to N8N execution
2. Find "Wait 6 Hours for FU1" node
3. Click "Execute Node" to skip wait
4. Verify next steps execute correctly

**Don't use this in production - only for testing!**

### Tip 3: Monitor Database in Real-Time

Keep this query open in a terminal:

```sql
-- Auto-refresh every 5 seconds
watch -n 5 "psql $DATABASE_URL -c \"
SELECT
  first_name || ' ' || last_name as name,
  status,
  contacted_at,
  personalization_data->>'unipile_message_id' as msg_id
FROM campaign_prospects
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
ORDER BY contacted_at DESC
LIMIT 5;
\""
```

### Tip 4: Check Netlify Function Logs

View API execution logs:
- Go to: https://app.netlify.com → Functions → Logs
- Filter by: `execute-live`
- Look for: Successful N8N webhook calls

---

## 🆘 Troubleshooting

### Problem: "Workflow not found"

**Solution:**
1. Verify workflow ID is correct in code
2. Check webhook URL is correct
3. Ensure workflow is active in N8N UI

### Problem: "Missing environment variable"

**Solution:**
1. Go to N8N Settings → Variables
2. Add all required variables from `.env.local`
3. Re-execute workflow

### Problem: "Connection always marked as not accepted"

**Solution:**
1. Check N8N execution logs → "Parse Connection Status" node
2. View actual Unipile API response
3. Verify provider_id format matches what's in relations list
4. May need to adjust parsing logic

### Problem: "Messages not appearing on LinkedIn"

**Solution:**
1. Verify Unipile account is active
2. Check LinkedIn account hasn't hit weekly limit (100 requests)
3. Verify message personalization completed successfully
4. Check Unipile API response for errors

---

## 📞 Support

**Documentation:**
- Session Summary: `N8N_SESSION_SUMMARY_NOV1.md`
- Testing Guide: `N8N_WORKFLOW_TESTING_GUIDE.md`
- Standard Funnel: `N8N_STANDARD_FUNNEL.md`

**N8N Workflows:**
- Main: https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2
- Scheduler: https://innovareai.app.n8n.cloud/workflow/7QJZcRwQBI0wPRS4

**Need Help?**
- Check N8N execution logs first
- Review testing guide for common issues
- Verify all environment variables set
- Test with 1 prospect before scaling

---

## ✅ Pre-Launch Checklist

Before using in production:

- [ ] Both N8N workflows imported and active
- [ ] Environment variables verified in N8N
- [ ] Test campaign executed successfully (1 prospect)
- [ ] LinkedIn connection request appeared
- [ ] Database updated correctly (status progression)
- [ ] 6-hour wait functioned correctly
- [ ] Connection check executed
- [ ] FU1 sent (if connection accepted)
- [ ] Scheduler workflow tested
- [ ] No errors in N8N execution logs

**Once all checked:** ✅ Ready for production use

---

**Status:** Core implementation complete, ready for testing
**Priority:** Test first, then implement reply-stop mechanism
**Timeline:** Test this week → Implement reply-stop next week → Timezone validation later

Good luck with testing! 🚀
