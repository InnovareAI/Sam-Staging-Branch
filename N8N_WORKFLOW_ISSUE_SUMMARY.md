# N8N Workflow Execution Issue - Expert Consultation

**Date:** October 31, 2025
**Workflow ID:** `aVG6LC4ZFRMN7Bw6`
**Workflow Name:** SAM Master Campaign Orchestrator
**N8N Instance:** https://workflows.innovareai.com

---

## 🚨 Problem Statement

Workflow receives webhook triggers and responds with "Workflow was started" but **executes ZERO nodes** and completes in ~30ms. All 20+ recent executions show this behavior.

---

## 📊 Symptoms

- ✅ Webhook responds: `{"message":"Workflow was started"}`
- ✅ Execution records created (IDs: 63227, 63221, 63213, etc.)
- ❌ Duration: 30-40ms (too fast)
- ❌ **All executions have NO data** (`exec.data` is null/empty)
- ❌ **Zero nodes executed** (no `runData`)
- ❌ Status shows "running" even when `finished: true`

---

## ✅ What We've Verified (All Correct)

### 1. Workflow Configuration
```json
{
  "active": true,
  "nodes": 33,
  "settings": {
    "saveExecutionProgress": true,
    "saveDataSuccessExecution": "all",
    "saveDataErrorExecution": "all",
    "executionTimeout": 3600
  }
}
```

### 2. Webhook Node Configuration
```json
{
  "type": "n8n-nodes-base.webhook",
  "parameters": {
    "path": "campaign-execute",
    "httpMethod": "POST",
    "responseMode": "onReceived"
  }
}
```

### 3. Connections Verified
```
webhook_trigger → campaign_handler → prospect_loop → send_cr → ...
```

All connections exist and point to valid nodes.

### 4. Authentication
- Removed `genericCredentialType` authentication (was causing errors)
- All HTTP nodes now use `authentication: "none"`
- Headers passed via payload

### 5. Activation Status
- Workflow toggled ON in UI (production mode)
- Webhook registered and responding
- "Execute Workflow" button clicked multiple times

---

## ❌ What We've Fixed (But Still Doesn't Work)

1. **Fixed Missing Credentials Error**
   - Changed HTTP nodes from `authentication: "genericCredentialType"` to `authentication: "none"`

2. **Removed Broken Switch Nodes**
   - Deleted `workspace_router` and `template_selector` (had no output routes)
   - Connected webhook directly to `campaign_handler`

3. **Set Correct Response Mode**
   - Changed from `responseMode: "lastNode"` to `responseMode: "onReceived"`

4. **Database Migration Applied**
   - All required columns exist: `contacted_at`, `status`, `personalization_data`
   - Functions created: `update_prospect_contacted()`, `get_prospects_ready_for_messaging()`

5. **Multiple Reactivations**
   - Deactivated/reactivated via API: No change
   - Toggled OFF/ON in UI: No change
   - Clicked "Execute Workflow" multiple times: No change

---

## 🔍 Diagnostic Results

### Execution Analysis (Last 20 Executions)
```
#63227: 30ms, Data: NO, Status: running, Finished: true
#63221: 33ms, Data: NO, Status: running, Finished: true
#63213: 28ms, Data: NO, Status: running, Finished: true
... (all identical)
```

### Webhook Connection Verification
```
✅ webhook_trigger exists
✅ Has connection to campaign_handler
✅ campaign_handler exists
✅ campaign_handler has connection to prospect_loop
```

### Test Payload Sent
```json
{
  "campaignId": "test-campaign",
  "workspaceId": "test-workspace",
  "unipileAccountId": "test-account",
  "prospects": [{"id": "test-1", "first_name": "Test", ...}],
  "messages": {"cr": "Test message"},
  "timing": {...}
}
```

---

## 🤔 Theories

### Theory 1: Response Mode Bug
`responseMode: "onReceived"` should execute workflow asynchronously, but might have a bug in this n8n version causing immediate exit.

### Theory 2: Workflow Corruption
API-deployed workflows might have internal state corruption that prevents execution, even though configuration appears correct.

### Theory 3: Function Node Syntax
`campaign_handler` uses old syntax `$input.item.json`, might fail silently in newer n8n versions.

### Theory 4: Missing Trigger Registration
Webhook might not be properly registered in n8n's runtime despite showing as active.

---

## 🛠️ Scripts Created for Diagnosis

1. `scripts/js/check-workflow-status.mjs` - View workflow state
2. `scripts/js/diagnose-n8n-workflow.mjs` - Full workflow diagnostics
3. `scripts/js/get-latest-n8n-execution.mjs` - Execution details
4. `scripts/js/analyze-executions.mjs` - Analyze last 20 executions
5. `scripts/js/verify-webhook-connection.mjs` - Verify connections
6. `scripts/js/fix-workflow-auth.mjs` - Remove auth requirements
7. `scripts/js/fix-switch-nodes.mjs` - Remove broken switches

---

## ❓ Questions for N8N Expert

1. **Why would ALL executions have no data despite correct configuration?**
2. **Is there a known bug with `responseMode: "onReceived"` in webhook nodes?**
3. **Can API-deployed workflows have different behavior than UI-created ones?**
4. **What causes executions to show `status: "running"` when `finished: true`?**
5. **Is there a way to force n8n to re-register/rebuild a workflow's internal state?**
6. **Should we rebuild this workflow from scratch in the UI?**

---

## 📝 API Access

- **Base URL:** `https://workflows.innovareai.com/api/v1`
- **API Key:** Available in environment (`.env.local`)
- **Workflow ID:** `aVG6LC4ZFRMN7Bw6`
- **Webhook URL:** `https://workflows.innovareai.com/webhook/campaign-execute`

---

## 🎯 Desired Outcome

Workflow should:
1. Receive webhook trigger
2. Execute `campaign_handler` Function node
3. Process prospects through the flow
4. Execute HTTP requests to Unipile API
5. Update Supabase database
6. Show execution data with runData for each node

**Current:** None of this happens. Workflow completes instantly with no data.

---

## 📚 Related Documentation

- N8N Database Tracking Setup: `/docs/N8N_DATABASE_TRACKING_SETUP.md`
- N8N Workflow Fix Report: `/N8N_WORKFLOW_FIX_REPORT.md`
- LinkedIn Campaign Workflow Status: `/docs/LINKEDIN_CAMPAIGN_WORKFLOW_STATUS.md`

---

**Ready for expert consultation.**
