# N8N Enrichment Webhook - Current Status

**Date:** November 5, 2025, 12:42 PM
**Status:** 🟡 Webhook configured but needs manual reactivation

---

## Current Problem

The webhook is receiving requests but returning:
```
HTTP 500: "Workflow Webhook Error: Workflow could not be started!"
```

**Root Cause:** The `responseData` field wasn't being saved properly from the N8N UI.

**Fix Applied:** Updated via API - `responseData` is now set to `firstEntryJson`

---

## What Needs to Be Done (IN N8N UI)

### Step 1: Reactivate Workflow

1. Go to: https://workflows.innovareai.com/workflow/MlOCPY7qzZ2nEuue
2. **Toggle the workflow OFF** (top-right switch)
3. Wait 2 seconds
4. **Toggle the workflow ON**
5. Verify it shows "Active"

### Step 2: Test the Webhook

Run this command:
```bash
NEXT_PUBLIC_SUPABASE_URL="https://latxadqrvrrrcvkktrog.supabase.co" SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ" node scripts/manual-trigger-enrichment.mjs
```

**Expected:** HTTP 200 response with enrichment results (takes ~40 seconds for LinkedIn scraping)

---

## Workflow Details

- **Name:** SAM Prospect Enrichment - Data Approval (FIXED)
- **ID:** MlOCPY7qzZ2nEuue
- **Webhook URL:** https://workflows.innovareai.com/webhook/prospect-enrichment
- **Webhook Path:** prospect-enrichment (typo fixed from "propsect")

### Webhook Configuration (Now Correct)

```
HTTP Method: POST
Path: prospect-enrichment
Authentication: None
Respond: When Last Node Finishes
Response Data: firstEntryJson (FIXED via API)
```

---

## Test Prospect Details

**Job ID:** 7f8b24f4-0c62-4c15-808e-3a50bba52dc1
**Workspace:** babdcab8-1a78-4b2f-913e-6e9fd9821009
**Prospect:** prospect_1762298566456_fapokk7hn
**Name:** Sean Otto, PhD
**LinkedIn:** https://www.linkedin.com/in/seanottophd

Currently has no email/phone in database - enrichment should add this data.

---

## If Still Getting Errors

### Check N8N Execution Logs

1. Go to: https://workflows.innovareai.com/executions
2. Click latest execution (should be from test)
3. Look for which node is failing
4. Check error message

### Common Issues

**Issue:** "Workflow could not be started"
- **Fix:** Deactivate and reactivate workflow

**Issue:** Supabase node errors
- **Fix:** Verify all Supabase nodes use "Supabase account 3" credential

**Issue:** BrightData node errors
- **Fix:** Verify "Scrape LinkedIn Profile" node has Authentication: None

---

## Files Created for Debugging

- `scripts/check-n8n-workflows.mjs` - List all workflows
- `scripts/check-workflow-webhook.mjs` - Check webhook config
- `scripts/check-workflow-connections.mjs` - Verify node connections
- `scripts/check-n8n-executions.mjs` - View recent executions
- `scripts/fix-webhook-response-data.mjs` - Fix responseData via API
- `scripts/manual-trigger-enrichment.mjs` - Test webhook manually
- `scripts/monitor-enrichment.mjs` - Monitor job progress in real-time

---

## Next Steps After Webhook Works

1. ✅ Test enrichment completes successfully
2. ✅ Verify enriched data appears in `prospect_approval_data.contact` field
3. ✅ Check enrichment job status updates to "completed"
4. ✅ Monitor N8N execution logs for any errors
5. ✅ Test with multiple prospects (2-3)
6. ✅ Update production code to use this workflow

---

## For Claude Desktop

**Task:** Fix the N8N webhook so it stops returning HTTP 500 errors.

**What to do:**
1. Open N8N workflow editor: https://workflows.innovareai.com/workflow/MlOCPY7qzZ2nEuue
2. Toggle workflow OFF then ON
3. Test webhook with the command above
4. If still failing, check execution logs for specific error
5. Fix any node configuration issues found

**The webhook configuration is correct - it just needs a reactivation to register properly.**
