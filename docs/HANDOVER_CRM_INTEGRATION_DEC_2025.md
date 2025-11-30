# Handover Document - CRM Integration Strategy

**Date:** December 1, 2025
**Topic:** CRM Integration Tiers & SAM CRM Manager Upsell

---

## Executive Summary

CRM integration is split into two product tiers:
1. **V1 (Basic):** One-way sync to simple tools - included in all plans
2. **V2 (Upsell):** Full CRM Manager - paid add-on for SME/Enterprise

**User Experience:** Connect CRM once via OAuth → SAM handles everything automatically.

---

## Product Tiers

### V1 - Basic CRM Sync (All Tiers)

**What it does:**
- One-way sync: SAM → CRM
- When prospect replies "interested" → auto-create contact in CRM
- Simple, no user configuration required

**Supported Platforms:**
| Platform | Status | Notes |
|----------|--------|-------|
| Google Sheets | Placeholder | TODO: Implement |
| Airtable | Placeholder | TODO: Implement |
| ActiveCampaign | ✅ Built | Popular with small businesses |

**Target Market:** Startups, small businesses, users without dedicated CRM

**Already Built:**
- Sync service: `lib/services/crm-sync.ts` (918 lines)
- Triggered on "interested" reply: `app/api/webhooks/unipile-messages/route.ts` (lines 201-225)

---

### V2 - CRM Manager (Paid Add-on: SME/Enterprise)

**What it does:**
- Bi-directional sync (SAM ↔ CRM)
- SAM pulls prospects from CRM lists → runs campaigns
- Auto-dedupe before outreach
- Auto-update deal stages based on campaign results
- Auto-create deals when leads are interested
- Full autonomous CRM management

**Supported Platforms:**
| Platform | Priority | Market |
|----------|----------|--------|
| HubSpot | P0 | SMB → Enterprise (80% market share) |
| Salesforce | P0 | Enterprise |
| Pipedrive | P1 | SMB/SME, sales-focused |
| Zoho CRM | P2 | International markets |
| Close | P2 | SMB |
| Freshsales | P3 | Growing market |

**Target Market:** SME/Enterprise customers who:
- Already have a CRM
- Want SAM to manage it autonomously
- Will pay premium for automation

---

## Current Implementation Status

### What's Built

| Component | Location | Status |
|-----------|----------|--------|
| OAuth Flow (11 CRMs) | `app/api/crm/oauth/*` | ✅ Production |
| Credentials Storage | `crm_connections` table | ✅ Production |
| Field Mappings | `crm_field_mappings` table | ✅ Production |
| Sync Logs | `crm_sync_logs` table | ✅ Production |
| Sync Service | `lib/services/crm-sync.ts` | ✅ 10 CRMs |
| UI Modal | `app/components/CRMIntegrationModal.tsx` | ✅ Production |
| MCP CRM Server | `mcp-crm-server/src/tools/index.ts` | ✅ 19 tools defined |
| Base Adapter | `mcp-crm-server/src/adapters/base.ts` | ✅ Built |

### What's NOT Built (For V2 Upsell)

| Component | Required For | Effort |
|-----------|--------------|--------|
| CRM MCP in Registry | SAM to call CRM tools | 2h |
| CRM detection in SAM handler | Natural language CRM commands | 4h |
| Bi-directional sync cron | CRM → SAM sync | 6h |
| Campaign trigger from CRM lists | Run campaigns from CRM | 4h |
| Dedupe before outreach | Check CRM before sending | 4h |
| HubSpot adapter completion | Full CRUD operations | 4h |
| Salesforce adapter | Full CRUD operations | 4h |

---

## Architecture

### V1 Flow (One-Way Sync)

```
Prospect Replies "Interested"
         │
         ▼
┌─────────────────────┐
│ Unipile Webhook     │
│ Intent Classifier   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ syncInterestedLead  │
│ ToCRM()             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ CRM API             │
│ (Create Contact)    │
└─────────────────────┘
```

### V2 Flow (Full CRM Manager)

```
┌──────────────────────────────────────────────────────────┐
│                  SAM CRM MANAGER                          │
└──────────────────────────────────────────────────────────┘

User: "Connect HubSpot" (one-time)
           │
           ▼
    ┌──────────────┐
    │ OAuth Flow   │──────► crm_connections table
    └──────────────┘

Then SAM automatically:

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Sync CRM → SAM  │     │ Dedupe Before   │     │ Update CRM      │
│ (pull contacts) │     │ Outreach        │     │ (deal stages)   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   SAM MCP Handler      │
                    │   (CRM Tools: 19)      │
                    └────────────┬───────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
        ┌──────────┐      ┌──────────┐      ┌──────────┐
        │ HubSpot  │      │Salesforce│      │ Pipedrive│
        │ Adapter  │      │ Adapter  │      │ Adapter  │
        └──────────┘      └──────────┘      └──────────┘
```

---

## MCP CRM Tools Available

The MCP CRM server defines 19 tools for SAM to use:

**Contact Operations:**
- `crm_get_contacts` - List contacts with filters
- `crm_get_contact` - Get single contact by ID
- `crm_create_contact` - Create new contact
- `crm_update_contact` - Update existing contact
- `crm_delete_contact` - Delete contact
- `crm_search_contacts` - Search by query

**Company Operations:**
- `crm_get_companies` - List companies
- `crm_get_company` - Get single company
- `crm_create_company` - Create company
- `crm_update_company` - Update company
- `crm_delete_company` - Delete company
- `crm_search_companies` - Search companies

**Deal Operations:**
- `crm_get_deals` - List deals with filters
- `crm_get_deal` - Get single deal
- `crm_create_deal` - Create deal
- `crm_update_deal` - Update deal (change stage, amount, etc.)
- `crm_delete_deal` - Delete deal

**Configuration:**
- `crm_get_available_fields` - Get CRM schema
- `crm_get_field_mappings` - Get SAM ↔ CRM field mappings
- `crm_set_field_mapping` - Configure field mappings

---

## Implementation Priority

### Phase 1: V1 Completion (Basic Sync)
1. Complete Google Sheets adapter
2. Complete Airtable adapter
3. Verify ActiveCampaign works end-to-end
4. **Effort:** ~12h

### Phase 2: V2 Foundation (CRM Manager)
1. Wire CRM MCP Server to Registry
2. Add CRM detection to SAM handler
3. Complete HubSpot adapter (full CRUD)
4. Test: "Add contact to HubSpot" via SAM conversation
5. **Effort:** ~14h

### Phase 3: V2 Automation
1. Bi-directional sync cron job
2. Dedupe before campaign outreach
3. Auto-update deal stages on campaign events
4. Pull CRM lists → create campaigns
5. **Effort:** ~18h

### Phase 4: Expand CRMs
1. Salesforce adapter
2. Pipedrive adapter
3. **Effort:** ~8h

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/services/crm-sync.ts` | One-way sync service (V1) |
| `mcp-crm-server/src/tools/index.ts` | MCP tool definitions (19 tools) |
| `mcp-crm-server/src/adapters/base.ts` | Base adapter interface |
| `app/components/CRMIntegrationModal.tsx` | UI for connecting CRMs |
| `app/api/crm/oauth/*` | OAuth flow endpoints |
| `lib/mcp/mcp-registry.ts` | MCP server registry (needs CRM added) |
| `lib/sam-mcp-handler.ts` | SAM conversation handler (needs CRM detection) |

---

## Database Schema

```sql
-- CRM connections (OAuth tokens)
crm_connections (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  crm_type VARCHAR(50),  -- 'hubspot', 'salesforce', etc.
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  instance_url TEXT,     -- For Salesforce
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Field mappings (SAM field → CRM field)
crm_field_mappings (
  id UUID PRIMARY KEY,
  connection_id UUID REFERENCES crm_connections(id),
  sam_field VARCHAR(100),
  crm_field VARCHAR(100),
  field_type VARCHAR(50),  -- 'contact', 'company', 'deal'
  is_required BOOLEAN DEFAULT false
)

-- Sync logs (audit trail)
crm_sync_logs (
  id UUID PRIMARY KEY,
  connection_id UUID REFERENCES crm_connections(id),
  sync_type VARCHAR(50),   -- 'contact_created', 'deal_updated', etc.
  record_id TEXT,          -- CRM record ID
  status VARCHAR(50),      -- 'success', 'error'
  error_message TEXT,
  created_at TIMESTAMPTZ
)
```

---

## Pricing Consideration

| Tier | CRM Feature | Suggested Positioning |
|------|-------------|----------------------|
| Startup ($99) | Basic sync to Sheets/Airtable/ActiveCampaign | Included |
| SME ($399) | + CRM Manager for HubSpot/Pipedrive | Add-on: +$99/mo |
| Enterprise ($899) | + CRM Manager for Salesforce | Add-on: +$199/mo |

---

## Next Steps

1. **Immediate:** Verify ActiveCampaign sync works end-to-end
2. **Week 1:** Complete Google Sheets + Airtable adapters (V1)
3. **Week 2-3:** Wire CRM MCP to SAM, complete HubSpot adapter (V2)
4. **Week 4:** Bi-directional sync, dedupe, deal automation

---

## Notes

- User experience is key: Connect once → SAM handles everything
- Don't over-engineer V1 - simple one-way sync is enough
- V2 (CRM Manager) is the upsell - full autonomous management
- Start with HubSpot + Salesforce for V2 - 80% of enterprise market

---

**Last Updated:** December 1, 2025
**Author:** Claude Code
