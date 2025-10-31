# N8N Manual Workflow Creation Guide

## SAM Campaign Execution v3 - Step-by-Step UI Instructions

**Created:** October 31, 2025
**Purpose:** Create a working LinkedIn campaign workflow manually in n8n UI
**Critical:** API-deployed workflows don't work - MUST create in UI

---

## Access n8n Instance

1. Open browser and navigate to: **https://workflows.innovareai.com**
2. Log in with your credentials
3. Click "Create new workflow" button

---

## Workflow Settings

**Before adding nodes, configure workflow:**

1. Click the workflow name at the top (default: "My workflow")
2. Set name: **SAM Campaign Execution v3**
3. Click "Settings" tab
4. Configure:
   - Execution Order: **v1**
   - Save Manual Executions: **ON**
   - Save Execution Progress: **ON**
   - Save Successful Executions: **All**
   - Save Error Executions: **All**
   - Execution Timeout: **3600** seconds
5. Click "Save"

---

## Node 1: Webhook Trigger

**Add node:**
1. Click the "+" button on canvas
2. Search: **webhook**
3. Select: **Webhook** (n8n-nodes-base.webhook)

**Configure:**
- **Webhook Path:** `campaign-execute-v3`
- **HTTP Method:** POST
- **Response Mode:** On Received (async)
- **Response Code:** 200
- **Response Data:** First Entry JSON

**Node Position:** Leave at default (center of canvas)

**Click:** Execute Node (to generate webhook URL)

**Copy the webhook URL** - it should be:
```
https://workflows.innovareai.com/webhook/campaign-execute-v3
```

**Save** the node.

---

## Node 2: Extract Campaign Data (Code Node)

**Add node:**
1. Click the "+" button on the right side of Webhook node
2. Search: **code**
3. Select: **Code** (n8n-nodes-base.code) - NOT Function (deprecated)

**Configure:**
- **Language:** JavaScript
- **Mode:** Run Once for All Items

**Paste this exact code:**
```javascript
const webhookData = $input.first().json.body;

return {
  workspace_id: webhookData.workspaceId,
  campaign_id: webhookData.campaignId,
  unipile_account_id: webhookData.unipileAccountId,
  prospects: webhookData.prospects || [],
  messages: webhookData.messages || {},
  timing: webhookData.timing || {},
  supabase_url: webhookData.supabase_url,
  supabase_service_key: webhookData.supabase_service_key,
  unipile_dsn: webhookData.unipile_dsn,
  unipile_api_key: webhookData.unipile_api_key
};
```

**Name the node:** Extract Campaign Data

**Save** the node.

**Verify connection:** You should see a gray line connecting Webhook → Extract Campaign Data

---

## Node 3: Process Each Prospect (Split In Batches)

**Add node:**
1. Click the "+" button on the right side of Extract Campaign Data node
2. Search: **split in batches**
3. Select: **Split In Batches** (n8n-nodes-base.splitInBatches)

**Configure:**
- **Batch Size:** 1
- **Options:**
  - Reset: **OFF** (unchecked)

**Name the node:** Process Each Prospect

**Save** the node.

**Verify connection:** Extract Campaign Data → Process Each Prospect

---

## Node 4: Prepare Prospect Data (Code Node)

**Add node:**
1. Click the "+" button on the right side of Process Each Prospect node
2. Search: **code**
3. Select: **Code** (n8n-nodes-base.code)

**Configure:**
- **Language:** JavaScript
- **Mode:** Run Once for All Items

**Paste this exact code:**
```javascript
const campaignData = $input.first().json;
const prospect = campaignData.prospects[0];

return {
  prospect_id: prospect.id,
  first_name: prospect.first_name,
  last_name: prospect.last_name,
  linkedin_url: prospect.linkedin_url,
  linkedin_user_id: prospect.linkedin_user_id,
  message: campaignData.messages.cr,
  unipile_account_id: campaignData.unipile_account_id,
  unipile_dsn: campaignData.unipile_dsn,
  unipile_api_key: campaignData.unipile_api_key
};
```

**Name the node:** Prepare Prospect Data

**Save** the node.

**Verify connection:** Process Each Prospect → Prepare Prospect Data

---

## Node 5: Send LinkedIn Message (HTTP Request)

**Add node:**
1. Click the "+" button on the right side of Prepare Prospect Data node
2. Search: **http request**
3. Select: **HTTP Request** (n8n-nodes-base.httpRequest)

**Configure:**

**Basic Configuration:**
- **Method:** POST
- **URL:** `={{ "https://" + $json.unipile_dsn + "/api/v1/messaging" }}`
  - **IMPORTANT:** This is an expression - click the "=" icon to enable expressions
- **Authentication:** None

**Headers:**
- Click "Add Header"
- **Name:** `X-API-KEY`
- **Value:** `={{ $json.unipile_api_key }}`
  - **IMPORTANT:** This is an expression - click the "=" icon

**Body:**
- **Send Body:** ON
- **Body Content Type:** JSON
- **Specify Body:** Using JSON

**Click "Add Field" and paste this JSON:**
```json
{
  "account_id": "={{ $json.unipile_account_id }}",
  "attendees": ["={{ $json.linkedin_user_id }}"],
  "text": "={{ $json.message }}",
  "type": "LINKEDIN"
}
```

**IMPORTANT:** For each field above:
- The values in `={{ }}` are expressions
- Click the "=" icon next to each field to enable expression mode
- Paste the expression without the outer quotes

**Name the node:** Send LinkedIn Message

**Save** the node.

**Verify connection:** Prepare Prospect Data → Send LinkedIn Message

---

## Node 6: Log Result (Code Node)

**Add node:**
1. Click the "+" button on the right side of Send LinkedIn Message node
2. Search: **code**
3. Select: **Code** (n8n-nodes-base.code)

**Configure:**
- **Language:** JavaScript
- **Mode:** Run Once for All Items

**Paste this exact code:**
```javascript
console.log('Message sent to:', $input.first().json.first_name, $input.first().json.last_name);
return $input.all();
```

**Name the node:** Log Result

**Save** the node.

**Verify connection:** Send LinkedIn Message → Log Result

---

## Node 7: Loop Back Connection

**This is critical for processing multiple prospects:**

1. Hover over the **Log Result** node
2. Click and drag from the **right side output handle**
3. Connect it back to the **Process Each Prospect** node (left side input)

**You should now see:**
- A connection line going from Log Result back to Process Each Prospect
- This creates the loop for processing multiple prospects one at a time

---

## Final Workflow Visual Structure

```
[Webhook] → [Extract Campaign Data] → [Process Each Prospect] → [Prepare Prospect Data]
                                              ↑                           ↓
                                              |                   [Send LinkedIn Message]
                                              |                           ↓
                                              ← ← ← ← ← [Log Result] ← ←
```

**Verify all connections are visible:**
- 6 total connections (including the loop back)
- All connection lines should be gray/black (not broken)
- No red warning icons on any nodes

---

## Activate the Workflow

1. Click the **toggle switch** at the top right (should turn green)
2. Status should change to: **Active**
3. You should see: "Workflow activated successfully"

**If activation fails:**
- Check all nodes for red error indicators
- Ensure all required fields are filled
- Verify expressions are properly formatted with `={{ }}`

---

## Test the Workflow

### Method 1: Manual Test with Webhook (Recommended)

**Create test data file:**

Save this as `test-webhook-payload.json`:

```json
{
  "workspaceId": "test-workspace-123",
  "campaignId": "test-campaign-456",
  "unipileAccountId": "YOUR_UNIPILE_ACCOUNT_ID",
  "prospects": [
    {
      "id": "prospect-1",
      "first_name": "John",
      "last_name": "Doe",
      "linkedin_url": "https://linkedin.com/in/johndoe",
      "linkedin_user_id": "LINKEDIN_USER_ID_HERE"
    }
  ],
  "messages": {
    "cr": "Hi {{first_name}}, I'd love to connect!"
  },
  "timing": {},
  "supabase_url": "https://latxadqrvrrrcvkktrog.supabase.co",
  "supabase_service_key": "YOUR_SUPABASE_KEY",
  "unipile_dsn": "api6.unipile.com:13670",
  "unipile_api_key": "YOUR_UNIPILE_API_KEY"
}
```

**Send test request:**

```bash
curl -X POST https://workflows.innovareai.com/webhook/campaign-execute-v3 \
  -H "Content-Type: application/json" \
  -d @test-webhook-payload.json
```

**Expected Response:**
```json
{
  "message": "Webhook call received"
}
```

**Check Execution:**
1. Go to n8n UI
2. Click "Executions" in left sidebar
3. Find the latest execution
4. Click to view details

**What to verify:**
- Execution should show: **SUCCESS** (green checkmark)
- Each node should have data (not "Data: NO")
- Click each node to see the data flowing through
- Check execution time (should be >100ms, not 30ms)

### Method 2: Test Mode (Less Reliable)

1. Click "Execute Workflow" button at bottom
2. Manually paste test data into Webhook node
3. Click "Listen for Test Event"
4. Send webhook request within 2 minutes

---

## Troubleshooting

### Issue: Nodes Not Connected

**Symptom:** No gray line between nodes

**Fix:**
1. Click and drag from the output handle (right side) of source node
2. Drop on the input handle (left side) of target node
3. Line should appear
4. Save workflow

### Issue: "No input data yet" on downstream nodes

**Symptom:** Nodes after Webhook show no data

**Fix:**
1. Verify webhook was actually triggered (check executions)
2. Ensure response mode is "On Received"
3. Check webhook URL is correct
4. Verify connection lines are visible

### Issue: Expression errors in HTTP Request

**Symptom:** Red warning on Send LinkedIn Message node

**Fix:**
1. Verify all `={{ }}` expressions are in expression mode (= icon clicked)
2. Check for typos in field names ($json.unipile_dsn, etc.)
3. Ensure JSON body fields are properly quoted

### Issue: Loop not working (only processes 1 prospect)

**Symptom:** Only first prospect processed, loop doesn't continue

**Fix:**
1. Verify connection from Log Result → Process Each Prospect exists
2. Check Split In Batches has "Reset" set to OFF
3. Ensure prospects array has multiple items in test data

### Issue: Execution completes in <100ms with no data

**Symptom:** Same issue as broken API workflows

**Fix:**
1. DELETE the workflow
2. Create a new workflow from scratch
3. DO NOT copy/paste entire workflow JSON
4. Build node by node manually

---

## Success Criteria

After following this guide, you should have:

- ✅ Workflow named "SAM Campaign Execution v3"
- ✅ 6 nodes total (Webhook, Extract, Split, Prepare, HTTP, Log)
- ✅ All nodes visually connected (gray lines)
- ✅ Loop back connection from Log Result to Split In Batches
- ✅ Workflow activated (green toggle)
- ✅ Test execution shows data in all nodes
- ✅ Execution time >100ms (not 30ms)
- ✅ Status: Success (green checkmark)

---

## What to Return After Creation

**Reply with:**

1. **Workflow ID** (found in URL: `workflows.innovareai.com/workflow/{ID}`)
2. **Screenshot** showing all connected nodes
3. **Test execution ID** (from Executions page)
4. **Confirmation** that data flows to all nodes (not "Data: NO")

---

## Next Steps After Success

1. Update `.env.local`:
   ```bash
   N8N_CAMPAIGN_WEBHOOK_URL=https://workflows.innovareai.com/webhook/campaign-execute-v3
   ```

2. Test from SAM application:
   ```bash
   npm run test:campaign-execution
   ```

3. Monitor executions in n8n UI for first 24 hours

4. Document any Unipile API response issues (message ID location)

---

**Good luck! Follow each step carefully and the workflow will work.**

**Remember:** The key difference is creating it MANUALLY in the UI, not via API.
