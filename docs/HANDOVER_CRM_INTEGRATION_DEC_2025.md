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

## Session Update: December 2, 2025

### What Was Built Today

**CRM Integrations UI Page**
- Created `/app/integrations/crm/page.tsx` - User-facing CRM connections page
- Features:
  - Lists all available CRM platforms (HubSpot, ActiveCampaign, Airtable)
  - Shows connection status (connected/not connected)
  - Displays connected account details (name, connected date, sync status)
  - Real-time refresh capability
  - Error handling with user-friendly messages

**ActiveCampaign API Key Authentication**
- Created `/app/api/crm/connect/activecampaign/route.ts`
- Uses API key authentication instead of OAuth (simpler user flow)
- Dialog-based connection:
  - User enters account URL (e.g., `https://accountname.api-us1.com`)
  - User enters API key from ActiveCampaign settings
  - Validates credentials with test API call before saving
  - Stores in `crm_connections` table with `access_token = api_key`
- Creates default field mappings automatically on connection

**OAuth Flow Updates**
- Updated `/app/api/crm/oauth/initiate/route.ts`:
  - Added backend block for ActiveCampaign (returns error if called)
  - Removed ActiveCampaign OAuth case (uses API key instead)
- Updated `/app/api/crm/oauth/callback/route.ts`:
  - Fixed redirects to use `/integrations/crm` instead of `/workspace`
  - Added Airtable OAuth support
  - Improved error handling and user feedback

**N8N Workflows (Already Deployed)**
- Workflow 1 (SAM → CRM): ID `O73jiEhOqK90Lm1m`
- Workflow 2 (CRM → SAM): ID `BDunCkeki5EdQs5L`
- Webhook URLs:
  - `/webhook/crm-sync-to-crm` - Push contacts from SAM to CRM
  - `/webhook/crm-sync-from-crm` - Pull contacts from CRM to SAM
- Uses HTTP Request + Switch nodes (scalable to all CRMs)

### Updated File Structure

```
app/
├── integrations/
│   └── crm/
│       └── page.tsx          ← NEW: User-facing CRM connections page
├── api/
│   └── crm/
│       ├── oauth/
│       │   ├── initiate/
│       │   │   └── route.ts  ← UPDATED: Block ActiveCampaign OAuth
│       │   └── callback/
│       │       └── route.ts  ← UPDATED: Fixed redirects, added Airtable
│       └── connect/
│           └── activecampaign/
│               └── route.ts  ← NEW: API key authentication

n8n-workflows/
├── workflow-1-sam-to-crm.json    ← DEPLOYED
└── workflow-2-crm-to-sam.json    ← DEPLOYED

scripts/shell/
└── deploy-n8n-workflows.sh       ← NEW: N8N deployment script
```

### Database Schema (No Changes)

Existing tables used:
- `crm_connections` - Stores ActiveCampaign API key in `access_token` field
- `crm_field_mappings` - Default mappings created on connection
- `workspace_members` - Verifies user has owner/admin role

### User Flow: Connect ActiveCampaign

1. User navigates to `/integrations/crm`
2. Clicks "Connect" button on ActiveCampaign card
3. Dialog opens requesting:
   - Account URL: `https://[account].api-us1.com`
   - API Key: from Settings → Developer → API Access
4. Backend validates credentials with test call to `/api/3/users/me`
5. If valid:
   - Saves connection to `crm_connections` table
   - Creates default field mappings
   - Shows success message
6. Page displays connected account with:
   - Account name
   - Connected date
   - Active status badge

### Current Blocker

**Browser Cache Issue:**
- Frontend check `if (crmType === 'activecampaign')` exists in code
- Browser may have cached old version
- Solution: Hard refresh (Cmd+Shift+R) or incognito mode
- Backend now blocks ActiveCampaign OAuth as safety measure

### Implementation Status Updates

| Component | Status Before | Status After |
|-----------|--------------|--------------|
| ActiveCampaign Connection | ❌ Not built | ✅ Built - API key auth |
| CRM Integrations UI | ❌ Not built | ✅ Built - Full page |
| N8N Bi-directional Sync | ⚠️ Planned | ✅ Deployed - 2 workflows |
| OAuth Callback Redirects | ⚠️ Wrong page | ✅ Fixed - `/integrations/crm` |
| Airtable OAuth | ❌ Not built | ✅ Built - OAuth ready |

### Known Issues

1. **Browser Cache:**
   - ActiveCampaign may still trigger OAuth in cached browser
   - Solution: Clear cache or use incognito
   - Backend blocks it as safety measure

2. **OAuth Apps Not Configured:**
   - HubSpot and Airtable will show "undefined" env vars if clicked
   - Only ActiveCampaign works immediately (API key auth)
   - Other CRMs require OAuth app setup

### Next Steps

1. **Immediate:**
   - User should test ActiveCampaign connection with real credentials
   - Verify data flows through N8N webhooks
   - Test bi-directional sync works end-to-end

2. **Short Term:**
   - Configure HubSpot OAuth app (CLIENT_ID, CLIENT_SECRET)
   - Configure Airtable OAuth app
   - Test OAuth flow for these platforms

3. **Medium Term:**
   - Add sync status indicators to UI
   - Build sync logs viewer
   - Add manual sync trigger button

---

## Session Update: December 2, 2025 (Part 2)

### Critical Fix: Remove linkedin_accounts Table

**Problem Discovered:**
- Health check was failing with "UnknownError" for LinkedIn accounts
- Root cause: Code was querying `linkedin_accounts` table in Supabase
- **Reality**: LinkedIn accounts are NOT stored in Supabase - they're in Unipile external service

**What Was Fixed:**

1. **Dropped linkedin_accounts Table**
   - Created migration: `/supabase/migrations/20251202_drop_linkedin_accounts_table.sql`
   - Table was unused/obsolete - all LinkedIn data lives in Unipile

2. **Updated 3 API Routes to Use Unipile API**
   - [app/api/prospects/linkedin-search/route.ts:55-86](app/api/prospects/linkedin-search/route.ts#L55-L86) - Get accounts from Unipile API
   - [app/api/agents/qa-monitor/route.ts:543-614](app/api/agents/qa-monitor/route.ts#L543-L614) - Check LinkedIn health via Unipile API
   - [app/api/agents/rate-limit-monitor/route.ts:46-86](app/api/agents/rate-limit-monitor/route.ts#L46-L86) - Fetch accounts from Unipile API

3. **Fixed daily-campaign-summary Route**
   - Changed from joining `send_queue` → `linkedin_accounts` → `workspace_id`
   - Now joins `send_queue` → `campaigns` → `workspace_id`
   - [app/api/agents/daily-campaign-summary/route.ts:70-80](app/api/agents/daily-campaign-summary/route.ts#L70-L80)

4. **Fixed 27 Stale Prospects**
   - Created SQL script: [scripts/sql/fix-stale-prospects.sql](scripts/sql/fix-stale-prospects.sql)
   - Updated prospects stuck >3 days in `pending` status to `failed`
   - All 27 prospects successfully updated

5. **Fixed fix-health-issues Endpoint**
   - Changed status from `skipped` (invalid) to `failed` (valid)
   - [app/api/agents/fix-health-issues/route.ts:61-70](app/api/agents/fix-health-issues/route.ts#L61-L70)

**Architecture Clarification:**
```
LinkedIn Accounts Storage:
✅ Unipile External Service (GET https://{UNIPILE_DSN}/api/v1/accounts)
❌ Supabase linkedin_accounts table (DROPPED)

Access Pattern:
1. Call Unipile API
2. Filter: accounts.filter(acc => acc.type === 'LINKEDIN')
3. Check status: acc.sources?.some(s => s.status !== 'OK')
```

**Valid campaign_prospects Statuses:**
- pending, approved, ready_to_message, queued, queued_in_n8n
- contacted, connection_requested, connection_request_sent
- not_connected, invitation_withdrawn, connected, messaging
- replied, not_interested, failed, error
- already_invited, invitation_declined, rate_limited, email_sent

**Implementation Status Updates:**

| Component | Status Before | Status After |
|-----------|--------------|--------------|
| Health Check LinkedIn Accounts | ❌ Querying wrong table | ✅ Uses Unipile API |
| LinkedIn Account Retrieval | ❌ Database queries | ✅ Unipile API calls |
| Stale Prospects | ⚠️ 27 stuck >3 days | ✅ All fixed (marked failed) |
| daily-campaign-summary | ❌ Broken table join | ✅ Fixed via campaigns |

---

**Last Updated:** December 2, 2025
**Author:** Claude Code
