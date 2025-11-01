# N8N MCP Enrichment Integration

**Date:** November 1, 2025
**Status:** ✅ Enhanced with MCP Integration
**Approach:** Using existing N8N MCP infrastructure for enrichment

---

## 🎯 Why Use N8N MCP Instead of Direct Webhooks?

### Architecture Comparison

| Approach | Pros | Cons |
|----------|------|------|
| **Direct Webhook** | Simple, direct communication | No execution tracking, no retry, manual URL management |
| **N8N MCP** | ✅ Typed API, ✅ Execution tracking, ✅ Built-in retry, ✅ Consistent with existing infrastructure | Requires MCP server setup |

### Benefits of MCP Approach

1. **✅ Consistent Architecture** - Sam already uses N8N MCP for campaigns
2. **✅ Execution Tracking** - Can monitor workflow execution via MCP tools
3. **✅ Type Safety** - MCP tools have typed inputs/outputs
4. **✅ Error Handling** - Built-in retry and error propagation
5. **✅ Fallback Support** - Can fallback to webhooks if MCP fails

---

## 🏗️ Architecture Overview

### Data Flow with MCP

```
User clicks "Enrich Prospects"
    ↓
Sam creates enrichment_jobs record
    ↓
Sam uses N8N MCP client
    ↓
MCP calls n8n_execute_workflow tool
    ↓
N8N workflow executes (16 nodes)
    ↓
BrightData API called (35-40s - NO TIMEOUT)
    ↓
Prospect enriched in workspace_prospects
    ↓
enrichment_jobs updated with progress
    ↓
UI polls /api/prospects/enrich-async/[jobId]
    ↓
Shows enriched data to user
```

### Fallback Strategy

If MCP fails, the code **automatically falls back** to direct webhook call:

```typescript
try {
  // Try MCP approach first
  await n8nMCP.callTool({ name: 'n8n_execute_workflow', ... })
} catch (e) {
  // Fallback to direct webhook
  fetch(n8nWebhookUrl, { ... })
}
```

---

## 📋 Setup Requirements

### 1. N8N MCP Server (Already Configured)

You already have N8N MCP configured in `.mcp.json`:

```json
{
  "n8n": {
    "command": "npx",
    "args": ["-y", "@n8n/mcp-server-n8n@latest"],
    "env": {
      "N8N_API_URL": "${N8N_API_URL}",
      "N8N_API_KEY": "${N8N_API_KEY}"
    },
    "description": "N8N workflow automation MCP"
  }
}
```

### 2. Environment Variables

Add these to `.env.local` and Netlify:

```bash
# N8N MCP Configuration (Already exists)
N8N_API_URL=https://innovareai.app.n8n.cloud/api/v1
N8N_API_KEY=your-n8n-api-key

# New: Enrichment workflow ID
N8N_ENRICHMENT_WORKFLOW_ID=<workflow-id-after-import>

# Optional: Organization ID
N8N_ORGANIZATION_ID=your-org-id

# Fallback webhook URL (if MCP fails)
N8N_ENRICHMENT_WEBHOOK_URL=https://innovareai.app.n8n.cloud/webhook/prospect-enrichment
```

### 3. Import Enrichment Workflow to N8N

Same as before - import `n8n-workflows/prospect-enrichment-workflow.json` to N8N Cloud.

**After importing:**
1. Note the workflow ID (e.g., `aVG6LC4ZFRMN7Bw6`)
2. Add it to `.env.local` as `N8N_ENRICHMENT_WORKFLOW_ID`
3. Activate the workflow

---

## 🚀 Deployment Steps

### Step 1: Verify N8N MCP is Running

```bash
# Check MCP servers status
curl http://localhost:3000/api/mcp
```

Expected response should include `n8n` MCP server.

### Step 2: Import Workflow (Same as Before)

1. Go to https://innovareai.app.n8n.cloud
2. Import `n8n-workflows/prospect-enrichment-workflow.json`
3. Configure Supabase credentials
4. Activate workflow
5. **Copy workflow ID**

### Step 3: Update Environment Variables

```bash
# Add to .env.local
N8N_ENRICHMENT_WORKFLOW_ID=<your-workflow-id>

# Also add to Netlify environment variables
```

### Step 4: Deploy Code

```bash
git add .
git commit -m "Use N8N MCP for enrichment execution"
git push origin main
```

Netlify will auto-deploy in 2-5 minutes.

---

## 🧪 Testing

### Test 1: MCP-Based Enrichment

1. **Select 1 prospect** in Sam UI
2. **Click "Enrich Selected"**
3. **Check Netlify logs** for:
   ```
   ✅ N8N workflow triggered via MCP: <execution-id>
   ```
4. **Check N8N executions**: https://innovareai.app.n8n.cloud/executions
5. **Verify enrichment** in database

### Test 2: MCP Failure Fallback

Temporarily set invalid `N8N_API_KEY` to test fallback:

1. **Trigger enrichment**
2. **Check logs** for:
   ```
   ⚠️ N8N MCP execution failed: ...
   ⚠️ Could not trigger N8N workflow via MCP: ...
   (Fallback to webhook)
   ```
3. **Verify workflow still executes** via webhook

### Test 3: Execution Tracking via MCP

Use N8N MCP to monitor execution:

```typescript
// In Sam AI or via MCP tool
const executions = await n8nMCP.callTool({
  params: {
    name: 'n8n_get_executions',
    arguments: {
      workflow_id: 'prospect-enrichment',
      limit: 10
    }
  }
});

// Returns execution history with status
```

---

## 📊 MCP Tools Available

### n8n_execute_workflow

**Triggers enrichment workflow:**

```typescript
await n8nMCP.callTool({
  params: {
    name: 'n8n_execute_workflow',
    arguments: {
      workflow_id: 'prospect-enrichment',
      input_data: {
        job_id: 'uuid',
        workspace_id: 'uuid',
        prospect_ids: ['uuid1', 'uuid2'],
        // ... credentials
      }
    }
  }
});

// Returns:
{
  message: 'Workflow execution started',
  execution_id: 'exec-123',
  workflow_id: 'prospect-enrichment',
  status: 'running',
  started_at: '2025-11-01T...'
}
```

### n8n_get_executions

**Monitor enrichment progress:**

```typescript
await n8nMCP.callTool({
  params: {
    name: 'n8n_get_executions',
    arguments: {
      workflow_id: 'prospect-enrichment',
      status: 'success',
      limit: 50
    }
  }
});

// Returns execution history
```

### n8n_health_check

**Verify N8N connectivity:**

```typescript
await n8nMCP.callTool({
  params: {
    name: 'n8n_health_check',
    arguments: {}
  }
});

// Returns N8N version and status
```

---

## 🔍 Monitoring & Debugging

### Check MCP Execution Logs

**Netlify logs:**
```
✅ Created enrichment job: <job-id>
🔄 Triggering N8N enrichment workflow via MCP for job <job-id>
✅ N8N workflow triggered via MCP: <execution-id>
```

**If MCP fails:**
```
⚠️ N8N MCP execution failed: N8N API error: 401 Unauthorized
⚠️ Could not trigger N8N workflow via MCP: Error message
(Fallback to webhook)
```

### Check N8N Execution in N8N Cloud

1. Go to https://innovareai.app.n8n.cloud/executions
2. Find execution by `execution_id` from logs
3. View each node's input/output

### Check Database

Same as before - query `enrichment_jobs` table:

```sql
SELECT * FROM enrichment_jobs
WHERE id = 'job-id'
ORDER BY created_at DESC;
```

---

## 🎛️ Configuration Options

### Environment Variables

```bash
# Required
N8N_API_URL=https://innovareai.app.n8n.cloud/api/v1
N8N_API_KEY=your-api-key
N8N_ENRICHMENT_WORKFLOW_ID=workflow-id

# Optional (for fallback)
N8N_ENRICHMENT_WEBHOOK_URL=https://innovareai.app.n8n.cloud/webhook/prospect-enrichment

# Optional (for organization context)
N8N_ORGANIZATION_ID=your-org-id
```

### Code Configuration

Update in `enrich-async/route.ts` if needed:

```typescript
const n8nMCP = new N8NMCPServer({
  baseUrl: process.env.N8N_API_URL || 'https://innovareai.app.n8n.cloud',
  apiKey: process.env.N8N_API_KEY || '',
  organizationId: process.env.N8N_ORGANIZATION_ID || '',
  userId: user.id
});
```

---

## 🆚 Comparison: MCP vs Direct Webhook

### Direct Webhook Approach (Previous)

```typescript
// Simple but limited
fetch('https://innovareai.app.n8n.cloud/webhook/prospect-enrichment', {
  method: 'POST',
  body: JSON.stringify({ job_id, ... })
});
// No execution tracking, no typed response
```

### MCP Approach (Current)

```typescript
// Structured and trackable
const result = await n8nMCP.callTool({
  params: {
    name: 'n8n_execute_workflow',
    arguments: { workflow_id, input_data: { ... } }
  }
});

// Returns: { execution_id, status, started_at }
// Can track with n8n_get_executions later
```

**Benefits:**
- ✅ Get execution ID immediately
- ✅ Can query execution status via MCP
- ✅ Type-safe API calls
- ✅ Built-in error handling
- ✅ Consistent with campaign execution

---

## 🔐 Security Considerations

### MCP Security

1. **N8N API Key** - Stored in environment variables (encrypted in Netlify)
2. **Service Role Key** - Passed to workflow (never exposed to client)
3. **MCP Client** - Server-side only (never runs in browser)

### Fallback Security

If MCP fails, fallback to webhook:
- ✅ Same credentials passed
- ✅ Same security model
- ⚠️ Less execution tracking

---

## 📈 Performance

### MCP Overhead

- **MCP API call**: ~50-100ms (negligible)
- **N8N execution**: Same as webhook (35-40s per prospect)
- **Total time**: Virtually identical to webhook approach

### Monitoring Benefits

With MCP, you can:
- Track execution IDs in database
- Query execution status programmatically
- Build analytics dashboards
- Alert on failed executions

---

## 🚦 Next Steps

### Immediate (Today)

1. ✅ Import workflow to N8N
2. ✅ Get workflow ID
3. ✅ Add `N8N_ENRICHMENT_WORKFLOW_ID` to environment
4. ✅ Deploy code
5. ✅ Test with 1 prospect

### Short-term (This Week)

1. **Monitor MCP vs webhook usage** (check logs)
2. **Build execution tracking** (store execution_id in enrichment_jobs)
3. **Add retry logic** if MCP fails multiple times
4. **Create admin dashboard** to view N8N executions

### Long-term (Next Month)

1. **Migrate all N8N triggers to MCP** (consistent architecture)
2. **Build N8N workflow builder** using MCP tools
3. **Add workflow versioning** and rollback
4. **Create automated testing** for N8N workflows

---

## ✅ Deployment Checklist

**MCP Setup:**
- [ ] N8N MCP server running (check `.mcp.json`)
- [ ] `N8N_API_URL` set in environment
- [ ] `N8N_API_KEY` set in environment
- [ ] MCP health check passes

**Workflow Setup:**
- [ ] Workflow imported to N8N Cloud
- [ ] Workflow ID copied
- [ ] `N8N_ENRICHMENT_WORKFLOW_ID` set in environment
- [ ] Workflow activated in N8N

**Testing:**
- [ ] MCP-based enrichment works (1 prospect)
- [ ] Execution ID returned and logged
- [ ] Fallback webhook works (test with invalid API key)
- [ ] Database updated correctly

**Production:**
- [ ] Code deployed to Netlify
- [ ] Environment variables set in Netlify
- [ ] First production enrichment monitored
- [ ] N8N execution logs reviewed

---

## 📞 Troubleshooting

### Issue: MCP Not Found

**Error:**
```
Cannot find module '@/lib/mcp/n8n-mcp'
```

**Fix:**
Ensure `lib/mcp/n8n-mcp.ts` exists (it does in your project).

### Issue: Invalid Workflow ID

**Error:**
```
N8N API error: 404 Workflow not found
```

**Fix:**
1. Check workflow is imported to N8N
2. Verify `N8N_ENRICHMENT_WORKFLOW_ID` matches actual ID
3. Use MCP to list workflows:
   ```typescript
   await n8nMCP.callTool({
     params: { name: 'n8n_list_workflows', arguments: {} }
   });
   ```

### Issue: MCP Authentication Failed

**Error:**
```
N8N API error: 401 Unauthorized
```

**Fix:**
1. Verify `N8N_API_KEY` is correct
2. Check API key has workflow execution permissions
3. Test with `n8n_health_check` MCP tool

### Issue: Workflow Not Executing

**Symptoms:**
- Execution ID returned but workflow doesn't run
- No execution appears in N8N Cloud

**Fix:**
1. Check workflow is activated in N8N
2. Verify input_data format matches workflow expectations
3. Check N8N execution logs for errors

---

**Last Updated:** November 1, 2025
**Approach:** N8N MCP Integration
**Fallback:** Direct Webhook (automatic)
**Status:** ✅ Ready for Deployment
