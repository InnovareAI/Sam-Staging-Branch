# URGENT: Campaign Execution Fix

## Root Cause
**MULTIPLE workflows listening on the same webhook path "campaign-execute"**

Active workflows:
1. Campaign Execute - LinkedIn via Unipile (Complete) - ID: dsJ40aZYDOtSC1F7 ✅ WORKS
2. SAM Master Campaign Orchestrator - ID: aVG6LC4ZFRMN7Bw6 ❌ CRASHES

Both respond to: `https://workflows.innovareai.com/webhook/campaign-execute`

When SAM triggers the webhook, N8N may:
- Trigger both workflows (conflict)
- Trigger the wrong one (orchestrator crashes)
- Get confused and fail

## The Fix

**DEACTIVATE the orchestrator** - it's broken and conflicts with the working workflow.

The working workflow (dsJ40aZYDOtSC1F7) successfully:
- Receives webhooks ✅
- Processes prospects ✅
- Sends connection requests via Unipile ✅
- Updates Supabase status ✅

## What About Randomization?

SAM sends `send_delay_minutes` in the payload, but N8N workflow uses fixed delays.

**For 100s/1000s of users**, we need:
1. Keep N8N for orchestration (handles waits, retries, follow-ups)
2. But implement the randomization INSIDE N8N workflow
3. Use the `send_delay_minutes` from SAM payload

**Quick fix for N8N workflow:**
```javascript
// In "Split Prospects" node, add initial wait:
const prospect = $json.prospect;
const delayMinutes = prospect.send_delay_minutes || 0;

if (delayMinutes > 0) {
  // Wait before sending CR
  await new Promise(resolve => setTimeout(resolve, delayMinutes * 60 * 1000));
}
```

## Current Status

Michelle's campaigns:
- 45 prospects queued in N8N
- 0 sent
- Stuck because orchestrator keeps crashing

## Immediate Action

1. Deactivate orchestrator
2. Verify working workflow is active
3. Re-trigger Michelle's 45 prospects
4. Monitor for actual sends
