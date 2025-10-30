# Data-Driven Campaign System

**Date:** October 30, 2025
**Status:** ✅ IMPLEMENTED & READY

---

## Overview

SAM now supports **flexible, data-driven LinkedIn campaigns** where users can customize:
- **Timing**: Wait times between connection requests and follow-ups
- **Messages**: Number and content of follow-up messages (1-6 + goodbye)
- **A/B Testing**: Run multiple campaigns simultaneously to test different approaches

**Key Innovation:** One N8N workflow handles ALL campaigns, all workspaces, with infinite variations.

---

## Architecture

```
User Conversation with SAM
         ↓
  "Create aggressive campaign for CTOs"
         ↓
SAM MCP Tool: create_linkedin_campaign_with_flow
         ↓
Database: campaigns.flow_settings = {
  connection_wait_hours: 24,
  followup_wait_days: 3,
  messages: {
    connection_request: "...",
    follow_up_1: "...",
    follow_up_2: "..."
  }
}
         ↓
Campaign Execution API: execute-live
         ↓
N8N Webhook Payload (includes flow_settings)
         ↓
N8N Workflow reads $json.flow_settings
         ↓
Wait nodes: $json.flow_settings.connection_wait_hours
Personalize nodes: $json.flow_settings.messages.follow_up_1
         ↓
Executes with campaign-specific timing & messages
```

---

## Database Schema

### campaigns.flow_settings (JSONB)

```sql
ALTER TABLE campaigns
ADD COLUMN flow_settings JSONB DEFAULT '{
  "connection_wait_hours": 36,
  "followup_wait_days": 5,
  "messages": {
    "connection_request": null,
    "follow_up_1": null,
    "follow_up_2": null,
    "follow_up_3": null,
    "follow_up_4": null,
    "follow_up_5": null,
    "follow_up_6": null,
    "goodbye": null
  }
}'::jsonb;
```

### campaigns.metadata (JSONB) - For A/B Testing

```sql
ALTER TABLE campaigns
ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

-- Example A/B test metadata:
{
  "ab_test_group": "CTO Outreach Test",
  "variant": "A",
  "variant_label": "Aggressive"
}
```

---

## SAM MCP Tools

### 1. Create Single Campaign

**Tool:** `mcp__sam__create_linkedin_campaign_with_flow`

**Usage:**
```typescript
await mcp__sam__create_linkedin_campaign_with_flow({
  workspace_id: "workspace-123",
  name: "Enterprise CTO Outreach",
  connection_wait_hours: 48, // Optional, default: 36
  followup_wait_days: 7,      // Optional, default: 5
  messages: {
    connection_request: "Hi {first_name}, I noticed you're leading...",
    follow_up_1: "Just following up on my connection request...",
    follow_up_2: "Wanted to share a case study...",
    follow_up_3: null, // Not using FU3-6
    follow_up_4: null,
    follow_up_5: null,
    follow_up_6: null,
    goodbye: "No worries if timing isn't right..."
  }
});
```

**Returns:**
```json
{
  "success": true,
  "campaign_id": "campaign-xyz",
  "campaign_name": "Enterprise CTO Outreach",
  "flow_preview": {
    "total_steps": 3,
    "total_days": 16,
    "timeline": [
      "Day 0: Connection Request",
      "Day 2.0: Follow Up 1",
      "Day 9.0: Follow Up 2",
      "Day 16.0: Goodbye"
    ]
  }
}
```

### 2. Create A/B Test (Multiple Campaigns)

**Tool:** `mcp__sam__create_ab_test_campaigns`

**Usage:**
```typescript
await mcp__sam__create_ab_test_campaigns({
  workspace_id: "workspace-123",
  test_name: "CTO Outreach Test",
  campaigns: [
    {
      variant_name: "A",
      variant_label: "Aggressive",
      connection_wait_hours: 24,
      followup_wait_days: 3,
      messages: {
        connection_request: "Quick question about {company_name}...",
        follow_up_1: "Still curious...",
        follow_up_2: "Last try..."
      }
    },
    {
      variant_name: "B",
      variant_label: "Nurturing",
      connection_wait_hours: 72,
      followup_wait_days: 10,
      messages: {
        connection_request: "Hi {first_name}, wanted to learn...",
        follow_up_1: "Hope you're doing well...",
        follow_up_2: "Wanted to share...",
        follow_up_3: "Following up...",
        goodbye: "Best of luck..."
      }
    }
  ]
});
```

**Returns:**
```json
{
  "success": true,
  "test_name": "CTO Outreach Test",
  "campaigns": [
    {
      "id": "campaign-a",
      "name": "CTO Outreach Test - Aggressive",
      "variant": "A",
      "variant_label": "Aggressive"
    },
    {
      "id": "campaign-b",
      "name": "CTO Outreach Test - Nurturing",
      "variant": "B",
      "variant_label": "Nurturing"
    }
  ]
}
```

### 3. Split Prospects for A/B Testing

**Tool:** `mcp__sam__split_prospects_between_campaigns`

**Usage:**
```typescript
await mcp__sam__split_prospects_between_campaigns({
  prospect_ids: ["p1", "p2", "p3", "p4", "p5", "p6"],
  campaign_ids: ["campaign-a", "campaign-b"],
  shuffle: true // Default: true (randomizes distribution)
});
```

**Returns:**
```json
{
  "success": true,
  "distribution": [
    { "campaign_id": "campaign-a", "prospect_count": 3 },
    { "campaign_id": "campaign-b", "prospect_count": 3 }
  ]
}
```

---

## N8N Workflow

### One Workflow, Infinite Variations

**Workflow ID:** `FNwzHH1WTHGMtdEe`
**URL:** https://workflows.innovareai.com/workflow/FNwzHH1WTHGMtdEe

### How It Works

The workflow reads settings from the **webhook payload**, not from configuration.

#### Wait Node Example (Connection Request)

```javascript
// Wait node reads from flow_settings
const flowSettings = $json.flow_settings;
const waitHours = flowSettings.connection_wait_hours || 36;

return { waitHours };

// Campaign A: 24 hours
// Campaign B: 72 hours
// Same node, different behavior based on data
```

#### Wait Node Example (Follow-Ups)

```javascript
// Wait node reads from flow_settings
const flowSettings = $json.flow_settings;
const waitDays = flowSettings.followup_wait_days || 5;
const waitHours = waitDays * 24;

return { waitHours };

// Campaign A: 3 days = 72 hours
// Campaign B: 10 days = 240 hours
// Same node, different behavior based on data
```

#### Personalize Node Example

```javascript
// Personalize message from flow_settings
const flowSettings = $input.first().json.flow_settings;
const prospect = $input.first().json;

// Get message from flow_settings
const message = flowSettings.messages.follow_up_1;

// If no message configured, end campaign
if (!message || message.trim() === '') {
  return {
    ...items[0].json,
    personalizedMessage: null,
    skipMessage: true,
    campaignComplete: true
  };
}

// Personalize the message
const personalized = message
  .replace(/{first_name}/gi, prospect.first_name || '')
  .replace(/{last_name}/gi, prospect.last_name || '')
  .replace(/{company_name}/gi, prospect.company_name || '')
  .replace(/{title}/gi, prospect.title || '');

return {
  ...items[0].json,
  personalizedMessage: personalized,
  skipMessage: false
};
```

---

## API Integration

### Execute-Live API Update

**File:** `/app/api/campaigns/linkedin/execute-live/route.ts`

**What Changed:**

```typescript
// Get flow_settings from campaign
const flowSettings = campaign.flow_settings || {
  connection_wait_hours: 36,
  followup_wait_days: 5,
  messages: messages // Fallback to legacy
};

const n8nPayload = {
  campaignId: campaign.id,
  prospects: n8nProspects.map(p => ({
    ...p,
    flow_settings: flowSettings // Attached to each prospect
  })),
  flow_settings: flowSettings // Also at campaign level
};

// Send to N8N webhook
await fetch(process.env.N8N_CAMPAIGN_WEBHOOK_URL, {
  method: 'POST',
  body: JSON.stringify(n8nPayload)
});
```

**Each prospect gets:**
- Their prospect data (name, company, LinkedIn URL)
- The campaign's `flow_settings` (timing + messages)

**N8N preserves** `flow_settings` throughout the entire execution (days/weeks).

---

## User Experience with SAM

### Example 1: Create Simple Campaign

```
User: Create a LinkedIn campaign for enterprise CTOs

SAM: I'll create a professional campaign for enterprise CTOs.

     Campaign: Enterprise CTO Outreach

     Timing:
     - 48 hours after connection request
     - 7 days between follow-ups

     Messages:
     1. Connection Request: Professional intro
     2. Follow-Up 1 (Day 2): Share insight
     3. Follow-Up 2 (Day 9): Value proposition
     4. Goodbye (Day 16): Soft close

     Sound good?

User: Perfect!

SAM: ✅ Campaign created!
     Campaign ID: campaign-xyz
     Ready to add prospects.
```

### Example 2: Create A/B Test

```
User: I want to test two approaches for CTO outreach

SAM: What would you like to test?

User: Test short direct messages vs longer storytelling

SAM: I'll create two campaigns:

     Campaign A - Direct:
     - 24h wait, 3-day follow-ups
     - Short 2-3 sentence messages
     - 3 follow-ups

     Campaign B - Storytelling:
     - 48h wait, 7-day follow-ups
     - Longer narrative messages
     - 5 follow-ups

     How many prospects do you have?

User: 60 prospects

SAM: Perfect! I'll split them 30/30.

     ✅ Campaign A: 30 prospects
     ✅ Campaign B: 30 prospects

     Ready to launch?

User: Yes

SAM: ✅ Both campaigns launched!

     I'll check back in 14 days to see which performs better.
```

---

## Benefits

### 1. No Workflow Duplication
- ✅ One workflow handles all campaigns
- ✅ One workflow for all workspaces
- ✅ Easy to maintain and update

### 2. Infinite Flexibility
- ✅ Any timing (12-96h connection wait, 1-30d follow-up wait)
- ✅ Any number of messages (1-6 follow-ups)
- ✅ Unlimited A/B test variations

### 3. SAM-Powered
- ✅ Users create campaigns via chat
- ✅ No complex UI to build
- ✅ SAM suggests best practices

### 4. Simple A/B Testing
- ✅ Just create 2+ campaigns
- ✅ Split prospects evenly
- ✅ Compare results side-by-side

### 5. Backward Compatible
- ✅ Legacy campaigns still work
- ✅ Falls back to `message_templates` if no `flow_settings`

---

## Migration Path

### For Existing Campaigns

Run this SQL to add flow_settings:

```sql
-- Run migration
\i sql/migrations/add-campaign-flow-settings.sql

-- Migrate existing campaigns (optional)
UPDATE campaigns
SET flow_settings = jsonb_build_object(
  'connection_wait_hours', 36,
  'followup_wait_days', 5,
  'messages', jsonb_build_object(
    'connection_request', message_templates->>'connection_request',
    'follow_up_1', message_templates->>'follow_up_1',
    'follow_up_2', message_templates->>'follow_up_2',
    'follow_up_3', message_templates->>'follow_up_3',
    'follow_up_4', message_templates->>'follow_up_4',
    'goodbye', message_templates->>'goodbye'
  )
)
WHERE flow_settings IS NULL;
```

---

## Testing

### Test 1: Create Campaign via SAM

```bash
# In SAM chat:
"Create a test campaign for software engineers with 3 quick follow-ups"

# SAM will:
1. Create campaign with flow_settings
2. Set connection_wait_hours: 24
3. Set followup_wait_days: 3
4. Create 3 follow-up messages
5. Return campaign_id
```

### Test 2: Execute Campaign

```bash
# Execute via API
curl -X POST https://app.meet-sam.com/api/campaigns/linkedin/execute-live \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "CAMPAIGN_ID",
    "maxProspects": 1,
    "dryRun": false
  }'

# Check N8N execution
# Visit: https://workflows.innovareai.com/executions
# Look for new execution with flow_settings in payload
```

### Test 3: A/B Test

```bash
# In SAM chat:
"Create A/B test: aggressive vs nurturing for CTOs, 60 prospects"

# SAM will:
1. Create 2 campaigns with different flow_settings
2. Split 60 prospects → 30 each
3. Return campaign IDs

# Execute both:
curl -X POST .../execute-live -d '{"campaignId": "CAMPAIGN_A_ID"}'
curl -X POST .../execute-live -d '{"campaignId": "CAMPAIGN_B_ID"}'

# Compare results in 7-14 days
```

---

## Files Changed

1. **Database Migration:**
   - `sql/migrations/add-campaign-flow-settings.sql`

2. **MCP Tools:**
   - `lib/mcp/campaign-orchestration-mcp.ts`
     - `mcp__sam__create_linkedin_campaign_with_flow()`
     - `mcp__sam__create_ab_test_campaigns()`
     - `mcp__sam__split_prospects_between_campaigns()`

3. **N8N Workflow Update:**
   - `scripts/js/update-n8n-dynamic-flow.mjs`

4. **API Update:**
   - `app/api/campaigns/linkedin/execute-live/route.ts`

---

## Next Steps

### Immediate (Already Done)
- ✅ Database schema migration
- ✅ SAM MCP tools
- ✅ N8N workflow updated
- ✅ Execute API updated

### Phase 2 (Future)
- Add campaign comparison dashboard
- SAM suggests optimal timing based on engagement data
- Pre-built campaign templates (aggressive, nurturing, enterprise)
- Webhook to notify when A/B test winner is statistically significant

---

## Summary

**Before:**
- Fixed timing (36h, 5d hardcoded in N8N)
- Fixed messages (template-based)
- One workflow per campaign type
- No A/B testing

**After:**
- ✅ Flexible timing (user configurable via SAM)
- ✅ Flexible messages (1-6 follow-ups)
- ✅ One workflow for ALL campaigns
- ✅ Simple A/B testing (create multiple campaigns)

**Result:** Users can create any campaign variation via conversation with SAM, with zero additional N8N workflows needed.

---

**Status:** ✅ READY FOR PRODUCTION
**Created:** October 30, 2025
**By:** Claude Code (Sonnet 4.5)
