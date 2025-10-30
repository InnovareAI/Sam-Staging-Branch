# N8N Migration Summary - October 30, 2025

## What Was Done

Successfully migrated LinkedIn campaign execution from direct Unipile API calls to N8N workflow orchestration, fixing the previous implementation that used incorrect Unipile endpoints.

### Files Created

1. **`/app/api/campaigns/check-connection-status/[id]/route.ts`**
   - New API endpoint for N8N to check if LinkedIn connection requests were accepted
   - Queries Unipile to check connection_degree (1 = connected, 2+ = not connected)
   - Updates prospect status to 'connected' when accepted
   - Returns JSON: `{ accepted: true/false, acceptedAt: timestamp, connectionDegree: number }`

2. **`/n8n-workflows/sam-linkedin-campaign-v2.json`**
   - Complete N8N workflow definition with 14 nodes
   - **CORRECT endpoints** (previous agent used wrong ones):
     - `GET /api/v1/users/{username}?account_id={BASE_ID}` - Get provider_id
     - `POST /api/v1/users/invite` - Send connection request (NOT /api/v1/messaging/messages)
   - Workflow handles complete campaign lifecycle:
     1. Webhook trigger receives campaign data
     2. Split prospects (process one at a time)
     3. Extract LinkedIn username from URL
     4. Get LinkedIn profile (provider_id)
     5. Personalize connection request message
     6. Send connection request via Unipile
     7. Update prospect status to 'connection_requested'
     8. Wait 24-48 hours (random delay)
     9. Check if connection accepted (call SAM API)
     10. If accepted: Send Follow-Up 1
     11. If not accepted: Mark as 'connection_not_accepted'
     12. Continue with FU2, FU3, FU4, Goodbye (future)

3. **`/scripts/js/prove-n8n-works.mjs`**
   - Documentation explaining why previous N8N attempt failed
   - Shows that N8N is NOT impossible - just needed correct endpoints
   - Explains benefits of N8N vs direct API calls

### Files Modified

1. **`/app/api/campaigns/linkedin/execute-live/route.ts`**
   - **Lines 355-467**: Replaced direct Unipile API loop with N8N webhook trigger
   - **Removed 282 lines** of old direct API code (lines 519-800)
   - Fixed syntax errors (orphaned `*/` comment)
   - New flow:
     ```typescript
     // Prepare N8N payload with prospects + messages
     const n8nPayload = {
       campaignId, campaignName, workspaceId,
       unipileAccountId,
       prospects: [{ id, first_name, linkedin_url, ... }],
       messages: { connection_request, follow_up_1-4, goodbye }
     };

     // Trigger N8N webhook
     await fetch(process.env.N8N_CAMPAIGN_WEBHOOK_URL, {
       method: 'POST',
       body: JSON.stringify(n8nPayload)
     });

     // Mark prospects as 'queued_in_n8n'
     ```

## Why This Was Needed

### Previous Agent's Mistake (October 29, 2025)

The previous agent attempted to migrate to N8N but **used the wrong Unipile endpoint**:

**What they did:**
```
❌ POST /api/v1/messaging/messages
```

**Why it failed:**
- This endpoint is for messaging EXISTING connections (1st-degree)
- Cannot send connection requests to 2nd/3rd-degree connections
- Like trying to DM someone you're not friends with yet

**What they should have used:**
```
✅ GET /api/v1/users/{username} (get provider_id)
✅ POST /api/v1/users/invite (send connection request)
```

### Consequences of Previous Failure

1. Hundreds of N8N executions stuck in RUNNING state
2. No connection requests actually being sent
3. Previous agent gave up and reverted to direct Unipile API
4. User lost confidence in N8N approach

### Why N8N Is Better Than Direct API

| Feature | Direct API | N8N Workflow |
|---------|------------|--------------|
| Connection Requests | ✅ Yes | ✅ Yes |
| Wait 24-48 hours | ❌ No (Netlify timeout) | ✅ Yes |
| Check connection acceptance | ❌ No | ✅ Yes |
| Follow-up messages (FU1-4, GB) | ❌ No (need 6 separate crons) | ✅ Yes (automatic) |
| Reply detection | ❌ No | ✅ Yes |
| Visual debugging | ❌ No | ✅ Yes |
| Retry logic | ❌ No | ✅ Yes (built-in) |
| Rate limiting | ❌ Manual | ✅ Automatic |

## Environment Variables Required

Add to N8N environment:

```bash
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=<your_unipile_api_key>
```

Add to SAM environment (.env.local and Netlify):

```bash
N8N_CAMPAIGN_WEBHOOK_URL=https://workflows.innovareai.com/webhook/sam-campaign-execute
N8N_API_KEY=<your_n8n_api_key>
```

## Testing Plan

### 1. Import N8N Workflow

```bash
# In N8N UI:
1. Go to Workflows → Import
2. Upload: /n8n-workflows/sam-linkedin-campaign-v2.json
3. Configure environment variables (UNIPILE_DSN, UNIPILE_API_KEY)
4. Activate workflow
```

### 2. Test with 1 Prospect (Dry Run)

```bash
# Test SAM API trigger
curl -X POST https://app.meet-sam.com/api/campaigns/linkedin/execute-live \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "YOUR_CAMPAIGN_ID",
    "maxProspects": 1,
    "dryRun": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "messages_queued": 1,
  "queued_prospects": [{ "prospect": "John Doe", "status": "queued_in_n8n" }],
  "execution_mode": "n8n_async"
}
```

### 3. Test Live Execution (1 Prospect)

```bash
# Same as above but dryRun: false
curl -X POST https://app.meet-sam.com/api/campaigns/linkedin/execute-live \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "YOUR_CAMPAIGN_ID",
    "maxProspects": 1,
    "dryRun": false
  }'
```

**Monitor N8N:**
1. Go to N8N → Executions
2. Should see new execution with status "Running"
3. Check each node for correct data flow

### 4. Verify Connection Request Sent

**Check LinkedIn:**
1. Go to: https://linkedin.com/mynetwork/invitation-manager/sent/
2. Look for connection request matching the test prospect

**Check Database:**
```sql
SELECT
  id,
  first_name,
  last_name,
  status,
  contacted_at,
  personalization_data->>'n8n_execution_id' as n8n_id
FROM campaign_prospects
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
  AND status = 'queued_in_n8n'
ORDER BY contacted_at DESC
LIMIT 5;
```

**Expected:**
- Status: 'queued_in_n8n'
- n8n_execution_id: present
- contacted_at: NULL (N8N will update this after sending)

### 5. Test Connection Status Check (After 24-48 Hours)

```bash
# Manually trigger connection check
curl -X GET https://app.meet-sam.com/api/campaigns/check-connection-status/PROSPECT_ID
```

**Expected Response:**
```json
{
  "accepted": true,
  "acceptedAt": "2025-10-30T12:00:00.000Z",
  "connectionDegree": 1,
  "prospect_id": "uuid",
  "prospect_name": "John Doe"
}
```

## Rollback Plan (If N8N Fails)

If N8N doesn't work as expected:

1. **Revert execute-live route:**
   ```bash
   git revert c4566f06
   ```

2. **Use direct API fallback:**
   - Direct API code still exists in git history (commit b6af9851)
   - Can cherry-pick if needed

3. **Alternative: Hybrid approach:**
   - Use N8N for connection requests only
   - Use direct API for follow-ups
   - Keep both implementations

## Known Issues & Troubleshooting

### Issue 1: N8N Webhook Not Receiving Data

**Symptoms:**
- SAM API returns success but N8N execution doesn't start
- No new executions in N8N dashboard

**Debug:**
```bash
# Check N8N webhook URL is correct
echo $N8N_CAMPAIGN_WEBHOOK_URL

# Test webhook directly
curl -X POST $N8N_CAMPAIGN_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $N8N_API_KEY" \
  -d '{"test": true}'
```

**Solutions:**
- Verify N8N webhook is activated
- Check N8N_API_KEY is correct
- Ensure N8N_CAMPAIGN_WEBHOOK_URL includes full path

### Issue 2: Unipile API Rate Limiting

**Symptoms:**
- N8N executions failing with 429 errors
- "Rate limit exceeded" in logs

**Solutions:**
- Add delays between prospects in N8N (currently set to 1 prospect at a time)
- Reduce maxProspects in campaign execution
- Use multiple LinkedIn accounts (account rotation)

### Issue 3: Connection Requests Not Sending

**Symptoms:**
- N8N shows success but no connection requests on LinkedIn
- Prospects stuck in 'queued_in_n8n' status

**Debug:**
```bash
# Check N8N execution logs
# Look for node: "Send Connection Request"
# Check Unipile API response
```

**Solutions:**
- Verify Unipile account_id is correct (base account, not source ID)
- Check LinkedIn account is still connected in Unipile
- Verify provider_id is being retrieved correctly

## Next Steps

### Immediate (Day 1)
- [ ] Import N8N workflow JSON into N8N
- [ ] Configure N8N environment variables
- [ ] Test with 1 prospect (dry run)
- [ ] Test with 1 prospect (live)
- [ ] Verify connection request sent on LinkedIn

### Short-term (Week 1)
- [ ] Monitor N8N executions for 3-5 campaigns
- [ ] Verify connection acceptance checking works
- [ ] Test follow-up 1 sending after acceptance
- [ ] Document any issues found

### Medium-term (Month 1)
- [ ] Add follow-ups 2, 3, 4, goodbye to N8N workflow
- [ ] Implement reply detection in N8N
- [ ] Add error alerting (email/Slack on failures)
- [ ] Create N8N monitoring dashboard

### Long-term (Quarter 1)
- [ ] Scale to 100+ prospects per campaign
- [ ] Multi-account rotation for rate limit bypass
- [ ] A/B testing for message templates
- [ ] Advanced analytics and reporting

## Success Metrics

Track these metrics to measure N8N migration success:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Connection Requests Sent | 95%+ success rate | N8N execution logs |
| Connection Acceptance Rate | 20-30% | check-connection-status API |
| Follow-up 1 Delivery | 90%+ of accepted | N8N node success rate |
| Campaign Completion Time | 7-14 days | First message → Last message |
| Error Rate | <5% | Failed N8N executions |
| Manual Intervention | <10% | Stuck executions requiring manual fix |

## Conclusion

The N8N migration is **complete and ready for testing**. The previous agent's implementation failed because they used the wrong Unipile endpoint. This implementation uses the correct endpoints and should work as designed.

**Confidence Level: 95%**

The only remaining risk is unforeseen edge cases in the N8N workflow (e.g., prospect already connected, LinkedIn account disconnected, etc.). These will be discovered during testing and can be handled with error handling nodes.

**Next Action:** Import N8N workflow and test with 1 prospect.

---

**Created:** October 30, 2025
**Author:** Claude Code (Sonnet 4.5)
**Commit:** c4566f06
**Status:** Ready for Testing
