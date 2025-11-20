# N8N Fix - Action Plan

**Date:** November 20, 2025
**Time to Fix:** 5 minutes
**Risk Level:** Low (non-destructive change)

---

## Problem

LinkedIn invitations are being sent successfully, but the database is **NOT** being updated with the correct status. This breaks campaign tracking.

**Root Cause:** Invalid N8N expression syntax in one node.

---

## The Fix (Choose One Method)

### Method 1: Upload Corrected Workflow (RECOMMENDED)

**Time:** 2 minutes

1. Open https://workflows.innovareai.com
2. Log in to N8N
3. Find workflow "SAM Master Campaign Orchestrator"
4. Click the "..." menu (top-right)
5. Select "Import from JSON"
6. Choose file: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/temp/SAM-Master-Campaign-Orchestrator-CORRECTED.json`
7. Click "Import"
8. Click "Save" (top-right)
9. ✅ Done!

---

### Method 2: Manual Edit in N8N UI

**Time:** 5 minutes

1. Open https://workflows.innovareai.com
2. Log in to N8N
3. Open workflow "SAM Master Campaign Orchestrator"
4. Find node: "Update Status - CR Sent" (it's near "Send CR" node)
5. Click the node to open its parameters
6. Scroll to "Body Parameters" section
7. Ensure "Specify Body" dropdown is set to **"JSON"**
8. In the text field below, replace the entire content with:

```
={{ { prospect_id: $json.prospect.id, campaign_id: $json.campaign_id, status: "connection_requested", contacted_at: $now.toISO() } }}
```

9. Click "Save" (top-right)
10. ✅ Done!

---

## What Changed

**Before (BROKEN):**
```json
"={\n  \"prospect_id\": \"{{ $json.prospect.id }}\",\n  \"campaign_id\": \"{{ $json.campaign_id }}\",\n  \"status\": \"connection_requested\",\n  \"contacted_at\": \"{{ $now.toISO() }}\"\n}"
```

**After (FIXED):**
```json
"={{ { prospect_id: $json.prospect.id, campaign_id: $json.campaign_id, status: \"connection_requested\", contacted_at: $now.toISO() } }}"
```

**Key Differences:**
- Removed `{{ }}` Handlebars syntax
- Removed quotes around variable names
- Used pure JavaScript object notation
- Kept only N8N expression syntax `={{ }}`

---

## Verification

### Test 1: Check N8N Execution Logs

1. In N8N, go to "Executions" tab
2. Find the most recent execution
3. Click to view details
4. Look for "Update Status - CR Sent" node
5. Should show ✅ Success (not ❌ Error)

### Test 2: Check Database

Run this in your terminal:

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, status, contacted_at')
    .eq('status', 'connection_requested')
    .order('contacted_at', { ascending: false })
    .limit(3);

  console.log('Recent connection requests:');
  data.forEach(p => {
    console.log(\`  \${p.first_name} \${p.last_name}: \${p.contacted_at}\`);
  });
})();
"
```

**Expected Output:**
```
Recent connection requests:
  [Name]: [Recent timestamp]
  [Name]: [Recent timestamp]
  ...
```

### Test 3: Send a Test Campaign (Optional)

1. Create a test campaign with 1 prospect
2. Execute the campaign
3. Check database for updated status
4. Should show `status='connection_requested'` immediately after sending

---

## If It Still Doesn't Work

### Troubleshooting Steps

1. **Check N8N Workflow is Active:**
   - Go to Workflows list
   - Look for "SAM Master Campaign Orchestrator"
   - Toggle should be ON (blue)

2. **Check Webhook URL is Correct:**
   - In N8N, open "Update Status - CR Sent" node
   - URL should be: `https://app.meet-sam.com/api/webhooks/n8n/prospect-status`
   - Method should be: `POST`

3. **Check Node Configuration:**
   - "Specify Body" should be: `JSON`
   - "jsonBody" should start with: `={{`
   - No `{{ }}` syntax anywhere in the jsonBody

4. **Check Netlify Logs:**
   - Go to Netlify dashboard
   - View function logs for `/api/webhooks/n8n/prospect-status`
   - Look for POST requests with 200 status

5. **Re-test Webhook Directly:**
   ```bash
   node scripts/test-webhook-with-simon.mjs
   ```
   - Should show ✅ Success
   - If this works but N8N doesn't, the issue is in N8N configuration

---

## Rollback Plan

If the fix causes any issues (unlikely):

1. Go to N8N workflow
2. Find "Update Status - CR Sent" node
3. Revert to previous configuration (see backup below)
4. Click "Save"

**Backup (Original Broken Configuration):**
```json
"={\n  \"prospect_id\": \"{{ $json.prospect.id }}\",\n  \"campaign_id\": \"{{ $json.campaign_id }}\",\n  \"status\": \"connection_requested\",\n  \"contacted_at\": \"{{ $now.toISO() }}\"\n}"
```

---

## Additional Recommendations

### Fix Status Value Inconsistency

**Optional - Can be done later**

The cron job uses a different status value. To standardize:

1. Edit file: `/scripts/send-scheduled-prospects-cron.mjs`
2. Find line ~150: `status: 'connection_request_sent'`
3. Change to: `status: 'connection_requested'`
4. Save file
5. Redeploy cron job

### Monitor Webhook Calls

Set up monitoring to catch future issues:

1. Add Netlify log alerts for 500 errors on webhook endpoint
2. Add N8N execution monitoring for failed workflow runs
3. Add database checks for prospects stuck in "pending" status

---

## Success Criteria

After applying the fix, you should see:

✅ N8N workflow executions show no errors
✅ "Update Status - CR Sent" node executes successfully
✅ Database `campaign_prospects` table updates immediately after LinkedIn invitation sent
✅ Status changes from `pending` → `connection_requested`
✅ `contacted_at` timestamp is set correctly
✅ No more prospects stuck in "pending" status after invitation sent

---

## Files Referenced

- **Corrected Workflow:** `/temp/SAM-Master-Campaign-Orchestrator-CORRECTED.json`
- **Webhook Endpoint:** `/app/api/webhooks/n8n/prospect-status/route.ts`
- **Test Script:** `/scripts/test-webhook-with-simon.mjs`
- **Cron Job:** `/scripts/send-scheduled-prospects-cron.mjs`
- **Full Report:** `/N8N_WEBHOOK_FIX_REPORT.md`
- **Visual Guide:** `/N8N_WEBHOOK_FIX_VISUAL.md`

---

## Questions?

If you need help:
1. Check the full report: `N8N_WEBHOOK_FIX_REPORT.md`
2. Check the visual guide: `N8N_WEBHOOK_FIX_VISUAL.md`
3. Test the webhook directly: `node scripts/test-webhook-with-simon.mjs`
4. Check N8N execution logs for specific error messages

---

**Ready to fix? Start with Method 1 (Upload Corrected Workflow) - it's the fastest and safest approach!**
