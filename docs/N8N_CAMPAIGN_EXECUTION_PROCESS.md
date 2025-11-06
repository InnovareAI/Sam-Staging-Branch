# N8N Campaign Execution Process

**Date:** November 7, 2025
**Status:** ✅ FULLY AUTOMATED - Campaigns Execute on Approval

---

## 🎯 Overview

The system has a complete N8N campaign execution infrastructure that **automatically executes campaigns** when users click "Approve Campaign" in the campaign modal. No manual buttons or triggers needed beyond campaign approval.

---

## 📋 Automated Process Flow

### 1. Campaign Creation (AUTOMATED ✅)
```
User Action → Campaign Modal Opens
           → User fills in campaign details
           → User uploads prospects CSV
```

### 2. Campaign Approval (AUTOMATED ✅)
```
User Clicks "Approve Campaign" → Campaign Created (status: "inactive")
                               → Prospects Uploaded (status: "approved")
                               → N8N Execution Triggered AUTOMATICALLY
                               → No further user action needed!
```

### 3. Campaign Execution (AUTOMATED ✅)
```
Automatic Trigger → /api/campaigns/linkedin/execute-via-n8n
                  → Fetches prospects with status: pending/approved/ready_to_message
                  → Sends to N8N webhook
                  → N8N workflow processes prospects
                  → Messages sent via Unipile
                  → Status updates to "connection_requested"
```

---

## 🔧 N8N Workflows Found (Last 3 Days)

### 1. **Prospect Enrichment Workflow**
- **File:** `n8n-workflows/prospect-enrichment-workflow-fixed.json`
- **Purpose:** Enriches prospects with email/phone from BrightData LinkedIn scraping
- **Webhook:** `https://workflows.innovareai.com/webhook/prospect-enrichment`
- **Status:** Imported (Workflow ID: MlOCPY7qzZ2nEuue)
- **Table:** `prospect_approval_data`

### 2. **Campaign Execute Workflow**
- **File:** `n8n-workflows/campaign-execute-complete-with-reply-stop.json`
- **Purpose:** Executes LinkedIn campaigns with reply detection
- **Webhook:** `https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed`
- **Status:** Ready to use

### 3. **SAM LinkedIn Campaign V2**
- **File:** `n8n-workflows/sam-linkedin-campaign-v2.json`
- **Purpose:** LinkedIn campaign orchestration
- **Status:** Available

### 4. **Reply Agent HITL Sender**
- **File:** `n8n-workflows/reply-agent-hitl-sender.json`
- **Purpose:** Human-in-the-loop approval for replies
- **Status:** Available

---

## 🚀 How Campaign Execution Works

### API Endpoint
```
POST /api/campaigns/linkedin/execute-via-n8n

Body:
{
  "campaignId": "e9e0c2d1-311c-4d0e-b9ac-2b7898226835",
  "workspaceId": "babdcab8-1a78-4b2f-913e-6e9fd9821009",
  "executionType": "direct_linkedin"  // Optional
}
```

### Process Steps

1. **Validate User Access**
   - Check workspace membership
   - Verify campaign belongs to workspace

2. **Get Workspace Tier**
   - Fetch from `workspace_tiers` table
   - Tiers: startup (default), sme, enterprise
   - Different limits per tier

3. **Check Monthly Limits**
   - Email limit (default: 200/month)
   - LinkedIn limit (default: 50/month)
   - Active campaigns limit (default: 5)

4. **Fetch Campaign & Prospects**
   ```sql
   SELECT * FROM campaigns WHERE id = ? AND workspace_id = ?
   JOIN campaign_prospects WHERE status IN ('pending', 'approved', 'ready_to_message')
   ```

5. **Apply Daily Limits**
   - Takes first N prospects (based on tier daily limit)
   - Default: 20 LinkedIn messages/day

6. **Create Execution Record**
   - Insert into `n8n_campaign_executions` table
   - Status: 'initializing'

7. **Send to N8N Webhook**
   ```javascript
   POST https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed
   Headers:
     - X-SAM-Workspace-ID
     - X-SAM-Campaign-ID
     - X-SAM-Execution-ID
   Body:
     - workspace_tier
     - channel_preferences
     - prospects array
     - message_templates
     - hitl_config
   ```

8. **N8N Processes**
   - Sends connection requests via Unipile
   - Updates prospect status to 'connection_requested'
   - Sets `contacted_at` timestamp

---

## ✅ Automation Implementation (COMPLETED)

**Solution Implemented:** Automatic execution in `handleApproveCampaign` function

**How It Works:**
1. User clicks "Approve Campaign" in campaign modal
2. Campaign created with status: "inactive"
3. Prospects uploaded with status: "approved"
4. System automatically calls `/api/campaigns/linkedin/execute-via-n8n`
5. N8N workflow processes all approved prospects
6. User sees success/error message immediately

**Code Location:** `app/components/CampaignHub.tsx` (lines 4487-4514)

**Key Changes:**
- Removed LinkedIn ID requirement (now optional)
- Changed condition from `if (totalProspectsWithIds > 0)` to `if (mappedProspects.length > 0)`
- Added proper error handling and user feedback
- Removed 90+ lines of duplicate conditional logic

**User Experience:**
```
Before: User approves → Campaign created → User manually clicks "Execute" → Campaign runs
After:  User approves → Campaign created → Campaign AUTOMATICALLY executes → Done!
```

---

## 🔍 Database Tables Involved

### `campaigns`
```sql
- id (PK)
- workspace_id (FK)
- name
- status ('inactive', 'active', 'paused', 'completed')
- campaign_type ('connector', 'messenger', 'linkedin_outreach')
- message_templates (JSONB)
- daily_limit (INT)
- n8n_workflow_id (TEXT) -- Currently NOT SET
- n8n_execution_id (TEXT) -- Currently NOT SET
```

### `campaign_prospects`
```sql
- id (PK)
- campaign_id (FK)
- workspace_id (FK)
- first_name, last_name, email
- company_name, title, linkedin_url
- linkedin_user_id (TEXT) -- From Unipile
- status ('pending', 'approved', 'ready_to_message', 'connection_requested', 'connected')
- contacted_at (TIMESTAMP)
- personalization_data (JSONB)
```

### `n8n_campaign_executions`
```sql
- id (PK)
- workspace_id (FK)
- campaign_name
- campaign_type
- campaign_config (JSONB)
- execution_status ('initializing', 'running', 'completed', 'failed')
- n8n_execution_id (TEXT)
- prospects_processed (INT)
- messages_sent (INT)
- replies_received (INT)
- channel_specific_metrics (JSONB)
```

---

## 🎯 Testing & Verification

1. **Test Campaign Creation**
   - Create new campaign in UI
   - Upload prospects CSV
   - Click "Approve Campaign"
   - Verify success message includes "Campaign sent to N8N for execution"

2. **Check Campaign Execution**
   - Check `campaign_prospects` table for `contacted_at` timestamps
   - Check `n8n_campaign_executions` table for execution records
   - Verify prospect status changed to "connection_requested"

3. **Verify LinkedIn Messages Sent**
   - Log into LinkedIn account used by workspace
   - Check "My Network" → "Manage" → "Sent" for connection requests
   - Verify messages match campaign message templates

4. **Monitor Errors**
   - Check browser console for any execution errors
   - Review API logs for failed executions
   - Check N8N workflow logs for processing errors

---

## 📊 Current Campaign State

**Latest Campaign:** 20251031-IAI-test 4
- **ID:** e9e0c2d1-311c-4d0e-b9ac-2b7898226835
- **Status:** inactive (never activated)
- **Prospects:** 18 approved, ready to contact
- **N8N Status:** Not executed yet

**To Execute:**
```bash
curl -X POST https://app.meet-sam.com/api/campaigns/linkedin/execute-via-n8n \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "e9e0c2d1-311c-4d0e-b9ac-2b7898226835",
    "workspaceId": "babdcab8-1a78-4b2f-913e-6e9fd9821009"
  }'
```

---

## 🔗 Related Files

- `/app/api/campaigns/linkedin/execute-via-n8n/route.ts` - Main execution endpoint
- `/app/api/campaigns/linkedin/execute-live/route.ts` - Direct Unipile execution (bypass n8n)
- `/n8n-workflows/` - All n8n workflow JSON files
- `/scripts/import-n8n-workflow.mjs` - Workflow import script
- `/lib/n8n/n8n-client.ts` - N8N API client

---

**Generated:** November 7, 2025
**By:** Claude Code Analysis
