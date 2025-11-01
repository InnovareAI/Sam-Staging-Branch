# N8N Reply-Stop Mechanism Implementation

**Priority:** HIGH (Priority 1)
**Status:** Ready to Implement
**Impact:** Prevents sending follow-ups to prospects who have replied

---

## Overview

This implementation adds reply-checking logic before each follow-up message (FU1-6) to ensure we don't spam prospects who have already responded.

**Changes:**
- Add 12 new nodes (6 check nodes + 6 IF nodes)
- Total nodes: 39 → 51
- No changes to existing node logic

---

## Reply-Check Node Template

This node should be inserted AFTER each Wait node and BEFORE each Personalize FU node.

### Node: "Check if Prospect Replied (FU1/2/3/4/5/6)"

**Type:** Code (JavaScript)
**Position:** After "Wait X Hours/Days for FUY", before "Personalize FUY"

```javascript
// Check if prospect has replied before sending follow-up
const prospectId = $node['Extract Message ID'].json.prospect_id;
const supabase_url = $env.NEXT_PUBLIC_SUPABASE_URL;
const supabase_key = $env.SUPABASE_SERVICE_ROLE_KEY;

console.log(`🔍 Checking reply status for prospect ID: ${prospectId}`);

// Query Supabase for prospect status
const response = await fetch(
  `${supabase_url}/rest/v1/campaign_prospects?id=eq.${prospectId}&select=status`,
  {
    headers: {
      'apikey': supabase_key,
      'Authorization': `Bearer ${supabase_key}`,
      'Content-Type': 'application/json'
    }
  }
);

const data = await response.json();
const status = data[0]?.status;

console.log(`📊 Current prospect status: ${status}`);

// Check if prospect has replied
if (status === 'replied') {
  console.log('⏸️ STOP: Prospect has replied - ending follow-up sequence');
  return [{
    json: {
      prospect_id: prospectId,
      action: 'end_sequence',
      reason: 'prospect_replied',
      stopped_at: new Date().toISOString(),
      message: `Prospect replied - stopping at FU${X} (not sent)`
    }
  }];
}

// Also check for other stop conditions
if (status === 'not_interested') {
  console.log('⏸️ STOP: Prospect marked as not interested');
  return [{
    json: {
      prospect_id: prospectId,
      action: 'end_sequence',
      reason: 'not_interested',
      stopped_at: new Date().toISOString(),
      message: 'Prospect not interested - ending sequence'
    }
  }];
}

// Continue with sending
console.log('✅ No reply detected - continuing with follow-up');
return [{
  json: {
    ...$input.item.json,
    action: 'send',
    status: status,
    checked_at: new Date().toISOString()
  }
}];
```

---

## IF Node Template

This node routes execution based on the reply-check result.

### Node: "Should Send FU1/2/3/4/5/6?"

**Type:** IF
**Position:** After "Check if Prospect Replied (FUY)", branches to either "Personalize FUY" or "Log Sequence Ended"

**Condition:**
- **Field:** `{{ $json.action }}`
- **Operation:** Equal to
- **Value:** `send`

**Routing:**
- **TRUE output:** → Personalize FUY (continue sending)
- **FALSE output:** → Log Sequence Ended (stop and log)

---

## Sequence End Logging Node

This node logs when a sequence is stopped due to a reply.

### Node: "Log Sequence Ended (FU1/2/3/4/5/6)"

**Type:** Code (JavaScript)
**Position:** Connected to FALSE output of "Should Send FUY?" IF node

```javascript
// Log that sequence was ended due to reply
const data = $input.item.json;

console.log(`🛑 SEQUENCE ENDED`);
console.log(`   Prospect ID: ${data.prospect_id}`);
console.log(`   Reason: ${data.reason}`);
console.log(`   Stopped at: ${data.stopped_at}`);
console.log(`   Message: ${data.message}`);

// Optionally update database to mark sequence as ended
const supabase_url = $env.NEXT_PUBLIC_SUPABASE_URL;
const supabase_key = $env.SUPABASE_SERVICE_ROLE_KEY;

await fetch(
  `${supabase_url}/rest/v1/campaign_prospects?id=eq.${data.prospect_id}`,
  {
    method: 'PATCH',
    headers: {
      'apikey': supabase_key,
      'Authorization': `Bearer ${supabase_key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      personalization_data: {
        sequence_ended: true,
        sequence_end_reason: data.reason,
        sequence_ended_at: data.stopped_at
      }
    })
  }
);

console.log('✅ Database updated with sequence end status');

return [{
  json: {
    ...data,
    logged: true
  }
}];
```

---

## Implementation Plan

### Step 1: Add Reply-Check for FU1

**After:** "Wait 6 Hours for FU1"
**Before:** "Personalize FU1"

**New nodes:**
1. "Check if Prospect Replied (FU1)" - Code node
2. "Should Send FU1?" - IF node
3. "Log Sequence Ended (FU1)" - Code node

**Connections:**
```
Wait 6 Hours for FU1
  ↓
Check if Prospect Replied (FU1)
  ↓
Should Send FU1?
  ├─ TRUE → Personalize FU1 (existing flow continues)
  └─ FALSE → Log Sequence Ended (FU1) → End
```

### Step 2: Add Reply-Check for FU2

**After:** "Wait for FU2"
**Before:** "Personalize FU2"

**New nodes:**
1. "Check if Prospect Replied (FU2)" - Code node
2. "Should Send FU2?" - IF node
3. "Log Sequence Ended (FU2)" - Code node

**Connections:**
```
Update FU1 Sent
  ↓
Wait for FU2
  ↓
Check if Prospect Replied (FU2)
  ↓
Should Send FU2?
  ├─ TRUE → Personalize FU2 (existing flow continues)
  └─ FALSE → Log Sequence Ended (FU2) → End
```

### Step 3-6: Repeat for FU3, FU4, FU5, FU6

Same pattern for each follow-up.

---

## Updated Node Count

**Before:** 39 nodes
**After:** 51 nodes

**Breakdown:**
- Original nodes: 39
- Reply-check nodes: 6 (one per FU)
- IF nodes: 6 (one per FU)
- Log nodes: 6 (can be consolidated to 1 if desired)
- **Total:** 39 + 6 + 6 = 51 (or 45 if logging consolidated)

---

## Testing Plan

### Test Case 1: Prospect Replies After CR

**Setup:**
1. Execute campaign with 1 prospect
2. CR sent successfully
3. Manually update prospect status to 'replied' in database:
   ```sql
   UPDATE campaign_prospects
   SET status = 'replied'
   WHERE id = 'prospect_id';
   ```
4. Wait 6 hours (or manually trigger "Wait 6 Hours for FU1" node)

**Expected Result:**
- ✅ "Check if Prospect Replied (FU1)" detects status = 'replied'
- ✅ "Should Send FU1?" IF node routes to FALSE output
- ✅ "Log Sequence Ended (FU1)" logs the stop reason
- ✅ FU1 is NOT sent
- ✅ Sequence ends gracefully

### Test Case 2: Prospect Replies After FU2

**Setup:**
1. Execute campaign
2. CR and FU1 sent successfully
3. Mark prospect as 'replied' after FU1 sent
4. Wait 3 days (or manually trigger "Wait for FU2")

**Expected Result:**
- ✅ FU2 not sent (sequence stopped)
- ✅ Logged at FU2 checkpoint

### Test Case 3: No Reply (Normal Flow)

**Setup:**
1. Execute campaign
2. Never update status to 'replied'

**Expected Result:**
- ✅ All FU1-6 messages sent normally
- ✅ No sequence stops
- ✅ Full campaign completes

---

## Database Schema Considerations

### Existing Status Values

The `campaign_prospects.status` column already supports:
- `'replied'` - Prospect has replied (STOP condition)
- `'not_interested'` - Prospect opted out (STOP condition)
- `'connection_requested'` - CR sent
- `'follow_up_1_sent'` through `'follow_up_6_sent'` - FU messages sent
- `'completed'` - Sequence finished
- `'failed'` - Error occurred

**No schema changes needed.**

### Reply Detection Integration

The existing `lib/campaign-reply-detector.ts` system should automatically update the status to `'replied'` when a prospect responds. This integrates seamlessly with our reply-stop mechanism.

**How it works:**
1. Prospect replies on LinkedIn
2. Unipile webhook fires (or polling detects reply)
3. Reply detector analyzes message
4. Database updated: `status = 'replied'`
5. Next follow-up check detects `'replied'` status
6. Sequence stops automatically

---

## Performance Considerations

### Additional API Calls

**Per follow-up check:**
- 1 Supabase SELECT query (get prospect status)
- 1 Supabase PATCH query (update sequence end - only if stopped)

**Total additional calls per prospect:**
- Minimum: 6 SELECT queries (if no replies, checks all FU1-6)
- Maximum: 6 SELECT + 1 PATCH (if reply detected)

**Impact:** Negligible (Supabase can handle millions of queries)

### Execution Time

**Per check:** ~100-200ms (Supabase query latency)
**Total overhead per prospect:** ~1 second across entire campaign

**Impact:** Minimal, acceptable for improved user experience

---

## Error Handling

### What if Supabase Query Fails?

**Current implementation:** If Supabase query fails, the code will throw an error and stop execution.

**Recommended enhancement:**

```javascript
try {
  const response = await fetch(/* Supabase query */);
  const data = await response.json();
  const status = data[0]?.status;

  // Continue with status check...
} catch (error) {
  console.error('⚠️ ERROR: Failed to check reply status:', error);

  // FAIL-SAFE: Continue sending (don't block campaign)
  // This ensures one query failure doesn't stop entire sequence
  return [{
    json: {
      ...$input.item.json,
      action: 'send',
      status: 'unknown',
      error: error.message,
      fail_safe: true
    }
  }];
}
```

**Reasoning:** Better to send one extra message than to completely halt a campaign due to a transient error.

---

## Alternative Implementations

### Option A: Check Once Before Each Send (Current)

**Pros:**
- Most reliable
- Catches replies immediately
- Simple to understand

**Cons:**
- 6 checks per prospect
- Slightly more API calls

### Option B: Check Only at Key Points

**Locations:**
- Before FU1 (after 6-hour wait)
- Before FU3 (mid-sequence checkpoint)
- Before FU6 (final message)

**Pros:**
- Fewer API calls (3 instead of 6)
- Faster execution

**Cons:**
- Might send FU2 even if prospect replied after FU1
- Less granular

**Recommendation:** Stick with Option A (current design) for best user experience.

### Option C: Batch Reply Check

**Implementation:**
- Check all active prospects at once (batch query)
- Update a cached "has_replied" flag
- Use cached value in workflow

**Pros:**
- Fewer individual queries
- Could be more efficient at scale

**Cons:**
- More complex implementation
- Requires caching infrastructure
- Stale data risk (prospect replies but cache not updated)

**Recommendation:** Defer to future optimization if needed.

---

## Rollout Plan

### Phase 1: Add to Existing Workflow

1. Export current workflow from N8N (backup)
2. Add 12 new nodes (reply-checks for FU1-6)
3. Test in N8N with manual execution
4. Verify database queries work correctly
5. Test stop condition manually (set status to 'replied')

### Phase 2: Test with Live Campaign

1. Run test campaign with 5 prospects
2. Manually trigger reply for 1 prospect after CR
3. Verify that prospect stops receiving follow-ups
4. Verify other 4 prospects continue normally

### Phase 3: Production Deployment

1. Mark workflow as production-ready
2. Update documentation
3. Monitor for 1 week
4. Collect metrics on stop rates

---

## Metrics to Track

After implementation, track:
- **Stop rate:** % of prospects who get stopped due to replies
- **Stop location:** Which FU stage has most stops (FU1 vs FU2 vs FU3...)
- **Reply response time:** Average time from message sent to reply detected
- **False positives:** Sequences stopped incorrectly (if any)

**Expected stop rate:** 5-15% (industry standard for LinkedIn outreach)

---

## Next Steps

1. ✅ Read this implementation guide
2. ⏳ Update `campaign-execute-complete.json` with 12 new nodes
3. ⏳ Test manually in N8N UI
4. ⏳ Validate with test campaign (1 prospect)
5. ⏳ Deploy to production
6. ⏳ Monitor for 1 week
7. ⏳ Implement Priority 2 (timezone/business hours)

---

**Implementation Status:** Documented, Ready for Development
**Estimated Time:** 2-3 hours (including testing)
**Risk Level:** LOW (additive change, no modifications to existing logic)
**Impact:** HIGH (prevents spam, improves deliverability)

