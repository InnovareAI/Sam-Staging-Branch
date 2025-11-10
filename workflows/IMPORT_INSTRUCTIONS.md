# Import Fixed N8N Workflow

## ✅ What Was Fixed

The new workflow includes:

1. **✅ Cadence Delay Wait Node** - Waits `send_delay_minutes` before sending each CR
2. **✅ Status Update After CR** - Updates prospect to `connection_requested` in database
3. **✅ Proper Data Flow** - All nodes connected correctly

## 📁 File Location

**Fixed Workflow:** `workflows/SAM-Master-Campaign-Orchestrator-FIXED.json`

## 🔧 Import Instructions

### Step 1: Backup Current Workflow (Optional but Recommended)

1. Go to https://workflows.innovareai.com
2. Find "SAM Master Campaign Orchestrator"
3. Click "..." menu → "Duplicate"
4. Rename to "SAM Master Campaign Orchestrator - BACKUP"

### Step 2: Delete or Deactivate Old Workflow

**Option A: Deactivate (Safer)**
1. Open "SAM Master Campaign Orchestrator"
2. Click "Active" toggle to turn it OFF
3. Close the workflow

**Option B: Delete (Clean slate)**
1. Click "..." on "SAM Master Campaign Orchestrator"
2. Click "Delete"
3. Confirm deletion

### Step 3: Import Fixed Workflow

1. In N8N, click "Add Workflow" dropdown
2. Select "Import from File"
3. Click "Select file to import"
4. Navigate to: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/workflows/`
5. Select: `SAM-Master-Campaign-Orchestrator-FIXED.json`
6. Click "Import"

### Step 4: Activate Workflow

1. The workflow will open automatically
2. Review the nodes (you should see 46 total)
3. Check for the new nodes:
   - "Wait for Cadence Delay" (after Merge Profile Data)
   - "Update Status - CR Sent" (after Send CR)
4. Click "Active" toggle to turn it ON
5. Save the workflow

### Step 5: Verify Configuration

Check these critical nodes:

**Wait for Cadence Delay:**
- Resume: After time interval
- Amount: `={{ $json.send_delay_minutes || 0 }}`
- Unit: minutes

**Update Status - CR Sent:**
- Method: POST
- URL: `https://app.meet-sam.com/api/webhooks/n8n/prospect-status`
- Body Parameters:
  - `prospect_id`: `={{ $json.prospect.id }}`
  - `campaign_id`: `={{ $json.campaign_id }}`
  - `status`: `connection_requested`

## ✅ Testing

### Test 1: Small Campaign (2-3 prospects)

1. Go to https://app.meet-sam.com
2. Create or use existing campaign
3. Execute with 2-3 prospects
4. Monitor N8N executions

**Expected Results:**
- ✅ Workflow starts successfully
- ✅ First prospect: Sends immediately (0 min delay)
- ✅ Second prospect: Waits ~65 minutes, then sends
- ✅ Third prospect: Waits ~121 minutes, then sends

### Test 2: Database Verification

```sql
SELECT
  first_name,
  last_name,
  status,
  contacted_at,
  created_at
FROM campaign_prospects
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
ORDER BY contacted_at DESC;
```

**Expected:**
- ✅ Status = `connection_requested` (not `queued_in_n8n`)
- ✅ `contacted_at` is populated
- ✅ Time differences match cadence pattern

### Test 3: N8N Execution Logs

1. Go to N8N → Executions
2. Click on the latest execution
3. Check each node:
   - ✅ "Wait for Cadence Delay" shows waiting time
   - ✅ "Update Status - CR Sent" shows successful POST
   - ✅ No red error nodes

## 🎯 Expected Behavior

### Today's Pattern (Nov 10, 2025)

Based on current cadence randomizer:

```
Prospect 1: 9:00 AM  (0 min delay)    → IMMEDIATE
Prospect 2: 10:14 AM (+74 min delay)  → 🔥 BURST
Prospect 3: 10:33 AM (+19 min delay)  → 🔥 BURST
Prospect 4: 10:42 AM (+9 min delay)   → 🔥 BURST
...
```

### Hourly Distribution

```
9AM-10AM:  1 msg  📊
10AM-11AM: 3 msgs 🔥
11AM-12PM: 5 msgs 🔥🔥
12PM-1PM:  2 msgs 📊
1PM-2PM:   3 msgs 🔥
2PM-3PM:   1 msg  📊
3PM-4PM:   0 msgs 💤 PAUSE
4PM-5PM:   2 msgs 📊
5PM-6PM:   3 msgs 🔥
```

## 🔴 Troubleshooting

### Issue: Workflow not importing

**Solution:**
- Make sure you're using N8N v1.0+
- Try opening the JSON file and checking for syntax errors
- Contact support if file is corrupted

### Issue: Wait node not working

**Check:**
- Expression: `={{ $json.send_delay_minutes || 0 }}`
- Unit: "minutes" (not "seconds")
- Make sure prospect data includes `send_delay_minutes`

### Issue: Status not updating

**Check:**
- Webhook URL is correct: `https://app.meet-sam.com/api/webhooks/n8n/prospect-status`
- Body parameters are using correct expressions
- Check Netlify function logs for errors

### Issue: All prospects sending immediately

**Cause:** Wait node is receiving 0 or null for `send_delay_minutes`

**Solution:**
- Check execute-live route is calculating delays correctly
- Verify N8N webhook is receiving the data
- Check Campaign Handler is preserving `send_delay_minutes` field

## 📊 Success Metrics

After importing and testing:

- ✅ Prospects show `connection_requested` status
- ✅ `contacted_at` timestamps are populated
- ✅ Time gaps between sends match cadence pattern
- ✅ No workflow execution errors
- ✅ LinkedIn shows connection requests sent
- ✅ When prospects accept, status updates to `connected`

## 🆘 Rollback

If something goes wrong:

1. Deactivate the new workflow
2. Reactivate your backup: "SAM Master Campaign Orchestrator - BACKUP"
3. Or re-import the original from: `workflows/n8n-campaign-orchestrator-BACKUP-20251110.json`

## 📞 Support

If you need help:

1. Check N8N execution logs for errors
2. Check database for prospect statuses
3. Review `workflows/N8N_WORKFLOW_FIXES_NEEDED.md` for manual fixes
4. Contact your development team with:
   - Execution ID from N8N
   - Campaign ID
   - Error messages (if any)
