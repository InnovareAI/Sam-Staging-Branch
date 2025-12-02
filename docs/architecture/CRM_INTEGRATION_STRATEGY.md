# CRM Integration Strategy

## Overview

SAM AI's CRM integration uses a hybrid approach combining:
1. **Direct MCP Adapters** for core CRMs (HubSpot, ActiveCampaign, Airtable)
2. **N8N MCP Server Node** for broader CRM ecosystem coverage

## Architecture

```
SAM AI
  ├── MCP Registry
  │   ├── CRM MCP Server (Direct adapters)
  │   │   ├── HubSpot Adapter
  │   │   ├── ActiveCampaign Adapter
  │   │   └── Airtable Adapter
  │   └── N8N MCP Server (400+ app integrations)
  │       ├── Salesforce
  │       ├── Pipedrive
  │       ├── Zoho
  │       ├── Monday.com
  │       ├── Copper
  │       └── ... 395+ more
  └── CRM Sync Service
      └── Routes to appropriate integration
```

## Current Implementation

### Direct MCP Adapters (Tier 1)
**Status:** ✅ Complete
**CRMs:** HubSpot, ActiveCampaign, Airtable

**Benefits:**
- Full control over implementation
- Optimized for SAM AI use cases
- Custom field mappings
- Better error handling
- Direct OAuth integration

**Files:**
- `mcp-crm-server/src/adapters/hubspot.ts`
- `mcp-crm-server/src/adapters/activecampaign.ts`
- `mcp-crm-server/src/adapters/airtable.ts`
- `lib/mcp/crm-mcp.ts` (MCP wrapper)
- `lib/services/crm-sync.ts` (Sync service)

### Legacy Direct API (Tier 2)
**Status:** 🟡 Maintenance mode
**CRMs:** Salesforce, Pipedrive, Zoho, Keap, Close, Copper, Freshsales

**Implementation:** Direct fetch() calls in `crm-sync.ts`

**Migration path:** Move to N8N MCP Server

## N8N MCP Server Node Strategy

### What is N8N MCP Server?
N8N recently released an MCP (Model Context Protocol) server node that exposes N8N workflows as MCP tools. This allows AI agents like Claude to trigger N8N workflows.

### How It Works

1. **Create N8N Workflow** for CRM operation (e.g., "Create Contact in Salesforce")
2. **Expose via MCP Server Node** in N8N
3. **SAM AI calls MCP tool** via `mcpRegistry.callTool()`
4. **N8N executes workflow** using its native Salesforce node
5. **Returns result** back to SAM AI

### Benefits

**Massive CRM Coverage:**
- 400+ pre-built integrations in N8N
- No custom adapter code needed
- Visual workflow builder for complex logic

**Popular CRMs Available:**
- Salesforce
- Pipedrive
- Zoho CRM
- Monday.com
- Copper
- Freshsales
- Microsoft Dynamics
- SugarCRM
- Insightly
- Nutshell
- Agile CRM
- Bitrix24
- And 380+ more apps

**Reduced Development Time:**
- Reuse N8N's battle-tested integrations
- No OAuth implementation per CRM
- Visual debugging with N8N UI

**Flexibility:**
- Add custom business logic in workflows
- Combine multiple systems in one sync
- Easy A/B testing of sync strategies

### Implementation Plan

#### Phase 1: Setup N8N MCP Server
```bash
# Already have N8N server configured
# Add MCP Server node to existing N8N instance
```

#### Phase 2: Create CRM Workflows
For each CRM, create standardized workflows:

**Workflow: "crm_create_contact_{crm_name}"**
- Input: Contact data (firstName, lastName, email, etc.)
- Process: Map fields to CRM format
- Action: Create contact in CRM
- Output: Contact ID and success status

**Workflow: "crm_create_deal_{crm_name}"**
- Input: Deal data (name, amount, stage, contactId)
- Process: Map fields and associations
- Action: Create deal/opportunity
- Output: Deal ID and success status

#### Phase 3: Update MCP Registry
```typescript
// Add N8N CRM tools to registry
const n8nCRMTools = [
  'crm_create_contact_salesforce',
  'crm_create_contact_pipedrive',
  'crm_create_deal_salesforce',
  // ... etc
];
```

#### Phase 4: Update CRM Sync Service
```typescript
// Route to N8N for tier 2 CRMs
if (n8nSupportedCRMs.includes(connection.crm_type)) {
  result = await syncViaN8N(workspaceId, connection.crm_type, lead);
}
```

### Example: Adding Salesforce via N8N

**Before (100+ lines of code):**
```typescript
async function syncToSalesforce(connection, lead, mappings) {
  const accessToken = connection.access_token;
  const instanceUrl = connection.crm_account_id;

  const sfLead = {
    FirstName: lead.firstName,
    // ... manual field mapping
  };

  const response = await fetch(`${instanceUrl}/services/data/v58.0/sobjects/Lead`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    body: JSON.stringify(sfLead)
  });

  // ... error handling, token refresh, etc.
}
```

**After (N8N workflow + 10 lines):**
```typescript
async function syncViaN8N(workspaceId, crmType, lead) {
  return await mcpRegistry.callTool({
    method: 'tools/call',
    params: {
      name: `crm_create_contact_${crmType}`,
      arguments: {
        workspace_id: workspaceId,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        // N8N handles mapping, auth, and API calls
      }
    }
  });
}
```

### Migration Roadmap

**Q1 2025:**
- ✅ Complete Tier 1 CRMs (HubSpot, ActiveCampaign, Airtable)
- 🎯 Setup N8N MCP Server integration
- 🎯 Migrate Salesforce to N8N
- 🎯 Migrate Pipedrive to N8N

**Q2 2025:**
- Migrate remaining Tier 2 CRMs to N8N
- Add 10+ new CRMs via N8N (Zoho, Monday, Copper)
- Remove legacy direct API code

**Q3 2025:**
- Add advanced sync features (bi-directional, field mapping UI)
- Implement sync conflict resolution
- Add bulk operations

## Environment Variables

### Direct MCP Adapters
```bash
# HubSpot
HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_client_secret
HUBSPOT_REDIRECT_URI=https://yourdomain.com/api/crm/oauth/callback

# ActiveCampaign
ACTIVECAMPAIGN_CLIENT_ID=your_client_id
ACTIVECAMPAIGN_CLIENT_SECRET=your_client_secret
ACTIVECAMPAIGN_REDIRECT_URI=https://yourdomain.com/api/crm/oauth/callback
ACTIVECAMPAIGN_ACCOUNT=your-account-name

# Airtable
AIRTABLE_CLIENT_ID=your_client_id
AIRTABLE_CLIENT_SECRET=your_client_secret
AIRTABLE_REDIRECT_URI=https://yourdomain.com/api/crm/oauth/callback
```

### N8N Integration
```bash
# N8N MCP Server (already configured)
N8N_API_BASE_URL=https://your-n8n-instance.com
N8N_API_KEY=your_n8n_api_key
```

## Database Schema

### crm_connections
Stores OAuth credentials and connection status for each workspace-CRM pair.

```sql
CREATE TABLE crm_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  crm_type TEXT NOT NULL, -- 'hubspot', 'activecampaign', 'airtable', etc.
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT[],
  crm_account_id TEXT, -- CRM-specific account identifier
  crm_account_name TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'expired', 'error'
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, crm_type)
);
```

### crm_field_mappings
Maps SAM AI fields to CRM-specific fields.

```sql
CREATE TABLE crm_field_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  crm_type TEXT NOT NULL,
  field_type TEXT NOT NULL, -- 'contact', 'company', 'deal'
  sam_field TEXT NOT NULL, -- 'firstName', 'email', etc.
  crm_field TEXT NOT NULL, -- CRM-specific field name
  data_type TEXT, -- 'string', 'number', 'date', etc.
  is_required BOOLEAN DEFAULT false,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, crm_type, field_type, sam_field)
);
```

### crm_sync_logs
Tracks all sync operations for monitoring and debugging.

```sql
CREATE TABLE crm_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  connection_id UUID REFERENCES crm_connections(id),
  sync_type TEXT, -- 'campaign', 'manual', 'bulk'
  entity_type TEXT, -- 'contact', 'company', 'deal'
  operation TEXT, -- 'create', 'update', 'delete'
  status TEXT, -- 'success', 'failed', 'partial'
  records_processed INTEGER,
  records_succeeded INTEGER,
  records_failed INTEGER,
  error_details JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Testing

### Unit Tests
```bash
# Test MCP adapters
npm test mcp-crm-server/src/adapters/

# Test sync service
npm test lib/services/crm-sync.test.ts
```

### Integration Tests
```bash
# Test OAuth flow
npm test tests/integration/crm-oauth.test.ts

# Test end-to-end sync
npm test tests/integration/crm-sync-e2e.test.ts
```

### Manual Testing Checklist
- [ ] OAuth connection works for each CRM
- [ ] Contact creation syncs correctly
- [ ] Deal/opportunity creation works
- [ ] Field mappings apply correctly
- [ ] Error handling and retry logic works
- [ ] Sync logs are recorded
- [ ] Token refresh works for expired tokens

## Monitoring

### Key Metrics
- Sync success rate per CRM
- Average sync latency
- Failed syncs requiring manual intervention
- OAuth token expiry/refresh rate

### Alerts
- Sync failure rate > 5%
- OAuth token expiration within 24 hours
- CRM API rate limit warnings

## Support Matrix

| CRM | Integration | Status | OAuth | Field Mapping | Bi-directional |
|-----|------------|--------|-------|---------------|----------------|
| HubSpot | Direct MCP | ✅ Production | ✅ | ✅ | 🎯 Planned |
| ActiveCampaign | Direct MCP | ✅ Production | ✅ | ✅ | 🎯 Planned |
| Airtable | Direct MCP | ✅ Production | ✅ | ✅ | ❌ |
| Salesforce | N8N (planned) | 🎯 Q1 2025 | ✅ | ✅ | 🎯 Planned |
| Pipedrive | N8N (planned) | 🎯 Q1 2025 | ✅ | ✅ | 🎯 Planned |
| Zoho CRM | N8N (planned) | 🎯 Q2 2025 | ✅ | ✅ | 🎯 Planned |
| Monday.com | N8N (planned) | 🎯 Q2 2025 | ✅ | ✅ | ❌ |
| Copper | N8N (planned) | 🎯 Q2 2025 | ✅ | ✅ | ❌ |

## Resources

- [N8N MCP Server Documentation](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.mcpserver/)
- [MCP CRM Server Source](../mcp-crm-server/)
- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [SAM AI MCP Registry](../../lib/mcp/mcp-registry.ts)

## Next Steps

1. **Test current implementation** with HubSpot, ActiveCampaign, and Airtable
2. **Set up N8N MCP Server** integration
3. **Create first N8N CRM workflow** (Salesforce contact creation)
4. **Migrate Tier 2 CRMs** from direct API to N8N
5. **Add 10+ new CRMs** leveraging N8N's integrations
