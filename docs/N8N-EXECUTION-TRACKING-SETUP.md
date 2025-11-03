# N8N Execution Tracking Setup Guide
**Date:** November 3, 2025
**Purpose:** Enable execution logging for all N8N campaign workflows
**Status:** API endpoint created - Manual workflow updates required

## Update: Automated Script Limitations

An automation script was attempted but N8N API has strict schema validation that prevents programmatic node additions. **Manual updates are required via the N8N UI.**

The script successfully identified **14 campaign workflows** that need logging nodes:
1. SAM Campaign Execution v2 - Clean (ACTIVE)
2. SAM Master Campaign Orchestrator (ACTIVE)
3. SAM Campaign Polling Orchestrator (ACTIVE)
4. Campaign Execute - LinkedIn via Unipile (Complete) (ACTIVE)
5. SAM Campaign Execution - FIXED (ACTIVE)
6. Plus 9 inactive workflows

**Recommendation:** Focus on the 5 ACTIVE workflows first.

---

## Overview

This guide shows you how to add execution logging to your N8N workflows so that campaign executions are tracked in the `n8n_campaign_executions` table.

**Current Status:** 0 executions logged
**Target:** 100% of campaign executions logged

---

## Prerequisites

✅ **API Endpoint Created:** `/api/n8n/log-execution`
- Accepts POST requests from N8N workflows
- Logs execution data to database
- Handles both new logs and updates to existing logs

✅ **Database Table Ready:** `n8n_campaign_executions`
- All required columns exist
- RLS enabled with workspace isolation

---

## Step-by-Step Implementation

### Step 1: Access N8N Workflows

1. Go to: https://workflows.innovareai.com
2. Log in with your N8N credentials
3. Navigate to your campaign workflows

### Step 2: Identify Campaign Workflows

Look for workflows with names like:
- "Campaign Execution - LinkedIn"
- "Campaign Orchestration"
- "V1 Campaign Orchestration"
- Any workflow that handles campaign prospect outreach

### Step 3: Add Execution Logging Node

For each campaign workflow:

#### 3a. Add "Log Start" Node (Beginning of Workflow)

**Node Type:** HTTP Request
**Position:** After workflow trigger, before main logic
**Name:** "Log N8N Execution Start"

**Configuration:**
```
Method: POST
URL: https://app.meet-sam.com/api/n8n/log-execution
Authentication: None
Body Content Type: JSON

Body (Expression):
{
  "workspace_id": "{{ $json.workspace_id }}",
  "n8n_execution_id": "{{ $execution.id }}",
  "n8n_workflow_id": "{{ $workflow.id }}",
  "workspace_n8n_workflow_id": "{{ $json.workflow_id }}",
  "campaign_approval_session_id": "{{ $json.session_id }}",
  "campaign_name": "{{ $json.campaign_name || 'Unnamed Campaign' }}",
  "campaign_type": "{{ $json.campaign_type || 'linkedin' }}",
  "execution_status": "running",
  "total_prospects": "{{ $json.prospect_count || 0 }}",
  "processed_prospects": 0,
  "successful_outreach": 0,
  "failed_outreach": 0,
  "current_step": "initialization",
  "progress_percentage": 0,
  "execution_config": {{ $json }}
}
```

**Error Handling:**
- Continue On Fail: ✅ Enabled
- Retry On Fail: ❌ Disabled
- Reason: Don't let logging failures block campaign execution

#### 3b. Add "Log Completion" Node (End of Workflow)

**Node Type:** HTTP Request
**Position:** After all prospect processing, before workflow end
**Name:** "Log N8N Execution Complete"

**Configuration:**
```
Method: POST
URL: https://app.meet-sam.com/api/n8n/log-execution
Authentication: None
Body Content Type: JSON

Body (Expression):
{
  "workspace_id": "{{ $('Start').item.json.workspace_id }}",
  "n8n_execution_id": "{{ $execution.id }}",
  "n8n_workflow_id": "{{ $workflow.id }}",
  "workspace_n8n_workflow_id": "{{ $('Start').item.json.workflow_id }}",
  "campaign_approval_session_id": "{{ $('Start').item.json.session_id }}",
  "campaign_name": "{{ $('Start').item.json.campaign_name }}",
  "campaign_type": "{{ $('Start').item.json.campaign_type }}",
  "execution_status": "completed",
  "total_prospects": {{ $('Count Total').item.json.total || 0 }},
  "processed_prospects": {{ $('Count Processed').item.json.count || 0 }},
  "successful_outreach": {{ $('Count Success').item.json.count || 0 }},
  "failed_outreach": {{ $('Count Failed').item.json.count || 0 }},
  "responses_received": {{ $('Count Responses').item.json.count || 0 }},
  "current_step": "completed",
  "progress_percentage": 100,
  "campaign_results": {
    "execution_time_minutes": {{ Math.round(($execution.lastRun - $execution.startedAt) / 60000) }},
    "completion_timestamp": "{{ new Date().toISOString() }}"
  },
  "performance_metrics": {
    "success_rate": {{ ($('Count Success').item.json.count / $('Count Total').item.json.total * 100).toFixed(1) }},
    "avg_processing_time_seconds": {{ ($execution.lastRun - $execution.startedAt) / 1000 / $('Count Processed').item.json.count }}
  }
}
```

**Note:** Adjust node names (`$('Count Total')`, etc.) to match your actual workflow node names.

**Error Handling:**
- Continue On Fail: ✅ Enabled
- Retry On Fail: ❌ Disabled

#### 3c. Add "Log Error" Node (Error Handler)

**Node Type:** HTTP Request
**Position:** In error handling branch
**Name:** "Log N8N Execution Error"

**Configuration:**
```
Method: POST
URL: https://app.meet-sam.com/api/n8n/log-execution
Authentication: None
Body Content Type: JSON

Body (Expression):
{
  "workspace_id": "{{ $('Start').item.json.workspace_id }}",
  "n8n_execution_id": "{{ $execution.id }}",
  "n8n_workflow_id": "{{ $workflow.id }}",
  "execution_status": "failed",
  "current_step": "error",
  "error_details": "{{ $json.error?.message || 'Unknown error occurred' }}",
  "processed_prospects": {{ $('Count Processed').item.json.count || 0 }},
  "successful_outreach": {{ $('Count Success').item.json.count || 0 }},
  "failed_outreach": {{ $('Count Failed').item.json.count || 0 }}
}
```

**Error Handling:**
- Continue On Fail: ✅ Enabled (don't cascade errors)

---

## Step 4: Test the Logging

### Test with Sample Data

1. **Create test webhook payload:**
```json
{
  "workspace_id": "YOUR_WORKSPACE_ID",
  "campaign_name": "Test Campaign",
  "campaign_type": "linkedin",
  "prospect_count": 5,
  "session_id": "test-session-123",
  "workflow_id": "test-workflow-456"
}
```

2. **Trigger the workflow** with test data
3. **Check database** for execution log:

```sql
SELECT
  id,
  n8n_execution_id,
  execution_status,
  total_prospects,
  successful_outreach,
  failed_outreach,
  created_at
FROM n8n_campaign_executions
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** Should see 1 new execution record

### Test API Endpoint Directly

```bash
# Test POST (log execution)
curl -X POST https://app.meet-sam.com/api/n8n/log-execution \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "YOUR_WORKSPACE_ID",
    "n8n_execution_id": "test-exec-123",
    "n8n_workflow_id": "test-workflow-456",
    "execution_status": "completed",
    "total_prospects": 10,
    "successful_outreach": 8,
    "failed_outreach": 2
  }'

# Test GET (retrieve executions)
curl https://app.meet-sam.com/api/n8n/log-execution?workspace_id=YOUR_WORKSPACE_ID&limit=10
```

---

## Step 5: Deploy to Production Workflows

Once tested:

1. ✅ Save the workflow in N8N
2. ✅ Activate the workflow
3. ✅ Run a live campaign to verify logging works
4. ✅ Check database to confirm execution was logged

---

## Workflow Template Examples

### Example 1: Simple Linear Campaign

```
[Trigger: Webhook]
    ↓
[Log Execution Start]
    ↓
[Get Prospects]
    ↓
[For Each Prospect]
    ↓
[Send Message via Unipile]
    ↓
[Update Status]
    ↓
[Log Execution Complete]
```

### Example 2: Complex Multi-Step Campaign

```
[Trigger: Webhook]
    ↓
[Log Execution Start]
    ↓
[Validate Input]
    ↓
[Get Prospects] ──→ [Count Total]
    ↓
[Parallel Processing]
    ├─→ [LinkedIn Messages] ──→ [Count LinkedIn]
    ├─→ [Email Messages] ──→ [Count Email]
    └─→ [SMS Messages] ──→ [Count SMS]
    ↓
[Merge Results] ──→ [Count Success/Failed]
    ↓
[Log Execution Complete]
    ↓
[Error Handler] ──→ [Log Execution Error]
```

---

## Example Node JSON (Copy-Paste Ready)

### Log Start Node JSON

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://app.meet-sam.com/api/n8n/log-execution",
    "authentication": "none",
    "sendBody": true,
    "bodyContentType": "json",
    "jsonBody": "={{ \n  {\n    \"workspace_id\": $json.workspace_id,\n    \"n8n_execution_id\": $execution.id,\n    \"n8n_workflow_id\": $workflow.id,\n    \"execution_status\": \"running\",\n    \"total_prospects\": $json.prospect_count || 0,\n    \"current_step\": \"initialization\",\n    \"progress_percentage\": 0\n  }\n}}",
    "options": {
      "redirect": {
        "redirect": {}
      },
      "response": {
        "response": {}
      },
      "allowUnauthorizedCerts": false
    }
  },
  "name": "Log N8N Execution Start",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.1,
  "position": [400, 300],
  "onError": "continueRegularOutput"
}
```

### Log Complete Node JSON

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://app.meet-sam.com/api/n8n/log-execution",
    "authentication": "none",
    "sendBody": true,
    "bodyContentType": "json",
    "jsonBody": "={{ \n  {\n    \"workspace_id\": $('Start').item.json.workspace_id,\n    \"n8n_execution_id\": $execution.id,\n    \"n8n_workflow_id\": $workflow.id,\n    \"execution_status\": \"completed\",\n    \"total_prospects\": $('Count Total').item.json.count || 0,\n    \"successful_outreach\": $('Count Success').item.json.count || 0,\n    \"failed_outreach\": $('Count Failed').item.json.count || 0,\n    \"current_step\": \"completed\",\n    \"progress_percentage\": 100\n  }\n}}",
    "options": {
      "redirect": {
        "redirect": {}
      },
      "response": {
        "response": {}
      }
    }
  },
  "name": "Log N8N Execution Complete",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.1,
  "position": [1200, 300],
  "onError": "continueRegularOutput"
}
```

---

## Verification Queries

### Check Recent Executions

```sql
SELECT
  id,
  campaign_name,
  execution_status,
  total_prospects,
  successful_outreach,
  failed_outreach,
  ROUND(100.0 * successful_outreach / NULLIF(total_prospects, 0), 1) as success_rate_pct,
  created_at
FROM n8n_campaign_executions
ORDER BY created_at DESC
LIMIT 10;
```

### Check Execution Coverage

```sql
-- Compare campaigns vs executions
SELECT
  (SELECT COUNT(*) FROM campaigns WHERE status IN ('active', 'paused', 'completed')) as total_campaigns,
  (SELECT COUNT(DISTINCT n8n_workflow_id) FROM n8n_campaign_executions) as workflows_with_logs,
  (SELECT COUNT(*) FROM n8n_campaign_executions) as total_executions,
  CASE
    WHEN (SELECT COUNT(*) FROM n8n_campaign_executions) > 0 THEN '✅ LOGGING ACTIVE'
    ELSE '❌ NOT LOGGING'
  END as status;
```

### Check for Errors

```sql
SELECT
  id,
  campaign_name,
  execution_status,
  error_details,
  created_at
FROM n8n_campaign_executions
WHERE execution_status IN ('failed', 'error')
ORDER BY created_at DESC
LIMIT 10;
```

---

## Troubleshooting

### Issue: No executions logged

**Possible causes:**
1. Workflow not activated
2. Logging node not executed (check workflow path)
3. API endpoint unreachable
4. Invalid JSON in request body

**Solution:**
- Check N8N execution log for HTTP request errors
- Test API endpoint with curl
- Verify workspace_id is valid UUID

### Issue: Executions logged but data incomplete

**Possible causes:**
1. Missing data in webhook payload
2. Node references incorrect (`$('NodeName')` doesn't exist)
3. Calculation errors in expressions

**Solution:**
- Review node references in logging body
- Add default values: `{{ $json.field || 0 }}`
- Test with sample data first

### Issue: Duplicate executions

**Possible causes:**
1. Workflow retrying on error
2. Multiple logging nodes triggered

**Solution:**
- API handles duplicates automatically (updates instead of inserts)
- Check for multiple HTTP request nodes logging same execution

---

## Monitoring & Maintenance

### Weekly Checks

Run this query to verify logging is working:

```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as executions,
  COUNT(*) FILTER (WHERE execution_status = 'completed') as successful,
  COUNT(*) FILTER (WHERE execution_status = 'failed') as failed,
  ROUND(AVG(successful_outreach::numeric), 1) as avg_success_per_execution
FROM n8n_campaign_executions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Expected:** Executions logged daily for active campaigns

### Monthly Cleanup

Archive old execution logs (optional):

```sql
-- Archive executions older than 90 days
CREATE TABLE IF NOT EXISTS n8n_campaign_executions_archive AS
SELECT * FROM n8n_campaign_executions
WHERE created_at < NOW() - INTERVAL '90 days';

DELETE FROM n8n_campaign_executions
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## Success Metrics

After implementing tracking:

✅ **Coverage:** >80% of campaign workflows logging executions
✅ **Accuracy:** Execution counts match campaign activity
✅ **Reliability:** <5% failed status logs
✅ **Visibility:** Can track campaign performance over time

---

## Next Steps

1. ✅ Update your first workflow (test campaign)
2. ✅ Verify logging works with test execution
3. ✅ Roll out to remaining campaign workflows
4. ✅ Set up weekly monitoring
5. ✅ Use execution data for campaign analytics

---

**Created:** November 3, 2025
**API Endpoint:** `/app/api/n8n/log-execution/route.ts`
**Database Table:** `n8n_campaign_executions`
**Status:** ✅ Ready for implementation
