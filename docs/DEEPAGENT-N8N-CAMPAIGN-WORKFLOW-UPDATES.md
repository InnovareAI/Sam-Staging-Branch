# Deep Agent Instructions: N8N Campaign Workflow Updates
**Date:** November 3, 2025
**Task:** Add execution logging to 3 active campaign workflows
**Estimated Time:** 45 minutes total (15 min per workflow)
**Complexity:** Medium - Requires manual N8N UI interaction

---

## 🎯 Objective

Add execution logging nodes to 3 campaign execution workflows so that every time a campaign runs, the execution data is logged to the `n8n_campaign_executions` database table for monitoring and analytics.

---

## 📋 Prerequisites

### Access Required
- **N8N URL:** https://workflows.innovareai.com
- **N8N Credentials:** (You should have login access)
- **API Endpoint:** https://app.meet-sam.com/api/n8n/log-execution (already created)

### Database Table
The `n8n_campaign_executions` table exists and is ready to receive data with these columns:
- `workspace_id` (UUID)
- `n8n_execution_id` (text)
- `n8n_workflow_id` (text)
- `campaign_name` (text)
- `execution_status` (text: 'running', 'completed', 'failed')
- `total_prospects` (integer)
- `successful_outreach` (integer)
- `failed_outreach` (integer)
- `created_at`, `updated_at` (timestamps)

---

## 🎯 Workflows to Update (3 Total)

Update these 3 workflows IN THIS ORDER:

### Priority 1: SAM Campaign Execution v2 - Clean
- **Workflow ID:** `79ZgBvhtNyx0wEGj`
- **Status:** Active
- **Why:** Primary campaign execution workflow
- **URL:** https://workflows.innovareai.com/workflow/79ZgBvhtNyx0wEGj

### Priority 2: Campaign Execute - LinkedIn via Unipile (Complete)
- **Workflow ID:** `iKIchXBOT7ahhIwa`
- **Status:** Active
- **Why:** LinkedIn message sending via Unipile
- **URL:** https://workflows.innovareai.com/workflow/iKIchXBOT7ahhIwa

### Priority 3: SAM Campaign Execution - FIXED (ACTIVE)
- **Workflow ID:** `pWxsl8D5irntaRwR`
- **Status:** Active
- **Why:** Fixed version of campaign execution
- **URL:** https://workflows.innovareai.com/workflow/pWxsl8D5irntaRwR

---

## 📖 Detailed Step-by-Step Instructions

### STEP 1: Log Into N8N

1. Open browser and navigate to: https://workflows.innovareai.com
2. Log in with your credentials
3. You should see the N8N workflow dashboard with a list of workflows

---

### STEP 2: Open First Workflow

1. In the workflow list, find: **"SAM Campaign Execution v2 - Clean"**
2. Click on the workflow name to open the workflow editor
3. You should see a visual canvas with connected nodes

**What you'll see:**
- A visual workflow with multiple nodes (boxes) connected by lines
- Each node represents a step in the campaign execution
- Typical nodes: Webhook/Trigger → Process Data → Send Messages → Update Status

---

### STEP 3: Add "Log Execution Start" Node

#### 3.1: Create the Node

1. Click the **"+"** button in the top toolbar (or right-click on canvas → Add node)
2. Search for: **"HTTP Request"**
3. Click on **"HTTP Request"** to add it to the canvas
4. The node will appear on the canvas

#### 3.2: Configure the Node

Click on the newly created HTTP Request node. A configuration panel will open on the right side.

**Configuration settings:**

1. **Node Name:**
   - Change to: `Log N8N Execution Start`

2. **Authentication:**
   - Set to: `None`

3. **Request Method:**
   - Set to: `POST`

4. **URL:**
   ```
   https://app.meet-sam.com/api/n8n/log-execution
   ```

5. **Send Body:**
   - Toggle ON

6. **Body Content Type:**
   - Select: `JSON`

7. **JSON Body:**
   Click "Add Expression" and paste this EXACT code:
   ```javascript
   ={{
     {
       "workspace_id": $json.workspace_id,
       "n8n_execution_id": $execution.id,
       "n8n_workflow_id": $workflow.id,
       "execution_status": "running",
       "total_prospects": $json.prospect_count || 0,
       "current_step": "initialization",
       "progress_percentage": 0
     }
   }}
   ```

8. **Options → Continue On Fail:**
   - Toggle ON (This ensures logging failures don't stop the campaign)

9. **Options → Retry On Fail:**
   - Toggle OFF

#### 3.3: Position the Node

1. Drag the "Log N8N Execution Start" node to position it AFTER the webhook/trigger node
2. Position it BEFORE the main campaign logic begins

**Typical position in workflow:**
```
[Webhook/Trigger] → [Log Execution Start] → [Process Prospects] → [Send Messages]
```

#### 3.4: Connect the Node

1. Find the **output dot** on the Webhook/Trigger node (right side of the node)
2. Click and drag from the output dot to the **input dot** on the "Log Execution Start" node
3. Then connect the output of "Log Execution Start" to the next node in the original workflow

**Visual:**
```
[Webhook] ──→ [Log Start] ──→ [Original Next Node]
```

---

### STEP 4: Add "Log Execution Complete" Node

#### 4.1: Create the Node

1. Click the **"+"** button again
2. Search for: **"HTTP Request"**
3. Add another HTTP Request node

#### 4.2: Configure the Node

**Configuration settings:**

1. **Node Name:**
   - Change to: `Log N8N Execution Complete`

2. **Authentication:**
   - Set to: `None`

3. **Request Method:**
   - Set to: `POST`

4. **URL:**
   ```
   https://app.meet-sam.com/api/n8n/log-execution
   ```

5. **Send Body:**
   - Toggle ON

6. **Body Content Type:**
   - Select: `JSON`

7. **JSON Body:**
   Click "Add Expression" and paste this code (⚠️ **IMPORTANT:** Adjust node names to match YOUR workflow):

   ```javascript
   ={{
     {
       "workspace_id": $("Webhook").item.json.workspace_id || $("Start").item.json.workspace_id,
       "n8n_execution_id": $execution.id,
       "n8n_workflow_id": $workflow.id,
       "execution_status": "completed",
       "total_prospects": $json.total_count || 0,
       "successful_outreach": $json.success_count || 0,
       "failed_outreach": $json.fail_count || 0,
       "current_step": "completed",
       "progress_percentage": 100
     }
   }}
   ```

   **⚠️ CRITICAL:** You need to adjust the node references:
   - Replace `$("Webhook")` with the actual name of your trigger node
   - Replace `$json.total_count` with the actual variable that contains total prospects
   - Replace `$json.success_count` with the actual variable for successful sends
   - Replace `$json.fail_count` with the actual variable for failed sends

   **How to find the correct variable names:**
   1. Click on the last node before completion
   2. Click "Test Step" or look at the output data
   3. See what fields are available (e.g., `count`, `total`, `successCount`, etc.)
   4. Use those field names in the JSON body

8. **Options → Continue On Fail:**
   - Toggle ON

9. **Options → Retry On Fail:**
   - Toggle OFF

#### 4.3: Position and Connect the Node

1. Drag "Log Execution Complete" to the END of the workflow
2. Position it AFTER all message sending is complete
3. Connect it as the LAST node before workflow ends

**Typical position:**
```
[Send Messages] → [Update Status] → [Log Execution Complete] → [END]
```

---

### STEP 5: Add Error Logging (OPTIONAL but RECOMMENDED)

If the workflow has an error handler branch:

#### 5.1: Create Error Log Node

1. Add another HTTP Request node
2. Name it: `Log N8N Execution Error`

#### 5.2: Configure Error Node

Same settings as "Log Execution Complete" but change:

**JSON Body:**
```javascript
={{
  {
    "workspace_id": $("Webhook").item.json.workspace_id || $("Start").item.json.workspace_id,
    "n8n_execution_id": $execution.id,
    "n8n_workflow_id": $workflow.id,
    "execution_status": "failed",
    "current_step": "error",
    "error_details": $json.error?.message || "Unknown error occurred",
    "processed_prospects": $json.processed_count || 0,
    "successful_outreach": $json.success_count || 0,
    "failed_outreach": $json.fail_count || 0
  }
}}
```

#### 5.3: Connect to Error Handler

1. Find the error handling branch (if exists)
2. Connect this node to the error path

---

### STEP 6: Test the Workflow

#### 6.1: Test Execution

1. Click the **"Test Workflow"** button (top right)
2. Trigger the workflow with test data
3. Watch the execution flow through the nodes
4. Green checkmarks should appear on each node as it executes

#### 6.2: Check for Errors

If you see red X marks:
1. Click on the failed node
2. Read the error message
3. Common issues:
   - Incorrect variable names (e.g., `$json.prospect_count` doesn't exist)
   - Missing node references (e.g., `$("Webhook")` but node is named "Start")
   - Syntax errors in JSON

#### 6.3: Verify Database Logging

After successful test, verify the data was logged:

1. Open database tool (or run SQL query)
2. Execute this query:
   ```sql
   SELECT * FROM n8n_campaign_executions
   ORDER BY created_at DESC
   LIMIT 5;
   ```
3. You should see a new record with:
   - `n8n_execution_id` = the execution ID from N8N
   - `execution_status` = 'running' or 'completed'
   - Timestamp in `created_at`

**Expected result:** 1 new row in the table

---

### STEP 7: Save and Activate

1. Click **"Save"** button (top right)
2. Ensure workflow status is **"Active"** (toggle in top right)
3. The workflow is now logging executions!

---

### STEP 8: Repeat for Other 2 Workflows

Now repeat STEPS 2-7 for:

1. **Campaign Execute - LinkedIn via Unipile (Complete)** (ID: `iKIchXBOT7ahhIwa`)
2. **SAM Campaign Execution - FIXED (ACTIVE)** (ID: `pWxsl8D5irntaRwR`)

**⚠️ IMPORTANT:** Each workflow may have different variable names. Check the output data of each workflow to find the correct field names.

---

## 🔍 Troubleshooting

### Issue 1: "Cannot read property 'workspace_id'"

**Cause:** The webhook/trigger doesn't contain `workspace_id`

**Fix:** Check the actual webhook payload:
1. Click on the Webhook node
2. Look at the test data
3. Find where `workspace_id` is located (might be nested)
4. Update the reference: e.g., `$json.body.workspace_id` or `$json.data.workspace_id`

---

### Issue 2: "Node 'Webhook' not found"

**Cause:** The trigger node is named differently

**Fix:**
1. Look at the first node in the workflow - what's its name?
2. Replace `$("Webhook")` with `$("ActualNodeName")`
3. Common names: "Start", "Manual Trigger", "Webhook Trigger"

---

### Issue 3: "total_count is undefined"

**Cause:** The variable name doesn't match

**Fix:**
1. Click on the node BEFORE "Log Execution Complete"
2. Click "Test Step"
3. Look at the JSON output
4. Find the field that contains the count (might be `count`, `total`, `prospects`, etc.)
5. Update JSON body to use correct field name

---

### Issue 4: No data in database after test

**Possible causes:**

1. **Continue On Fail is ON and logging failed silently**
   - Check N8N execution log for errors in HTTP Request node
   - Look for 400/500 HTTP errors

2. **API endpoint not accessible**
   - Test the endpoint manually:
     ```bash
     curl -X POST https://app.meet-sam.com/api/n8n/log-execution \
       -H "Content-Type: application/json" \
       -d '{
         "workspace_id": "test-workspace-id",
         "n8n_execution_id": "test-exec-123",
         "n8n_workflow_id": "test-wf-456",
         "execution_status": "completed"
       }'
     ```
   - Should return: `{"success":true,"execution_id":"..."}`

3. **Missing required fields**
   - The API requires: `workspace_id`, `n8n_execution_id`, `n8n_workflow_id`
   - Check that all 3 are being sent

---

### Issue 5: Getting 400 error "Missing required fields"

**Fix:** Ensure these 3 fields are always present in the JSON body:
- `workspace_id` - Must be a valid UUID
- `n8n_execution_id` - Use `$execution.id`
- `n8n_workflow_id` - Use `$workflow.id`

---

## ✅ Verification Checklist

After updating all 3 workflows, verify:

### Per-Workflow Verification
- [ ] "Log Execution Start" node added and configured
- [ ] "Log Execution Start" node connected after trigger
- [ ] "Log Execution Complete" node added and configured
- [ ] "Log Execution Complete" node connected before end
- [ ] Test execution successful (green checkmarks)
- [ ] No errors in execution log
- [ ] Workflow saved
- [ ] Workflow is Active

### Database Verification
- [ ] Run test campaign (or manual trigger)
- [ ] Check `n8n_campaign_executions` table
- [ ] Verify new record exists with correct data
- [ ] `execution_status` shows 'completed'
- [ ] Prospect counts are correct
- [ ] Timestamps are recent

### Production Verification
- [ ] Wait for real campaign to execute
- [ ] Check database for new execution records
- [ ] Verify all 3 workflows are logging properly
- [ ] Monitor for any errors over 24 hours

---

## 📊 Expected Results

### After Updating All 3 Workflows

**Before:**
```sql
SELECT COUNT(*) FROM n8n_campaign_executions;
-- Result: 0
```

**After (with test executions):**
```sql
SELECT COUNT(*) FROM n8n_campaign_executions;
-- Result: 3+ (one per test execution)
```

**Detailed view:**
```sql
SELECT
  id,
  campaign_name,
  execution_status,
  total_prospects,
  successful_outreach,
  failed_outreach,
  created_at
FROM n8n_campaign_executions
ORDER BY created_at DESC
LIMIT 10;
```

**Expected data:**
- Each campaign execution creates a new row
- `execution_status` = 'completed' for successful runs
- Prospect counts match actual campaign activity
- Timestamps reflect execution time

---

## 🎯 Success Criteria

You've successfully completed this task when:

1. ✅ All 3 workflows have logging nodes added
2. ✅ Test executions create database records
3. ✅ No errors in N8N execution logs
4. ✅ Database query shows execution data
5. ✅ Real campaigns (when run) log to database automatically

---

## 📝 Common Variable Names by Workflow

To help you find the right variable names, here are common patterns:

### SAM Campaign Execution v2 - Clean
- Total prospects: `$json.prospect_count` or `$json.total_prospects`
- Success count: `$json.successful` or `$json.sent_count`
- Failed count: `$json.failed` or `$json.error_count`
- Workspace ID: `$json.workspace_id`

### Campaign Execute - LinkedIn via Unipile
- Total prospects: `$json.total` or `$json.count`
- Success count: `$json.success` or `$json.messages_sent`
- Failed count: `$json.errors` or `$json.failed`
- Workspace ID: `$json.workspaceId` or `$json.workspace_id`

### SAM Campaign Execution - FIXED
- Check the actual workflow output to confirm field names
- Use Test Step to see exact variable names

---

## 📚 Reference: Complete Node Configuration Example

### Example: Log Execution Start (Copy-Paste Ready)

**Node Type:** HTTP Request
**Name:** Log N8N Execution Start
**Method:** POST
**URL:** `https://app.meet-sam.com/api/n8n/log-execution`
**Authentication:** None
**Send Body:** Yes
**Body Content Type:** JSON

**JSON Body (Expression Mode):**
```javascript
={{
  {
    "workspace_id": $json.workspace_id,
    "n8n_execution_id": $execution.id,
    "n8n_workflow_id": $workflow.id,
    "execution_status": "running",
    "total_prospects": $json.prospect_count || 0,
    "current_step": "initialization",
    "progress_percentage": 0
  }
}}
```

**Options:**
- Continue On Fail: ✅ ON
- Retry On Fail: ❌ OFF

---

### Example: Log Execution Complete (Copy-Paste Ready)

**Node Type:** HTTP Request
**Name:** Log N8N Execution Complete
**Method:** POST
**URL:** `https://app.meet-sam.com/api/n8n/log-execution`
**Authentication:** None
**Send Body:** Yes
**Body Content Type:** JSON

**JSON Body (Expression Mode - ADJUST VARIABLE NAMES):**
```javascript
={{
  {
    "workspace_id": $("Webhook").item.json.workspace_id,
    "n8n_execution_id": $execution.id,
    "n8n_workflow_id": $workflow.id,
    "execution_status": "completed",
    "total_prospects": $json.total_count || 0,
    "successful_outreach": $json.success_count || 0,
    "failed_outreach": $json.fail_count || 0,
    "current_step": "completed",
    "progress_percentage": 100
  }
}}
```

**Options:**
- Continue On Fail: ✅ ON
- Retry On Fail: ❌ OFF

---

## 🚀 Quick Start Commands

### Test API Endpoint
```bash
curl -X POST https://app.meet-sam.com/api/n8n/log-execution \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "babdcab8-1a78-4b2f-913e-6e9fd9821009",
    "n8n_execution_id": "test-exec-123",
    "n8n_workflow_id": "test-wf-456",
    "execution_status": "completed",
    "total_prospects": 10,
    "successful_outreach": 8,
    "failed_outreach": 2
  }'
```

Expected response:
```json
{
  "success": true,
  "execution_id": "...",
  "message": "N8N execution logged successfully"
}
```

### Check Database
```sql
-- See all executions
SELECT * FROM n8n_campaign_executions ORDER BY created_at DESC LIMIT 10;

-- Count by status
SELECT execution_status, COUNT(*)
FROM n8n_campaign_executions
GROUP BY execution_status;

-- Recent executions with details
SELECT
  campaign_name,
  execution_status,
  total_prospects,
  successful_outreach,
  failed_outreach,
  ROUND(100.0 * successful_outreach / NULLIF(total_prospects, 0), 1) as success_rate,
  created_at
FROM n8n_campaign_executions
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

---

## 📞 Support

If you encounter issues:

1. **Check N8N execution logs** - Look for error messages in failed nodes
2. **Test API endpoint directly** - Use curl command above
3. **Verify database permissions** - Ensure table is accessible
4. **Check variable names** - Use Test Step to see actual data structure
5. **Review documentation** - See `docs/N8N-EXECUTION-TRACKING-SETUP.md` for more details

---

**Created:** November 3, 2025
**For:** Deep Agent - Manual N8N Workflow Updates
**Estimated Completion Time:** 45-60 minutes
**Status:** Ready for implementation
**API Endpoint:** ✅ Live and ready
**Database Table:** ✅ Ready to receive data
