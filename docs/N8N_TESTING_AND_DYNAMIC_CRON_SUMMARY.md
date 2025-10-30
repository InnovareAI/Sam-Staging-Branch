# N8N Testing & Dynamic Cron Implementation Summary

## Quick Answer to Your Questions

### Q1: How do we test N8N?

**3 Ways to Test N8N:**

1. **Direct Webhook Test** (Fastest)
   ```bash
   node scripts/js/test-webhook-direct.mjs
   # Then check: https://workflows.innovareai.com/executions
   ```

2. **Test Dynamic Cadence Conversion** (New!)
   ```bash
   node scripts/js/test-dynamic-cadence.mjs
   # Shows timing calculations and N8N payload
   ```

3. **Full Campaign Execution Test** (End-to-End)
   ```bash
   # Via API
   curl -X POST http://localhost:3000/api/campaigns/linkedin/execute-live \
     -H "Content-Type: application/json" \
     -d '{"campaignId": "ID", "maxProspects": 1, "dryRun": true}'

   # Then verify in N8N
   # Go to: https://workflows.innovareai.com/executions
   ```

### Q2: Can cron be done dynamically based on cadence?

**Yes! But you don't need cron at all.**

**Why?** N8N has built-in **dynamic Wait nodes** that can schedule follow-ups based on your message_delays array.

**How it works:**
```
UI Cadence Selector → message_delays[] → Convert to N8N timing → Wait nodes schedule automatically
```

**Example:**
- User selects: `["2-3 days", "5-7 days", "1 week"]`
- Converts to: `{fu1_delay_days: 2.5, fu2_delay_days: 6, fu3_delay_days: 7}`
- N8N Wait node reads: `={{$json.timing.fu1_delay_days}}` = 2.5 days
- Execution pauses for 2.5 days, then resumes automatically

**No external cron needed!** N8N manages all scheduling internally.

---

## What We Built

### 1. Cadence Conversion Utility
**File:** `/lib/utils/cadence-converter.ts`

Converts UI-friendly cadence strings to numeric delays:
- `"2-3 days"` → `2.5 days` (average)
- `"1 week"` → `7 days`
- Includes min/max for randomization (anti-bot detection)

### 2. Test Script
**File:** `/scripts/js/test-dynamic-cadence.mjs`

Tests:
- ✅ Single cadence conversion
- ✅ Array → N8N timing object
- ✅ Full webhook payload generation
- ✅ Expected send time calculations
- ✅ (Optional) Live N8N webhook test

### 3. Implementation Guide
**File:** `/docs/N8N_DYNAMIC_CADENCE_GUIDE.md`

Complete guide with:
- Architecture overview
- Code examples
- N8N workflow configuration
- Testing checklist
- Troubleshooting

---

## Test Results

Running `node scripts/js/test-dynamic-cadence.mjs` shows:

```
Input (from UI):
  ["2-3 days", "5-7 days", "1 week", "2 weeks"]

Output (for N8N):
  {
    "fu1_delay_days": 2.5,
    "fu2_delay_days": 6,
    "fu3_delay_days": 7,
    "fu4_delay_days": 14
  }

Expected message send times:
  Connection Request: Oct 30, 2025, 12:06 PM (now)
  Follow-up 1: Nov 2, 2025, 12:06 AM (+2.5 days)
  Follow-up 2: Nov 8, 2025, 12:06 AM (+6 days)
  Follow-up 3: Nov 15, 2025, 12:06 AM (+7 days)
  Follow-up 4: Nov 29, 2025, 12:06 AM (+14 days)
```

---

## Next Steps to Implement

### Step 1: Database Update (Optional)

If not already done, add `message_delays` column:
```sql
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS message_delays TEXT[];
```

### Step 2: Update Campaign Execution Route

Add to `/app/api/campaigns/linkedin/execute-live/route.ts`:

```typescript
import { buildN8NTiming } from '@/lib/utils/cadence-converter';

// Inside POST function, after getting campaign:
const timing = buildN8NTiming(campaign.message_delays || ['2-3 days']);

// Include in N8N webhook payload:
const n8nPayload = {
  workspace_id: campaign.workspace_id,
  campaign_id: campaignId,
  prospects: executableProspects,
  messages: {
    cr: campaign.connection_message,
    fu1: campaign.follow_up_1,
    // ... other messages
  },
  timing: timing  // ← Add this
};
```

### Step 3: Update N8N Workflow

In your N8N workflow, update Wait nodes:

**Before (hardcoded):**
```json
{
  "name": "Wait for FU1",
  "parameters": {
    "unit": "days",
    "amount": 2  // ← Fixed delay
  }
}
```

**After (dynamic):**
```json
{
  "name": "Wait for FU1",
  "parameters": {
    "unit": "days",
    "amount": "={{ $json.timing.fu1_delay_days }}"  // ← Dynamic!
  }
}
```

### Step 4: Test End-to-End

1. Create campaign with custom cadences in UI
2. Execute campaign (dry run)
3. Check N8N executions → Verify "Wait Until" timestamps
4. Run live with 1 prospect
5. Monitor actual send times

---

## Why This Approach is Better Than Cron

| Feature | External Cron | N8N Dynamic Waits |
|---------|---------------|-------------------|
| Setup complexity | High (separate scheduler) | Low (built into workflow) |
| Dynamic per-campaign | Hard (requires DB + scheduler) | Easy (just pass timing) |
| Scaling | Limited (cron job limits) | Unlimited (N8N handles) |
| Monitoring | Separate tools | Built into N8N UI |
| Error handling | Manual retry logic | N8N automatic retries |
| Cost | Extra service | Included in N8N |

---

## Troubleshooting

### Test script shows errors
```bash
# Ensure you're in project directory
pwd  # Should show: .../Sam-New-Sep-7

# Run test again
node scripts/js/test-dynamic-cadence.mjs
```

### N8N doesn't receive timing
```bash
# Check N8N webhook payload in execution logs
# Go to: https://workflows.innovareai.com/executions
# Click execution → View "Webhook" node → Check input data
# Should see: { timing: { fu1_delay_days: 2.5, ... } }
```

### Wait nodes use wrong delays
```bash
# Verify N8N expression syntax:
# Must be: ={{ $json.timing.fu1_delay_days }}
# NOT: {{ timing.fu1_delay_days }} (missing $json)
```

---

## Files Created/Modified

**New Files:**
- ✅ `/lib/utils/cadence-converter.ts` - Conversion utility
- ✅ `/scripts/js/test-dynamic-cadence.mjs` - Test script
- ✅ `/docs/N8N_DYNAMIC_CADENCE_GUIDE.md` - Implementation guide
- ✅ `/docs/N8N_TESTING_AND_DYNAMIC_CRON_SUMMARY.md` - This file

**Files to Modify:**
- ⚠️ `/app/api/campaigns/linkedin/execute-live/route.ts` - Add timing conversion
- ⚠️ N8N workflow JSON - Update Wait nodes to use dynamic delays

---

## Quick Start

```bash
# 1. Test cadence conversion
node scripts/js/test-dynamic-cadence.mjs

# 2. Test N8N webhook (uncomment test code first)
# Edit: scripts/js/test-dynamic-cadence.mjs
# Uncomment the N8N webhook test section
# Run again

# 3. Test existing N8N workflows
node scripts/js/test-webhook-direct.mjs
node scripts/js/list-n8n-workflows.mjs
node scripts/js/get-latest-n8n-execution.mjs

# 4. Check N8N health
# Open: https://workflows.innovareai.com
# Login and verify workflows are active
```

---

**Last Updated:** October 30, 2025
**Status:** Ready for Implementation
**Effort:** ~1 hour (including testing)

**Key Takeaway:** You don't need external cron - N8N Wait nodes handle everything dynamically based on your UI cadence settings!
