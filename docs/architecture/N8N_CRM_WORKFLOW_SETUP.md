# N8N CRM Workflow Setup Guide

## Overview

This guide provides step-by-step instructions for creating 3 N8N workflows that handle bi-directional CRM sync using MCP (Model Context Protocol).

**Cost**: **FREE** (self-hosted N8N)
**Architecture**: Netlify scheduled functions (FREE - 125k invocations/month) → N8N MCP workflows → CRM APIs

## Why This Approach?

| Component | Solution | Cost | Scalability |
|-----------|----------|------|-------------|
| Scheduled Jobs | Netlify Functions (free tier) | $0 | 125k calls/month free |
| CRM API Routing | N8N HTTP Request + Switch | $0 | Supports 400+ CRMs |
| MCP Protocol | N8N MCP Server Trigger | $0 | Standard protocol |
| Bi-directional Sync | Netlify cron + N8N workflows | $0 | Every 15 minutes |

**Total Cost: $0/month** (as long as under 125k Netlify invocations - current usage: ~90k/month)

## Prerequisites

- N8N instance running at `https://n8n.innovareai.com`
- Supabase database with CRM tables (see migration file)
- Environment variables configured in N8N

## Environment Variables (N8N)

Configure these in N8N Settings → Variables:

```bash
# SAM API
SAM_API_URL=https://sam.innovareai.com
N8N_WEBHOOK_SECRET=your_webhook_secret

# Supabase (for REST API access)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
```

## Workflow 1: SAM → CRM Sync (MCP Tool)

### Purpose
Syncs a contact from SAM to the connected CRM when triggered via MCP protocol.

### Flow
```
SAM creates lead
  ↓
crm-sync.ts calls MCP tool: n8n_crm_sync_to_crm
  ↓
n8n-mcp.ts → N8N: POST /webhook/mcp/crm-sync-to-crm
  ↓
N8N Workflow executes:
  1. Get CRM connection from Supabase
  2. Switch on crm_type (hubspot/activecampaign/airtable)
  3. Map SAM fields → CRM fields
  4. HTTP Request to CRM API
  5. Call SAM: POST /api/crm/webhook/sync-complete
  6. Return MCP result
```

### Node Configuration

#### 1. MCP Server Trigger
- **Type**: `@n8n/n8n-nodes-langchain.mcpTrigger`
- **Tool Name**: `crm_sync_to_crm`
- **Tool Description**: `Sync a contact from SAM to connected CRM`
- **Parameters Schema**:
```json
{
  "workspace_id": {
    "type": "string",
    "description": "Workspace ID with active CRM connection",
    "required": true
  },
  "crm_type": {
    "type": "string",
    "enum": ["hubspot", "activecampaign", "airtable"],
    "description": "CRM type to sync to",
    "required": true
  },
  "action": {
    "type": "string",
    "enum": ["create", "update"],
    "description": "Action to perform",
    "required": true
  },
  "contact_data": {
    "type": "object",
    "description": "Contact information",
    "properties": {
      "firstName": { "type": "string" },
      "lastName": { "type": "string" },
      "email": { "type": "string" },
      "phone": { "type": "string" },
      "company": { "type": "string" },
      "jobTitle": { "type": "string" }
    },
    "required": true
  }
}
```

#### 2. Get CRM Connection (Postgres)
- **Type**: `n8n-nodes-base.postgres`
- **Operation**: `Execute Query`
- **Query**:
```sql
SELECT
  id,
  crm_type,
  access_token,
  refresh_token,
  crm_account_id
FROM crm_connections
WHERE workspace_id = '{{ $json.workspace_id }}'
  AND crm_type = '{{ $json.crm_type }}'
  AND status = 'active'
LIMIT 1;
```

#### 3. Get Field Mappings (Postgres)
- **Type**: `n8n-nodes-base.postgres`
- **Operation**: `Execute Query`
- **Query**:
```sql
SELECT
  sam_field,
  crm_field,
  is_required,
  is_custom
FROM crm_field_mappings
WHERE workspace_id = '{{ $json.workspace_id }}'
  AND crm_type = '{{ $json.crm_type }}'
  AND field_type = 'contact';
```

#### 4. Switch on CRM Type
- **Type**: `n8n-nodes-base.switch`
- **Mode**: `Rules`
- **Rules**:
  - **Rule 1**: `{{ $('Get CRM Connection').item.json.crm_type }}` equals `hubspot` → Output 0
  - **Rule 2**: `{{ $('Get CRM Connection').item.json.crm_type }}` equals `activecampaign` → Output 1
  - **Rule 3**: `{{ $('Get CRM Connection').item.json.crm_type }}` equals `airtable` → Output 2
  - **Fallback**: Output 3 (error)

#### 5a. HubSpot: Create/Update Contact
- **Type**: `n8n-nodes-base.httpRequest`
- **Method**: POST (for create) or PATCH (for update)
- **URL**:
  - Create: `https://api.hubapi.com/crm/v3/objects/contacts`
  - Update: `https://api.hubapi.com/crm/v3/objects/contacts/{{ $json.crm_contact_id }}`
- **Authentication**: `Generic Credential Type` → `OAuth2 API`
- **Headers**:
  - `Authorization`: `Bearer {{ $('Get CRM Connection').item.json.access_token }}`
  - `Content-Type`: `application/json`
- **Body** (JSON):
```json
{
  "properties": {
    "firstname": "{{ $json.contact_data.firstName }}",
    "lastname": "{{ $json.contact_data.lastName }}",
    "email": "{{ $json.contact_data.email }}",
    "phone": "{{ $json.contact_data.phone }}",
    "company": "{{ $json.contact_data.company }}",
    "jobtitle": "{{ $json.contact_data.jobTitle }}"
  }
}
```

#### 5b. ActiveCampaign: Create/Update Contact
- **Type**: `n8n-nodes-base.httpRequest`
- **Method**: POST
- **URL**: `{{ $('Get CRM Connection').item.json.crm_account_id }}/api/3/contact/sync`
- **Headers**:
  - `Api-Token`: `{{ $('Get CRM Connection').item.json.access_token }}`
  - `Content-Type`: `application/json`
- **Body** (JSON):
```json
{
  "contact": {
    "email": "{{ $json.contact_data.email }}",
    "firstName": "{{ $json.contact_data.firstName }}",
    "lastName": "{{ $json.contact_data.lastName }}",
    "phone": "{{ $json.contact_data.phone }}"
  }
}
```

#### 5c. Airtable: Create/Update Contact
- **Type**: `n8n-nodes-base.httpRequest`
- **Method**: POST (create) or PATCH (update)
- **URL**:
  - Create: `https://api.airtable.com/v0/{{ $('Get CRM Connection').item.json.crm_account_id }}/Contacts`
  - Update: `https://api.airtable.com/v0/{{ $('Get CRM Connection').item.json.crm_account_id }}/Contacts/{{ $json.crm_contact_id }}`
- **Headers**:
  - `Authorization`: `Bearer {{ $('Get CRM Connection').item.json.access_token }}`
  - `Content-Type`: `application/json`
- **Body** (JSON):
```json
{
  "fields": {
    "Name": "{{ $json.contact_data.firstName }} {{ $json.contact_data.lastName }}",
    "First Name": "{{ $json.contact_data.firstName }}",
    "Last Name": "{{ $json.contact_data.lastName }}",
    "Email": "{{ $json.contact_data.email }}",
    "Phone": "{{ $json.contact_data.phone }}",
    "Company": "{{ $json.contact_data.company }}",
    "Job Title": "{{ $json.contact_data.jobTitle }}"
  }
}
```

#### 6. Call SAM Sync Complete
- **Type**: `n8n-nodes-base.httpRequest`
- **Method**: POST
- **URL**: `{{ $env.SAM_API_URL }}/api/crm/webhook/sync-complete`
- **Headers**:
  - `Content-Type`: `application/json`
  - `x-n8n-webhook-secret`: `{{ $env.N8N_WEBHOOK_SECRET }}`
- **Body** (JSON):
```json
{
  "workspace_id": "{{ $json.workspace_id }}",
  "entity_type": "contact",
  "entity_id": "{{ $json.sam_contact_id }}",
  "crm_type": "{{ $json.crm_type }}",
  "status": "success",
  "crm_record_id": "{{ $json.id }}",
  "synced_at": "{{ $now }}"
}
```

#### 7. Return MCP Result (Tool Return Data)
- **Type**: `@n8n/n8n-nodes-langchain.toolReturnData`
- **Response** (Expression):
```javascript
{
  "success": true,
  "message": "Contact synced to CRM successfully",
  "workspace_id": "{{ $json.workspace_id }}",
  "crm_type": "{{ $json.crm_type }}",
  "crm_record_id": "{{ $json.id }}",
  "synced_at": "{{ $now }}"
}
```

---

## Workflow 2: CRM → SAM Scheduled Sync (Called by Netlify)

### Purpose
Fetches updated contacts from CRM and syncs to SAM. Triggered by Netlify cron every 15 minutes.

### Flow
```
Netlify Function (every 15 min)
  ↓
POST /api/cron/sync-crm-bidirectional
  ↓
Calls N8N: POST /webhook/mcp/crm-sync-from-crm
  ↓
N8N Workflow executes:
  1. Get workspace's CRM connection
  2. Switch on crm_type
  3. Fetch updated contacts from CRM API (since last_synced_at)
  4. Call SAM: POST /api/crm/webhook/sync-from-crm
  5. SAM detects conflicts and calls Workflow #3 if needed
```

### Node Configuration

#### 1. Webhook (MCP-like)
- **Type**: `n8n-nodes-base.webhook`
- **Path**: `/webhook/mcp/crm-sync-from-crm`
- **Method**: POST
- **Authentication**: `Header Auth` → Check for `X-N8N-API-KEY`
- **Response Mode**: `When Last Node Finishes`

#### 2. Get CRM Connection (Postgres)
- Same as Workflow 1, Node 2

#### 3. Switch on CRM Type
- Same as Workflow 1, Node 4

#### 4a. HubSpot: Fetch Updated Contacts
- **Type**: `n8n-nodes-base.httpRequest`
- **Method**: GET
- **URL**: `https://api.hubapi.com/crm/v3/objects/contacts/search`
- **Query Parameters**:
  - `properties`: `firstname,lastname,email,phone,company,jobtitle,lastmodifieddate`
  - `filterGroups[0][filters][0][propertyName]`: `lastmodifieddate`
  - `filterGroups[0][filters][0][operator]`: `GT`
  - `filterGroups[0][filters][0][value]`: `{{ $json.since_timestamp }}`
- **Headers**:
  - `Authorization`: `Bearer {{ $('Get CRM Connection').item.json.access_token }}`

#### 4b. ActiveCampaign: Fetch Updated Contacts
- **Type**: `n8n-nodes-base.httpRequest`
- **Method**: GET
- **URL**: `{{ $('Get CRM Connection').item.json.crm_account_id }}/api/3/contacts`
- **Query Parameters**:
  - `filters[updated_after]`: `{{ $json.since_timestamp }}`
- **Headers**:
  - `Api-Token`: `{{ $('Get CRM Connection').item.json.access_token }}`

#### 4c. Airtable: Fetch Updated Contacts
- **Type**: `n8n-nodes-base.httpRequest`
- **Method**: GET
- **URL**: `https://api.airtable.com/v0/{{ $('Get CRM Connection').item.json.crm_account_id }}/Contacts`
- **Query Parameters**:
  - `filterByFormula`: `IS_AFTER({Last Modified}, '{{ $json.since_timestamp }}')`
- **Headers**:
  - `Authorization`: `Bearer {{ $('Get CRM Connection').item.json.access_token }}`

#### 5. Transform Contacts (Code Node)
- **Type**: `n8n-nodes-base.code`
- **Mode**: `Run Once for All Items`
- **JavaScript**:
```javascript
// Transform CRM contacts to SAM format
const crmType = $('Get CRM Connection').item.json.crm_type;
const contacts = $input.all();

const transformedContacts = contacts.map(contact => {
  let transformed = {};

  if (crmType === 'hubspot') {
    transformed = {
      crm_id: contact.json.id,
      firstName: contact.json.properties?.firstname,
      lastName: contact.json.properties?.lastname,
      email: contact.json.properties?.email,
      phone: contact.json.properties?.phone,
      company: contact.json.properties?.company,
      jobTitle: contact.json.properties?.jobtitle,
      lastModified: contact.json.properties?.lastmodifieddate
    };
  } else if (crmType === 'activecampaign') {
    transformed = {
      crm_id: contact.json.id,
      firstName: contact.json.firstName,
      lastName: contact.json.lastName,
      email: contact.json.email,
      phone: contact.json.phone,
      lastModified: contact.json.udate
    };
  } else if (crmType === 'airtable') {
    transformed = {
      crm_id: contact.json.id,
      firstName: contact.json.fields['First Name'],
      lastName: contact.json.fields['Last Name'],
      email: contact.json.fields['Email'],
      phone: contact.json.fields['Phone'],
      company: contact.json.fields['Company'],
      jobTitle: contact.json.fields['Job Title'],
      lastModified: contact.json.fields['Last Modified']
    };
  }

  return { json: transformed };
});

return transformedContacts;
```

#### 6. Call SAM Webhook (HTTP Request)
- **Type**: `n8n-nodes-base.httpRequest`
- **Method**: POST
- **URL**: `{{ $env.SAM_API_URL }}/api/crm/webhook/sync-from-crm`
- **Headers**:
  - `Content-Type`: `application/json`
  - `x-n8n-webhook-secret`: `{{ $env.N8N_WEBHOOK_SECRET }}`
- **Body** (JSON):
```json
{
  "workspace_id": "{{ $('Webhook').item.json.workspace_id }}",
  "crm_type": "{{ $('Get CRM Connection').item.json.crm_type }}",
  "contacts": "{{ $json }}",
  "sync_type": "scheduled"
}
```

---

## Workflow 3: Conflict Resolution (MCP Tool)

### Purpose
Resolves conflicts when a contact is updated in both SAM and CRM since last sync.

### Node Configuration

#### 1. MCP Server Trigger
- **Type**: `@n8n/n8n-nodes-langchain.mcpTrigger`
- **Tool Name**: `crm_resolve_conflict`
- **Parameters**: workspace_id, crm_type, sam_record_id, crm_record_id, sam_data, crm_data

#### 2. Compare Timestamps (Code Node)
```javascript
const samData = $json.sam_data;
const crmData = $json.crm_data;

// Strategy: CRM wins by default
const winner = 'crm';
const winnerData = crmData;

return [{ json: { winner, winnerData, strategy: 'crm_wins' } }];
```

#### 3. Update SAM Contact (HTTP Request or Postgres)
- Updates SAM contact with CRM data

#### 4. Log Conflict Resolution (Postgres)
- Inserts record into `crm_conflict_resolutions` table

#### 5. Return MCP Result
- Returns resolution result

---

## Testing

### Test Workflow 1 (SAM → CRM)
```bash
curl -X POST https://n8n.innovareai.com/webhook/mcp/crm-sync-to-crm \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: your_api_key" \
  -d '{
    "workspace_id": "test-workspace-id",
    "crm_type": "hubspot",
    "action": "create",
    "contact_data": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    }
  }'
```

### Test Workflow 2 (CRM → SAM)
```bash
curl -X POST https://n8n.innovareai.com/webhook/mcp/crm-sync-from-crm \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: your_api_key" \
  -d '{
    "workspace_id": "test-workspace-id",
    "since_timestamp": "2025-12-01T00:00:00Z"
  }'
```

## Monitoring

### Netlify Function Logs
```bash
netlify functions:log sync-crm-bidirectional
```

### N8N Execution Logs
Check N8N UI → Executions → Filter by workflow name

## Cost Analysis

| Component | Calls/Month | Cost |
|-----------|-------------|------|
| Netlify: sync-crm-bidirectional | ~3,000 (every 15 min) | $0 (under 125k limit) |
| N8N Workflows | ~3,000 | $0 (self-hosted) |
| Supabase DB queries | ~6,000 | $0 (included in free tier) |
| **TOTAL** | | **$0/month** |

## Next Steps

1. Create the 3 workflows in N8N UI
2. Activate workflows
3. Test with a single workspace
4. Monitor Netlify logs for errors
5. Scale to all workspaces
