# N8N Dynamic Cadence Implementation Guide

## Overview

This guide explains how to implement dynamic message cadences in N8N workflows, where each follow-up message can have its own custom delay based on user settings.

## Architecture

```
User UI → message_delays[] → Campaign API → N8N Webhook → Dynamic Wait Nodes
```

**Flow:**
1. User selects cadences in UI: `["2-3 days", "5-7 days", "1 week"]`
2. Campaign API converts to N8N timing object: `{fu1_delay_days: 2.5, fu2_delay_days: 6, fu3_delay_days: 7}`
3. N8N receives timing in webhook payload
4. Each Wait node dynamically uses its delay: `{{$json.timing.fu1_delay_days}}`

## Implementation Steps

### 1. Update Campaign Execution Route

```typescript
// app/api/campaigns/linkedin/execute-live/route.ts
import { buildN8NTiming } from '@/lib/utils/cadence-converter';

export async function POST(req: NextRequest) {
  // ... existing code ...

  // Get campaign with message_delays
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*, message_delays')
    .eq('id', campaignId)
    .single();

  // Convert message_delays to N8N timing
  const timing = buildN8NTiming(campaign.message_delays || []);

  // Send to N8N webhook
  const n8nPayload = {
    workspace_id: campaign.workspace_id,
    campaign_id: campaignId,
    prospects: [...],
    messages: {
      cr: campaign.connection_message,
      fu1: campaign.follow_up_1,
      fu2: campaign.follow_up_2,
      // ... more messages
    },
    timing: timing,  // ← Dynamic timing from UI
    template: 'cr_4fu_1gb'
  };

  const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(n8nPayload)
  });

  // ... handle response ...
}
```

### 2. N8N Workflow Configuration

#### Node 1: Webhook (Receives Campaign)
```json
{
  "name": "Campaign Webhook",
  "type": "n8n-nodes-base.webhook",
  "parameters": {
    "path": "campaign-execute",
    "responseMode": "onReceived",
    "options": {}
  }
}
```

#### Node 2: Wait for Follow-Up 1
```json
{
  "name": "Wait for FU1",
  "type": "n8n-nodes-base.wait",
  "parameters": {
    "unit": "days",
    "amount": "={{ $json.timing.fu1_delay_days }}",  // Dynamic!
    "resume": "webhook"
  }
}
```

#### Node 3: Wait for Follow-Up 2
```json
{
  "name": "Wait for FU2",
  "type": "n8n-nodes-base.wait",
  "parameters": {
    "unit": "days",
    "amount": "={{ $json.timing.fu2_delay_days }}",  // Dynamic!
    "resume": "webhook"
  }
}
```

**Key Points:**
- `={{ $json.timing.fu1_delay_days }}` - N8N expression reads from webhook payload
- Wait node automatically pauses execution for that duration
- No external cron needed - N8N handles scheduling internally
- Each message can have different delay

### 3. Testing

#### Test Script

```bash
# scripts/js/test-dynamic-cadence.mjs
import { buildN8NTiming } from '../../lib/utils/cadence-converter.js';

const messageDelays = ['2-3 days', '5-7 days', '1 week', '2 weeks'];
const timing = buildN8NTiming(messageDelays);

console.log('Testing dynamic cadence conversion:');
console.log('Input:', messageDelays);
console.log('Output:', timing);
// Expected: {
//   fu1_delay_days: 2.5,
//   fu2_delay_days: 6,
//   fu3_delay_days: 7,
//   fu4_delay_days: 14
// }

// Test N8N webhook
const payload = {
  workspace_id: 'test',
  campaign_id: 'test',
  prospects: [...],
  messages: {...},
  timing: timing  // ← Dynamic timing
};

const response = await fetch('https://workflows.innovareai.com/webhook/campaign-execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

console.log('N8N Response:', response.status);
```

#### Verify in N8N

1. Go to: https://workflows.innovareai.com/executions
2. Find latest execution
3. Click on "Wait for FU1" node
4. Check "Wait Until" timestamp:
   - Should be ~2.5 days from now (if first delay is "2-3 days")
5. Verify subsequent wait nodes use correct delays

### 4. Database Schema

Ensure `campaigns` table has `message_delays` column:

```sql
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS message_delays TEXT[];

-- Example data:
UPDATE campaigns
SET message_delays = ARRAY['2-3 days', '5-7 days', '1 week', '2 weeks']
WHERE id = 'your-campaign-id';
```

## Advantages of This Approach

✅ **No External Cron**
- N8N handles all scheduling internally
- No need for separate cron jobs or scheduling service

✅ **Truly Dynamic**
- Each campaign can have unique cadences
- Changes take effect immediately on next execution

✅ **Natural Variation**
- Converter adds randomization (e.g., "2-3 days" = random 2.0-3.0 days)
- Avoids LinkedIn bot detection patterns

✅ **User-Friendly**
- UI shows human-readable options ("2-3 days" not "2.5 days")
- Backend converts to precise numeric values

## Testing Checklist

- [ ] Cadence converter works: Run `node scripts/js/test-dynamic-cadence.mjs`
- [ ] N8N receives timing: Check webhook payload in N8N logs
- [ ] Wait nodes use correct delays: Inspect "Wait Until" timestamps
- [ ] Multiple messages work: Test campaign with 4+ follow-ups
- [ ] Campaign execution successful: Verify end-to-end flow

## Troubleshooting

| Issue | Solution |
|-------|----------|
| N8N wait nodes show "undefined days" | Check timing object structure in webhook payload |
| All waits use same delay | Verify fu1, fu2, fu3 keys exist in timing object |
| Wait node errors | Ensure delay value is numeric, not string |
| Campaign doesn't wait | Check N8N workflow has Wait nodes configured |

## Next Steps

1. **Test conversion**: Run test script to verify timing generation
2. **Update N8N workflow**: Import updated workflow with dynamic waits
3. **Test full flow**: Create campaign → Execute → Verify waits in N8N
4. **Monitor first campaign**: Check actual send times match expected cadences

---

**Last Updated:** October 30, 2025
**Status:** Implementation Ready
