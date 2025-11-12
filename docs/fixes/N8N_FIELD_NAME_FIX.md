# N8N Workflow Field Name Fix

## Problem

N8N workflows are sending `camelCase` field names to SAM API webhooks, but SAM expects `snake_case`.

**Error:** `undefined, campaign_id: undefined [line 13, for item 0] (Missing required fields - prospect_id)`

## Root Cause

N8N nodes are configured to send:
- `campaignId` → should be `campaign_id`
- `prospectId` → should be `prospect_id`
- `workspaceId` → should be `workspace_id`

## Affected N8N Nodes

### 1. "Update Status - CR Sent" Node
**Location:** Campaign execution workflow
**Issue:** Sending `campaignId` instead of `campaign_id`

**Fix:**
1. Open N8N workflow: "SAM Master Campaign Orchestrator"
2. Find node: "Update Status - CR Sent"
3. Update HTTP Request body to use `snake_case`:

```json
{
  "campaign_id": "{{ $json.campaign_id }}",
  "prospect_id": "{{ $json.prospect_id }}",
  "workspace_id": "{{ $json.workspace_id }}",
  "status": "connection_requested",
  "contacted_at": "{{ $now.toISO() }}",
  "unipile_message_id": "{{ $json.unipile_message_id }}"
}
```

### 2. Main Campaign Execute Webhook
**Location:** Webhook trigger receiving from SAM
**Status:** ✅ FIXED (changed in execute-via-n8n route)

SAM now sends snake_case, so N8N receives:
- `campaign_id` ✅
- `workspace_id` ✅
- `unipile_account_id` ✅
- `prospects[].prospect_id` ✅

## All N8N Nodes to Update

Search for these patterns in ALL workflows and replace:

| OLD (camelCase) | NEW (snake_case) |
|-----------------|------------------|
| `campaignId` | `campaign_id` |
| `prospectId` | `prospect_id` |
| `workspaceId` | `workspace_id` |
| `unipileAccountId` | `unipile_account_id` |
| `linkedinUrl` | `linkedin_url` |
| `companyName` | `company_name` |
| `firstName` | `first_name` |
| `lastName` | `last_name` |

## Workflows to Check

1. **SAM Master Campaign Orchestrator** (ID: dsJ40aZYDOtSC1F7)
   - Update Status nodes
   - Callback nodes to SAM API

2. **Campaign Execute Workflow** (ID: aVG6LC4ZFRMN7Bw6) - DEPRECATED, deactivate

3. **Any webhook callbacks** to:
   - `/api/webhooks/n8n/campaign-status`
   - `/api/webhooks/n8n/linkedin-responses`
   - `/api/webhooks/n8n/email-responses`
   - `/api/webhooks/n8n/campaign-complete`
   - `/api/webhooks/n8n/campaign-error`

## Testing After Fix

1. Create test campaign with 1 prospect
2. Launch campaign
3. Check N8N execution logs - should NOT see "undefined" errors
4. Check SAM database - prospect status should update to "connection_requested"
5. Verify webhook callbacks succeed (HTTP 200 responses)

## Prevention

**N8N Convention:** Always use `snake_case` for field names when:
- Calling SAM API endpoints
- Sending webhook callbacks to SAM
- Storing data in Supabase (which uses snake_case)

**Only use camelCase** for:
- Internal N8N variables
- JavaScript code within N8N nodes
