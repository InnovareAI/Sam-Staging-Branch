# N8N Webhook Node Setup Guide

## Manual Webhook Configuration for "Enrichment Job Webhook" Node

### Step 1: Create Webhook Node

1. In N8N workflow editor, add a new **Webhook** node
2. Name it: `Enrichment Job Webhook`

### Step 2: Configure Webhook Parameters

**In the Webhook node settings:**

#### Authentication
- **Authentication:** None

#### HTTP Method
- **HTTP Method:** POST

#### Path
- **Path:** `prospect-enrichment`
  - This will create: `https://workflows.innovareai.com/webhook/prospect-enrichment`

#### Response Settings
- **Response Mode:** Last Node
- **Response Data:** First Entry JSON

#### CRITICAL: Set Response Configuration

**In the Webhook node parameters:**

1. **Respond:** Change from "Immediately" to **"When Last Node Finishes"**
   - This is in the main parameters, not in Options

2. **Response Data:** Set to **"First Entry JSON"**
   - This is in the main parameters

#### Options to Add (Click "Add option" button)

Optional headers to add:
- **Response Code:** 200 (if available)
- **Response Headers:** Content-Type: application/json

### Step 3: Verify Webhook URL

After saving, the webhook URL should be:
```
https://workflows.innovareai.com/webhook/prospect-enrichment
```

**This MUST match the URL in your `.env.local`:**
```bash
N8N_ENRICHMENT_WEBHOOK_URL=https://workflows.innovareai.com/webhook/prospect-enrichment
```

### Expected Request Body Format

The webhook will receive this JSON payload:

```json
{
  "job_id": "uuid-here",
  "workspace_id": "uuid-here",
  "prospect_ids": ["prospect_1234", "prospect_5678"],
  "supabase_url": "https://latxadqrvrrrcvkktrog.supabase.co",
  "supabase_service_key": "service-role-key",
  "brightdata_api_token": "hl_8aca120e:vokteG-4zibcy-juwrux",
  "brightdata_zone": "residential"
}
```

### Common Errors & Fixes

#### Error: "Webhook node not correctly configured"

**Cause:** Missing webhook ID or incorrect path

**Fix:**
1. Click on the Webhook node
2. Scroll to "Webhook ID" field (may be hidden)
3. Set it to: `prospect-enrichment`
4. Save workflow

#### Error: "Workflow could not be started"

**Cause:** Webhook not properly registered in N8N

**Fix:**
1. Deactivate the workflow (toggle OFF)
2. Save the workflow
3. Reactivate the workflow (toggle ON)
4. Test the webhook URL

### Testing the Webhook

**After configuring, test with:**

```bash
node scripts/manual-trigger-enrichment.mjs
```

**Expected Response:**
```json
{
  "success": true,
  "job_id": "uuid-here",
  "message": "Enrichment completed"
}
```

### Full Node Configuration JSON

If manually editing workflow JSON, the webhook node should look like this:

```json
{
  "parameters": {
    "httpMethod": "POST",
    "path": "prospect-enrichment",
    "responseMode": "lastNode",
    "responseData": "firstEntryJson",
    "options": {}
  },
  "name": "Enrichment Job Webhook",
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2,
  "position": [250, 300],
  "webhookId": "prospect-enrichment"
}
```

### Next Steps

1. ✅ Configure webhook node (settings above)
2. ✅ Connect to "Parse Job Data" node
3. ✅ Save workflow
4. ✅ Activate workflow
5. ✅ Test with `manual-trigger-enrichment.mjs`

---

**Need Help?**
- Check N8N execution logs: https://workflows.innovareai.com/executions
- Verify webhook is active: Check workflow status
- Test webhook directly: Use `curl` or manual trigger script
