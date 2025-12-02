# N8N MCP Server Integration for CRM Sync

## Overview

N8N v1.88+ includes native MCP (Model Context Protocol) support via the **MCP Server Trigger** node. This allows N8N workflows to be exposed as MCP tools that SAM AI can call directly through the MCP protocol.

## Architecture

```
SAM AI (MCP Client)
  ├── MCP Registry
  │   ├── CRM MCP Server (Direct adapters: HubSpot, ActiveCampaign, Airtable)
  │   └── N8N MCP Server (URL: https://n8n.innovareai.com/mcp)
  │       ├── crm_sync_to_crm (Workflow 1: SAM → CRM)
  │       ├── crm_sync_from_crm (Workflow 2: CRM → SAM - scheduled)
  │       └── crm_resolve_conflict (Workflow 3: Conflict Resolution)
  └── Calls N8N workflows as MCP tools
```

## How N8N MCP Server Works

### MCP Server Trigger Node

The MCP Server Trigger node:
- Exposes N8N workflows as MCP tools
- Supports both Server-Sent Events (SSE) and HTTP streaming
- Provides test and production URLs
- Only connects to tool nodes (not regular workflow nodes)

### URL Format
```
Production: https://your-n8n-instance.com/webhook/mcp/{workflow-id}
Test: https://your-n8n-instance.com/webhook-test/mcp/{workflow-id}
```

## Implementation Steps

### Step 1: Configure N8N Workflows with MCP Server Trigger

#### Workflow 1: SAM → CRM Sync

```json
{
  "name": "CRM Sync Tool",
  "nodes": [
    {
      "name": "MCP Server Trigger",
      "type": "@n8n/n8n-nodes-langchain.mcpTrigger",
      "parameters": {
        "toolName": "crm_sync_to_crm",
        "toolDescription": "Sync a contact from SAM to the connected CRM",
        "parameters": {
          "workspace_id": { "type": "string", "required": true },
          "crm_type": { "type": "string", "required": true },
          "action": { "type": "string", "enum": ["create", "update"] },
          "contact_data": { "type": "object", "required": true }
        }
      }
    },
    {
      "name": "Get CRM Connection",
      "type": "n8n-nodes-base.postgres"
    },
    {
      "name": "Map Fields",
      "type": "n8n-nodes-base.code"
    },
    {
      "name": "Sync to CRM",
      "type": "n8n-nodes-base.httpRequest"
    },
    {
      "name": "Return Result",
      "type": "@n8n/n8n-nodes-langchain.toolReturnData"
    }
  ]
}
```

#### Workflow 2: CRM → SAM Sync (Scheduled)

```json
{
  "name": "CRM to SAM Scheduled Sync",
  "nodes": [
    {
      "name": "Every 15 Minutes",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {
        "rule": {
          "interval": [{ "field": "minutes", "minutesInterval": 15 }]
        }
      }
    },
    {
      "name": "Call MCP Tool: Sync from CRM",
      "type": "@n8n/n8n-nodes-langchain.toolMcp",
      "parameters": {
        "mcpServerUrl": "{{ $env.N8N_MCP_URL }}/webhook/mcp/sync-from-crm",
        "toolName": "sync_all_workspaces"
      }
    }
  ]
}
```

#### Workflow 3: Sync from CRM Tool

```json
{
  "name": "Sync from CRM Tool",
  "nodes": [
    {
      "name": "MCP Server Trigger",
      "type": "@n8n/n8n-nodes-langchain.mcpTrigger",
      "parameters": {
        "toolName": "crm_sync_from_crm",
        "toolDescription": "Fetch updates from CRM and sync to SAM",
        "parameters": {
          "workspace_id": { "type": "string", "required": true }
        }
      }
    },
    {
      "name": "Get CRM Connection",
      "type": "n8n-nodes-base.postgres"
    },
    {
      "name": "Fetch CRM Contacts",
      "type": "n8n-nodes-base.httpRequest"
    },
    {
      "name": "Call SAM API",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "{{ $env.SAM_API_URL }}/api/crm/webhook/sync-from-crm",
        "method": "POST"
      }
    },
    {
      "name": "Return Result",
      "type": "@n8n/n8n-nodes-langchain.toolReturnData"
    }
  ]
}
```

### Step 2: Register N8N MCP Server in SAM

Update [lib/mcp/mcp-registry.ts](../../lib/mcp/mcp-registry.ts):

```typescript
// Add N8N MCP Server URL to config
n8nMcp: {
  serverUrl: process.env.N8N_MCP_SERVER_URL, // https://n8n.innovareai.com/mcp
  apiKey: process.env.N8N_API_KEY
}
```

### Step 3: Call N8N CRM Tools from SAM

Update [lib/services/crm-sync.ts](../../lib/services/crm-sync.ts):

```typescript
async function syncToLeadToCRM(workspaceId: string, lead: InterestedLead) {
  // Call N8N MCP tool instead of direct HTTP
  const result = await mcpRegistry.callTool({
    method: 'tools/call',
    params: {
      name: 'crm_sync_to_crm', // N8N MCP tool
      arguments: {
        workspace_id: workspaceId,
        crm_type: 'hubspot', // or activecampaign, airtable
        action: 'create',
        contact_data: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone
        }
      }
    }
  });

  return result;
}
```

## Environment Variables

```bash
# N8N MCP Server
N8N_MCP_SERVER_URL=https://n8n.innovareai.com/mcp
N8N_API_KEY=your_n8n_api_key
N8N_WEBHOOK_SECRET=your_webhook_secret

# For N8N Workflows (accessed from within N8N)
SAM_API_URL=https://sam.innovareai.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Benefits of N8N MCP Integration

1. **Standard Protocol**: Uses MCP standard instead of custom webhooks
2. **Type Safety**: MCP tools have defined input schemas
3. **Automatic Discovery**: SAM can discover all N8N CRM tools automatically
4. **Error Handling**: MCP protocol includes standardized error responses
5. **Versioning**: N8N can version tools without breaking SAM integration
6. **Monitoring**: MCP calls are logged and can be monitored
7. **No Timeout Issues**: N8N runs on its own server, SAM just calls the tool

## Workflow Setup in N8N UI

### 1. Create New Workflow

1. Go to N8N: https://n8n.innovareai.com
2. Click "New Workflow"
3. Name it: "CRM Sync to CRM"

### 2. Add MCP Server Trigger

1. Click "+" to add node
2. Search for "MCP Server Trigger"
3. Configure:
   - **Tool Name**: `crm_sync_to_crm`
   - **Tool Description**: "Sync contact from SAM to connected CRM"
   - **Parameters**: Define workspace_id, crm_type, action, contact_data

### 3. Add Logic Nodes

1. Add Postgres node to query CRM connection
2. Add Code node to map fields
3. Add HTTP Request node to call CRM API
4. Add "Return Data" node to send response back to MCP client

### 4. Activate Workflow

1. Click "Activate" in top right
2. Copy the production MCP URL
3. Add it to SAM's MCP registry

### 5. Test from SAM

```typescript
// Test the N8N MCP tool
const result = await mcpRegistry.callTool({
  method: 'tools/call',
  params: {
    name: 'crm_sync_to_crm',
    arguments: {
      workspace_id: 'test-workspace-123',
      crm_type: 'hubspot',
      action: 'create',
      contact_data: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      }
    }
  }
});

console.log(result);
```

## Migration Path from HTTP Webhooks to MCP

1. **Phase 1 (Current)**: Keep HTTP webhook approach working
2. **Phase 2**: Create N8N workflows with MCP Server Trigger
3. **Phase 3**: Register N8N MCP server in SAM registry
4. **Phase 4**: Switch CRM sync to use MCP tools
5. **Phase 5**: Deprecate HTTP webhook endpoints

## Resources

- [N8N MCP Server Trigger Documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.mcptrigger/)
- [N8N MCP Guide for Beginners](https://generect.com/blog/n8n-mcp/)
- [How to Use N8N with MCP Servers](https://www.hostinger.com/tutorials/how-to-use-n8n-with-mcp)
- [N8N Native MCP Integration](https://leandrocaladoferreira.medium.com/n8ns-native-mcp-integration-current-capabilities-and-future-potential-4a36ca30d879)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)

## Next Steps

1. Set up N8N instance with MCP Server Trigger nodes
2. Create 3 workflows: sync-to-crm, sync-from-crm, resolve-conflict
3. Register N8N MCP server URL in SAM's MCP registry
4. Update crm-sync.ts to call N8N MCP tools
5. Test end-to-end CRM sync flow
6. Monitor N8N execution logs for optimization

## Advantages Over Current Approach

| Feature | HTTP Webhooks | N8N MCP Server |
|---------|--------------|----------------|
| Protocol | Custom HTTP | Standard MCP |
| Tool Discovery | Manual | Automatic |
| Type Safety | JSON validation | MCP schema |
| Error Handling | HTTP codes | MCP protocol |
| Monitoring | Custom logs | MCP logs |
| Versioning | Breaking changes | Tool versions |
| Integration | Hard-coded URLs | Dynamic registry |
| Scalability | Manual scaling | MCP handles it |
