# N8N LinkedIn Messaging Setup - CORRECT Implementation

## Why Use N8N for Messaging?

**Benefits:**
✅ Handle complete campaign lifecycle (CR → FU1 → FU2 → FU3 → FU4 → Goodbye)
✅ Automatic follow-up scheduling (3-7 day delays)
✅ Connection acceptance checking before follow-ups
✅ Reply detection (stop if prospect responds)
✅ Visual workflow debugging
✅ Retry logic with exponential backoff
✅ No Netlify timeout limits
✅ Centralized campaign orchestration

**vs Direct API Calls:**
❌ Limited to single message per execution
❌ Need separate cron for follow-ups
❌ Need separate cron for connection checks
❌ No reply detection
❌ Scattered logic across multiple endpoints

---

## Architecture

```
SAM execute-live API
  → Validates prospects + TOS compliance
  → Triggers N8N webhook with campaign data
  → Returns immediately (no waiting)

N8N Workflow (async)
  → Receives webhook trigger
  → For each prospect:
     1. Get LinkedIn profile (provider_id)
     2. Send connection request
     3. Wait 24-48 hours
     4. Check if connection accepted
     5. If accepted: Send FU1
     6. Wait 3-7 days
     7. Check for replies
     8. If no reply: Send FU2
     9. Repeat for FU3, FU4, GB
```

---

## N8N Workflow: LinkedIn Campaign Execution

### Workflow ID: `sam-linkedin-campaign-v2`
### Webhook URL: `https://workflows.innovareai.com/webhook/sam-campaign-execute`

---

## Node-by-Node Workflow Design

### 1. Webhook Trigger Node
```json
{
  "name": "Campaign Webhook",
  "type": "n8n-nodes-base.webhook",
  "parameters": {
    "path": "sam-campaign-execute",
    "responseMode": "immediate",
    "authentication": "headerAuth",
    "options": {}
  }
}
```

**Input from SAM:**
```json
{
  "campaignId": "uuid",
  "campaignName": "Test Campaign",
  "workspaceId": "uuid",
  "unipileAccountId": "mERQmojtSZq5GeomZZazlw",
  "prospects": [
    {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "linkedin_url": "https://linkedin.com/in/johndoe",
      "company_name": "Acme Inc",
      "title": "CEO"
    }
  ],
  "messages": {
    "connection_request": "Hi {first_name}...",
    "follow_up_1": "Following up...",
    "follow_up_2": "...",
    "follow_up_3": "...",
    "follow_up_4": "...",
    "goodbye": "..."
  }
}
```

---

### 2. Split Into Batches Node
```json
{
  "name": "Split Prospects",
  "type": "n8n-nodes-base.splitInBatches",
  "parameters": {
    "batchSize": 1,
    "options": {}
  }
}
```

**Purpose:** Process one prospect at a time (LinkedIn rate limiting)

---

### 3. Extract LinkedIn Username Node
```json
{
  "name": "Extract Username",
  "type": "n8n-nodes-base.function",
  "parameters": {
    "functionCode": "const linkedinUrl = $json.linkedin_url;\nconst username = linkedinUrl.split('/in/')[1]?.split('?')[0]?.replace('/', '');\nreturn [{ ...items[0].json, linkedin_username: username }];"
  }
}
```

---

### 4. Get LinkedIn Profile Node (CRITICAL - Correct Endpoint!)
```json
{
  "name": "Get LinkedIn Profile",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "GET",
    "url": "=https://{{$env.UNIPILE_DSN}}/api/v1/users/{{$json.linkedin_username}}?account_id={{$json.unipileAccountId}}",
    "authentication": "genericCredentialType",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "X-API-KEY",
          "value": "={{$env.UNIPILE_API_KEY}}"
        },
        {
          "name": "Accept",
          "value": "application/json"
        }
      ]
    }
  }
}
```

**Output:** provider_id (e.g., "ACoAAABNFC4BCbTenqOTskrS2NEF7ggNuJpJ8ys")

---

### 5. Personalize Message Node
```json
{
  "name": "Personalize Message",
  "type": "n8n-nodes-base.function",
  "parameters": {
    "functionCode": "const message = $json.connectionRequestMessage;\nconst personalized = message\n  .replace(/\\{first_name\\}/gi, $json.first_name || '')\n  .replace(/\\{last_name\\}/gi, $json.last_name || '')\n  .replace(/\\{company_name\\}/gi, $json.company_name || '')\n  .replace(/\\{title\\}/gi, $json.title || '');\nreturn [{ ...items[0].json, personalizedMessage: personalized }];"
  }
}
```

---

### 6. Send Connection Request Node (CRITICAL - Correct Endpoint!)
```json
{
  "name": "Send Connection Request",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "=https://{{$env.UNIPILE_DSN}}/api/v1/users/invite",
    "authentication": "genericCredentialType",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "X-API-KEY",
          "value": "={{$env.UNIPILE_API_KEY}}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        {
          "name": "provider_id",
          "value": "={{$node['Get LinkedIn Profile'].json.provider_id}}"
        },
        {
          "name": "account_id",
          "value": "={{$json.unipileAccountId}}"
        },
        {
          "name": "message",
          "value": "={{$json.personalizedMessage}}"
        }
      ]
    }
  }
}
```

**Output:** invitation_id (e.g., "7388453380580417536")

---

### 7. Update Prospect Status Node
```json
{
  "name": "Update Prospect",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "=https://app.meet-sam.com/api/campaigns/update-prospect-status/{{$json.prospectId}}",
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        {
          "name": "status",
          "value": "connection_requested"
        },
        {
          "name": "contacted_at",
          "value": "={{new Date().toISOString()}}"
        },
        {
          "name": "unipile_invitation_id",
          "value": "={{$node['Send Connection Request'].json.invitation_id}}"
        }
      ]
    }
  }
}
```

---

### 8. Wait for Connection Acceptance Node
```json
{
  "name": "Wait 24-48 Hours",
  "type": "n8n-nodes-base.wait",
  "parameters": {
    "amount": "={{Math.floor(Math.random() * 24) + 24}}",
    "unit": "hours"
  }
}
```

---

### 9. Check Connection Status Node
```json
{
  "name": "Check Connection Accepted",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "GET",
    "url": "=https://app.meet-sam.com/api/campaigns/check-connection-status/{{$json.prospectId}}"
  }
}
```

---

### 10. If Connection Accepted Node
```json
{
  "name": "Connection Accepted?",
  "type": "n8n-nodes-base.if",
  "parameters": {
    "conditions": {
      "boolean": [
        {
          "value1": "={{$json.accepted}}",
          "value2": true
        }
      ]
    }
  }
}
```

---

### 11. Send Follow-Up 1 Node
```json
{
  "name": "Send FU1",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "=https://{{$env.UNIPILE_DSN}}/api/v1/messaging/messages",
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        {
          "name": "account_id",
          "value": "={{$json.unipileAccountId}}"
        },
        {
          "name": "provider_id",
          "value": "={{$json.provider_id}}"
        },
        {
          "name": "text",
          "value": "={{$json.followUp1Message}}"
        }
      ]
    }
  }
}
```

---

### 12-15. Repeat for FU2, FU3, FU4, Goodbye

Same pattern:
- Wait node (3-7 days random delay)
- Check for replies
- If no reply: Send next message
- Update prospect status

---

## Error Handling Nodes

### On Any Failure:
```json
{
  "name": "On Error",
  "type": "n8n-nodes-base.function",
  "parameters": {
    "functionCode": "// Log error to Supabase\n// Send alert to Slack\n// Update prospect status to 'failed'"
  }
}
```

---

## SAM API Changes Needed

### 1. Update execute-live to trigger N8N
```typescript
// app/api/campaigns/linkedin/execute-live/route.ts

// After validating prospects...
const n8nPayload = {
  campaignId: campaign.id,
  campaignName: campaign.name,
  workspaceId: campaign.workspace_id,
  unipileAccountId: selectedAccount.unipile_account_id,
  prospects: executableProspects.map(p => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    linkedin_url: p.linkedin_url,
    company_name: p.company_name,
    title: p.title
  })),
  messages: {
    connection_request: campaign.connection_message || campaign.message_templates?.connection_request,
    follow_up_1: campaign.message_templates?.follow_up_1,
    follow_up_2: campaign.message_templates?.follow_up_2,
    follow_up_3: campaign.message_templates?.follow_up_3,
    follow_up_4: campaign.message_templates?.follow_up_4,
    goodbye: campaign.message_templates?.goodbye
  }
};

// Trigger N8N webhook
const n8nResponse = await fetch(process.env.N8N_CAMPAIGN_WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.N8N_API_KEY}`
  },
  body: JSON.stringify(n8nPayload)
});

// Update prospects to 'queued_in_n8n'
await supabase
  .from('campaign_prospects')
  .update({ status: 'queued_in_n8n' })
  .in('id', executableProspects.map(p => p.id));

return NextResponse.json({
  success: true,
  message: `Queued ${executableProspects.length} prospects in N8N for execution`,
  n8n_execution_id: n8nResponse.executionId
});
```

### 2. Add API endpoints for N8N callbacks

**`/api/campaigns/update-prospect-status/[id]/route.ts`** - Already exists ✅

**`/api/campaigns/check-connection-status/[id]/route.ts`** - Need to create:
```typescript
export async function GET(req: Request, { params }: { params: { id: string } }) {
  // Query Unipile to check if connection was accepted
  // Return { accepted: true/false, acceptedAt: timestamp }
}
```

---

## Environment Variables

Add to `.env.local` and Netlify:
```bash
N8N_CAMPAIGN_WEBHOOK_URL=https://workflows.innovareai.com/webhook/sam-campaign-execute
N8N_API_KEY=your_n8n_api_key
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=aQzsD1+H...
```

---

## Testing Plan

### 1. Test Workflow in N8N (Manual)
- Import workflow JSON
- Test with 1 prospect
- Verify each node executes
- Check Unipile API responses

### 2. Test SAM → N8N Integration
- Execute campaign with 1 prospect
- Check webhook received in N8N
- Verify prospect status updates

### 3. Test Full Campaign Lifecycle
- Execute with 2-3 prospects
- Monitor N8N execution logs
- Verify connection requests sent
- Wait for acceptance (or manually accept)
- Verify follow-ups sent

---

## Rollout Plan

### Phase 1: Create N8N Workflow (Day 1-2)
1. Import workflow template
2. Configure environment variables
3. Test manually with sample data

### Phase 2: Modify SAM API (Day 3)
1. Update execute-live to trigger N8N
2. Add connection-status endpoint
3. Deploy to staging

### Phase 3: Parallel Testing (Day 4-5)
1. Run N8N version alongside direct API
2. Compare results
3. Fix any issues

### Phase 4: Production Migration (Day 6-7)
1. Deploy N8N version to production
2. Monitor executions closely
3. Keep direct API as fallback

---

## Why Previous Setup Failed

**Problem:** Used `/api/v1/messaging/messages` for connection requests
**Why It Failed:** That endpoint is for messaging EXISTING connections, not sending connection requests

**Correct Flow:**
1. `/api/v1/users/{username}` → Get provider_id
2. `/api/v1/users/invite` → Send connection request
3. THEN `/api/v1/messaging/messages` → Send follow-up messages (after acceptance)

---

**Created:** October 30, 2025
**Status:** Ready to implement
**Next Step:** Import N8N workflow template
