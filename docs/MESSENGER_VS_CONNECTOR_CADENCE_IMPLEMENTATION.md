# Messenger vs Connector Campaign Cadence Implementation

## Overview

Both **Messenger** and **Connector** campaigns now support dynamic per-message cadences. The key difference is that Messenger campaigns skip the Connection Request (CR) since they're for 1st degree connections who are already connected.

## Campaign Type Comparison

### Connector Campaign (2nd/3rd Degree Connections)

**Message Sequence:**
1. **Connection Request** (CR) - sent immediately
2. Wait for connection acceptance
3. **Follow-up 1** - wait X days after acceptance
4. **Follow-up 2** - wait Y days
5. **Follow-up 3** - wait Z days
6. **Follow-up 4** - wait A days
7. **Follow-up 5** (Goodbye) - wait B days

**Total:** 1 CR + 5 follow-ups = 6-step sequence

### Messenger Campaign (1st Degree Connections)

**Message Sequence:**
1. **Initial Message** - sent immediately (no CR needed)
2. **Follow-up 1** - wait X days
3. **Follow-up 2** - wait Y days
4. **Follow-up 3** - wait Z days
5. **Follow-up 4** - wait A days
6. **Follow-up 5** (Goodbye) - wait B days

**Total:** 1 initial + 5 follow-ups = 6-step sequence

## Key Differences

| Feature | Connector | Messenger |
|---------|-----------|-----------|
| **First Message** | Connection Request (CR) | Initial Message (no CR) |
| **Connection Check** | Yes (waits for acceptance) | No (already connected) |
| **Follow-up Timing** | After acceptance | After initial message |
| **LinkedIn ID** | Optional (uses public URL) | Required (internal ID) |
| **Target Audience** | 2nd/3rd degree | 1st degree only |

## UI Implementation

### Connector Campaign - Step 3

```jsx
{/* Connection Request - no delay selector (sent immediately) */}
<Textarea
  id="connection-message"
  value={connectionMessage}
  placeholder="Hi {first_name}, I'd like to connect..."
/>

{/* Follow-up Messages - each with timing selector */}
{followUpMessages.map((message, index) => (
  <div key={index}>
    {/* Delay selector BEFORE message */}
    <div className="timing-selector">
      <Clock size={16} />
      <select value={(campaignSettings.message_delays || [])[index] || '2-3 days'}
              onChange={(e) => updateMessageDelay(index, e.target.value)}>
        <option value="1 day">1 day</option>
        <option value="2-3 days">2-3 days</option>
        <option value="3-5 days">3-5 days</option>
        <option value="5-7 days">5-7 days</option>
        <option value="1 week">1 week</option>
        <option value="2 weeks">2 weeks</option>
      </select>
    </div>
    {/* Message textarea */}
    <Textarea value={message} />
  </div>
))}
```

### Messenger Campaign - Step 3

```jsx
{/* Initial Message - no delay selector (sent immediately) */}
<Textarea
  id="messenger-initial-message"
  value={alternativeMessage}
  placeholder="Hi {first_name}, I wanted to reach out..."
/>

{/* Follow-up Messages - IDENTICAL to Connector */}
{followUpMessages.map((message, index) => (
  <div key={index}>
    {/* Same timing selector as Connector */}
    <div className="timing-selector">
      <Clock size={16} />
      <select value={(campaignSettings.message_delays || [])[index] || '2-3 days'}
              onChange={(e) => updateMessageDelay(index, e.target.value)}>
        {/* Same options as Connector */}
      </select>
    </div>
    <Textarea value={message} />
  </div>
))}
```

## Data Flow

### 1. UI State Management

```typescript
// Shared state for both campaign types
const [campaignSettings, setCampaignSettings] = useState({
  connection_request_delay: '1-3 hours',  // Only used for Connector
  follow_up_delay: '2-3 days',             // Deprecated
  message_delays: ['2-3 days', '3-5 days', '5-7 days', '1 week', '2 weeks']
});

// Update delay for specific message (works for both types)
const updateMessageDelay = (index: number, delay: string) => {
  const newDelays = [...(campaignSettings.message_delays || [])];
  newDelays[index] = delay;
  setCampaignSettings({...campaignSettings, message_delays: newDelays});
};
```

### 2. Campaign Creation Payload

```javascript
// Both campaign types include message_delays
const campaignData = {
  name: name,
  campaignType: campaignType,  // 'connector' or 'messenger'
  prospects: prospects,
  messages: {
    connection_request: connectionMessage,    // Empty for Messenger
    follow_up_1: followUpMessages[0],
    follow_up_2: followUpMessages[1],
    follow_up_3: followUpMessages[2],
    follow_up_4: followUpMessages[3],
    follow_up_5: followUpMessages[4]
  },
  message_delays: campaignSettings.message_delays,  // ← Same for both
  _executionData: {
    campaignType,
    alternativeMessage,  // Initial message for Messenger
    followUpMessages,
    message_delays: campaignSettings.message_delays
  }
};
```

### 3. API Endpoint (POST /api/campaigns)

```javascript
// Both types stored in same format
{
  workspace_id: workspaceId,
  name: campaignName,
  campaign_type: 'connector' | 'messenger',
  message_templates: {
    connection_request: "...",        // Empty for Messenger
    alternative_message: "...",       // Initial message for Messenger
    follow_up_messages: [...]
  },
  message_delays: ['2-3 days', '5-7 days', '1 week', '2 weeks', '2 weeks']
}
```

### 4. Execution (POST /api/campaigns/linkedin/execute-live)

```typescript
// Convert UI cadences to N8N timing
import { buildN8NTiming } from '@/lib/utils/cadence-converter';

const timing = buildN8NTiming(campaign.message_delays);
// Result: {
//   fu1_delay_days: 2.5,
//   fu2_delay_days: 6,
//   fu3_delay_days: 7,
//   fu4_delay_days: 14,
//   fu5_delay_days: 14
// }

// Send to N8N (same structure for both types)
const n8nPayload = {
  campaign_id: campaignId,
  campaign_type: campaignType,  // Tells N8N which flow to use
  prospects: [...],
  messages: {
    cr: campaign.connection_request || '',     // Empty for Messenger
    initial: campaign.alternative_message,     // Initial message for Messenger
    fu1: campaign.follow_up_1,
    fu2: campaign.follow_up_2,
    fu3: campaign.follow_up_3,
    fu4: campaign.follow_up_4,
    fu5: campaign.follow_up_5
  },
  timing: timing  // ← Dynamic timing for both types
};
```

### 5. N8N Workflow Execution

**Connector Workflow:**
```
1. Send Connection Request (no wait)
2. Wait for Acceptance (webhook-based)
3. Wait {{timing.fu1_delay_days}} days
4. Send Follow-up 1
5. Wait {{timing.fu2_delay_days}} days
6. Send Follow-up 2
... etc
```

**Messenger Workflow:**
```
1. Send Initial Message (no wait)
2. Wait {{timing.fu1_delay_days}} days
3. Send Follow-up 1
4. Wait {{timing.fu2_delay_days}} days
5. Send Follow-up 2
... etc
```

## Implementation Changes Made

### File: `/app/components/CampaignHub.tsx`

**Change 1: Include message_delays in campaignData (line 1581)**
```typescript
// Before
const campaignData = {
  name: name,
  messages: {...},
  _executionData: {...}
};

// After
const campaignData = {
  name: name,
  messages: {...},
  message_delays: campaignSettings.message_delays,  // ← Added
  _executionData: {
    ...,
    message_delays: campaignSettings.message_delays  // ← Added
  }
};
```

**Change 2: Include message_delays in API call (line 4084)**
```typescript
// Before
body: JSON.stringify({
  workspace_id: workspaceId,
  name: finalCampaignData.name,
  message_templates: {...}
})

// After
body: JSON.stringify({
  workspace_id: workspaceId,
  name: finalCampaignData.name,
  message_templates: {...},
  message_delays: finalCampaignData.message_delays || _executionData?.message_delays  // ← Added
})
```

## Testing

### Test Messenger Campaign with Dynamic Cadences

```bash
# 1. Create Messenger campaign via UI
# - Select "Messenger" campaign type
# - Upload 1st degree prospects (or select from existing)
# - Set custom cadences for each message:
#   - Follow-up 1: "1 day"
#   - Follow-up 2: "3-5 days"
#   - Follow-up 3: "1 week"
#   - Follow-up 4: "2 weeks"
#   - Follow-up 5: "2 weeks"

# 2. Check campaign data in database
SELECT
  id,
  name,
  campaign_type,
  message_delays
FROM campaigns
WHERE name = 'Your Campaign Name';

# Expected result:
# message_delays: ["1 day", "3-5 days", "1 week", "2 weeks", "2 weeks"]

# 3. Execute campaign (dry run)
curl -X POST http://localhost:3000/api/campaigns/linkedin/execute-live \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "YOUR_CAMPAIGN_ID",
    "maxProspects": 1,
    "dryRun": true
  }'

# 4. Check N8N timing conversion
# Expected timing object:
{
  "fu1_delay_days": 1,
  "fu2_delay_days": 4,
  "fu3_delay_days": 7,
  "fu4_delay_days": 14,
  "fu5_delay_days": 14
}

# 5. Verify in N8N executions
# Go to: https://workflows.innovareai.com/executions
# Check: Wait nodes use correct delays
```

### Test Both Campaign Types Side-by-Side

```bash
# Test conversion utility
node scripts/js/test-dynamic-cadence.mjs

# Expected output:
# ✅ Both campaign types use same conversion
# ✅ message_delays → N8N timing works identically
```

## Summary

✅ **Messenger campaigns now fully support dynamic per-message cadences**

✅ **Implementation identical to Connector campaigns** (except no CR)

✅ **Data flows correctly from UI → Database → N8N**

✅ **Both campaign types use same:**
- State management
- UI components
- Timing conversion utility
- N8N payload structure

✅ **Only difference: CR vs Initial Message**
- Connector: CR sent immediately, wait for acceptance, then follow-ups
- Messenger: Initial message sent immediately, then follow-ups

---

**Last Updated:** October 30, 2025
**Status:** Fully Implemented
**Files Modified:** `/app/components/CampaignHub.tsx` (2 changes)
**Testing:** Run test script to verify
