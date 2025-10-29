# N8N Workflow Debugging - Technical Summary

## Problem Statement

LinkedIn campaign automation workflow fails with HTTP 500 "Error in workflow" when using full 35-node workflow, but simpler 3-node workflows work perfectly.

## Environment

- **N8N Version**: 1.117.3 (latest)
- **Deployment**: Docker container (self-hosted)
- **Database**: PostgreSQL
- **Execution Mode**: Regular (not queue)
- **Webhook URL**: https://workflows.innovareai.com/webhook/campaign-execute
- **Workflow ID**: aVG6LC4ZFRMN7Bw6

## What Works ✅

### Simple 3-Node Workflow (WORKING)
```
Webhook → Campaign Handler (Function) → Log Result (Function)
```

**Test Result**: HTTP 200, returns data correctly:
```json
{
  "campaign_name": "Test Campaign",
  "prospect": {...},
  "message": "Hi Test, this is a test connection request."
}
```

**Campaign Handler Code (Working)**:
```javascript
const data = $input.item.json.body || $input.item.json;
console.log('📨 Got campaign:', data.campaign_name);

return [{
  json: {
    campaign_name: data.campaign_name,
    prospect: data.prospects[0],
    message: data.messages.cr
  }
}];
```

## What Fails ❌

### Full 35-Node Workflow (FAILING)
```
Webhook
  → Campaign Handler (Function)
  → Process Each Prospect (splitInBatches loop)
  → Send CR (HTTP Request to Unipile)
  → Check Connection Accepted (HTTP Request)
  → Connection Accepted? (If node)
  → [branches to either exit or continue]
  → Wait for FU1 (Wait node)
  → Check Reply FU1 (HTTP Request)
  → Send FU1 (HTTP Request)
  → [repeat for FU2, FU3, FU4, GB]
```

**Test Result**: HTTP 500 "Error in workflow"

**No error logs in Docker** - N8N logs show no execution errors

## Webhook Payload Structure

```json
{
  "workspace_id": "test-workspace",
  "workspace_name": "Test Workspace",
  "campaign_id": "test-campaign",
  "campaign_name": "Test Campaign",
  "linkedin_account_name": "Test LinkedIn",
  "unipile_account_id": "test-unipile-account",
  "unipile_dsn": "api6.unipile.com:13670",
  "unipile_api_key": "xxx",
  "prospects": [
    {
      "id": "test-prospect-1",
      "linkedin_url": "https://linkedin.com/in/test-person",
      "first_name": "Test",
      "last_name": "Person",
      "company_name": "Test Company",
      "title": "CEO"
    }
  ],
  "messages": {
    "cr": "Hi Test, this is a test connection request.",
    "fu1": "Follow up 1",
    "fu2": "Follow up 2",
    "fu3": "Follow up 3",
    "fu4": "Follow up 4",
    "gb": "Goodbye message"
  },
  "timing": {
    "fu1_delay_days": 2,
    "fu2_delay_days": 5,
    "fu3_delay_days": 7,
    "fu4_delay_days": 5,
    "gb_delay_days": 7
  },
  "template": "cr_4fu_1gb"
}
```

## Node Configurations

### Webhook Node (Working)
```javascript
{
  type: "n8n-nodes-base.webhook",
  typeVersion: 2.1,
  parameters: {
    path: "campaign-execute",
    httpMethod: "POST",
    responseMode: "lastNode",  // Return last node's output
    options: {}
  }
}
```

### Campaign Handler Function (Working)
```javascript
{
  type: "n8n-nodes-base.function",
  typeVersion: 1,
  parameters: {
    functionCode: `
// Extract data from webhook body
const data = $input.item.json.body || $input.item.json;

console.log('📨 Campaign Handler received:', JSON.stringify(data, null, 2));

return {
  workspace_id: data.workspace_id,
  workspace_name: data.workspace_name,
  campaign_id: data.campaign_id,
  campaign_name: data.campaign_name,
  linkedin_account_name: data.linkedin_account_name,
  unipile_account_id: data.unipile_account_id,
  prospects: data.prospects || [],
  messages: data.messages || {},
  timing: data.timing || {...},
  last_message_sent: new Date().toISOString()
};
    `
  }
}
```

### splitInBatches Node (SUSPECT - may be causing failure)
```javascript
{
  type: "n8n-nodes-base.splitInBatches",
  typeVersion: 1,
  parameters: {
    batchSize: 1,
    options: { reset: false }
  }
}
```

**Question**: How should splitInBatches access the `prospects` array from the previous node?

### HTTP Request Node Example - Send CR (SUSPECT)
```javascript
{
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 3,
  parameters: {
    url: "={{ $env.UNIPILE_DSN }}/api/v1/messaging/messages",
    method: "POST",
    authentication: "genericCredentialType",
    genericAuthType: "httpHeaderAuth",
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: "X-API-KEY", value: "={{ $env.UNIPILE_API_KEY }}" }
      ]
    },
    sendBody: true,
    bodyParameters: {
      parameters: [
        { name: "account_id", value: "={{ $json.unipile_account_id }}" },
        { name: "attendees[0][identifier]", value: "={{ $json.linkedin_url }}" },
        { name: "text", value: "={{ $json.message }}" },
        { name: "type", value: "LINKEDIN" }
      ]
    },
    options: {}
  }
}
```

**Environment Variables in N8N**:
```bash
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=xxx
```

**Questions**:
1. Is `$env.UNIPILE_DSN` the correct way to access environment variables in HTTP Request nodes?
2. Should the URL include `https://` prefix? Current: `={{ $env.UNIPILE_DSN }}/api/...`

### If Node Example - Connection Accepted Check (SUSPECT)
```javascript
{
  type: "n8n-nodes-base.if",
  typeVersion: 2,
  parameters: {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: "",
        typeValidation: "strict"
      },
      conditions: [
        {
          leftValue: "={{ $json.status }}",
          rightValue: "accepted",
          operator: {
            type: "string",
            operation: "equals"
          }
        }
      ],
      combinator: "and"
    },
    options: {}
  }
}
```

## Connection Pattern

All connections use node NAMES (not IDs):
```javascript
connections: {
  "Campaign Execute Webhook": {
    main: [[{ node: "Campaign Handler", type: "main", index: 0 }]]
  },
  "Campaign Handler": {
    main: [[{ node: "Process Each Prospect", type: "main", index: 0 }]]
  },
  "Process Each Prospect": {
    main: [[{ node: "Send CR", type: "main", index: 0 }]]
  },
  "Send CR": {
    main: [[{ node: "Check Connection Accepted", type: "main", index: 0 }]]
  },
  // ... continues for all 35 nodes
}
```

**This pattern WORKS for simple workflows** but fails for complex ones.

## Workflow Settings

```javascript
settings: {
  executionOrder: "v1",
  timezone: "America/New_York",
  saveManualExecutions: true,
  saveExecutionProgress: true,
  saveDataSuccessExecution: "all",
  saveDataErrorExecution: "all",
  executionTimeout: 3600
}
```

## Debugging Attempts

1. ✅ **Fixed webhook data extraction** - Changed from `$input.item.json.workspace_id` to `$input.item.json.body.workspace_id`
2. ✅ **Added UNIPILE environment variables** to Docker container
3. ✅ **Confirmed name-based connections work** for simple workflows
4. ✅ **Changed responseMode** from "onReceived" to "lastNode"
5. ❌ **Full workflow still fails** with no error logs

## Key Questions for N8N Expert

1. **splitInBatches Configuration**: How do I configure splitInBatches to loop over the `prospects` array from the previous node's output?

2. **HTTP Request URL**: Should `$env.UNIPILE_DSN` include the protocol? Do I need `https://{{ $env.UNIPILE_DSN }}/api/...`?

3. **Data Flow Through Loop**: In the loop, how does each iteration access:
   - The current prospect: `$json.prospects[current_index]`?
   - Data from the Campaign Handler: `$json.campaign_name`, `$json.messages.cr`?

4. **Error Logging**: Why is N8N not logging any errors to Docker logs when the workflow fails with HTTP 500?

5. **Workflow Complexity Limits**: Is there a limit to the number of nodes or complexity that can be deployed via API vs manually in UI?

6. **Wait Node in Loop**: Can Wait nodes work inside a splitInBatches loop? Or do they need special configuration?

7. **If Node Branches**: When an If node has two outputs (true/false), how do I ensure both branches eventually connect back to the loop?

## Expected Behavior

The workflow should:
1. Receive webhook with campaign data + array of prospects
2. Loop through each prospect
3. For each prospect:
   - Send LinkedIn connection request (CR)
   - Check if connection accepted
   - If accepted → Wait 2 days → Send FU1
   - Before each follow-up → Check for prospect reply
   - If replied → Exit sequence
   - If no reply → Continue to next message
   - Send FU2, FU3, FU4, GB with checks between each

## Actual Behavior

- Simple workflows (no loop, no HTTP): ✅ Work
- Workflows with loop but no HTTP: ❓ Unknown (not tested)
- Full workflow with loop + HTTP: ❌ Fails with HTTP 500

## Files

- Full workflow deployment: `/scripts/js/deploy-full-6-message-workflow.mjs`
- Working simple test: `/scripts/js/test-minimal-with-http.mjs`
- Test webhook script: `/scripts/js/test-webhook-direct.mjs`

## Request

Please help identify:
1. What's causing the HTTP 500 error in the full workflow
2. Correct configuration for splitInBatches to loop over prospects array
3. Correct way to reference environment variables in HTTP Request nodes
4. How to access loop iteration data and previous node data within the loop
5. Any N8N best practices for complex workflows with loops + conditional branching

Thank you!
