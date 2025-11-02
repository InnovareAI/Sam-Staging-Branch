# 🎯 Ready for Claude Desktop - N8N Workflow Fix

**Status:** ✅ ALL PREPARATION COMPLETE
**Date:** November 2, 2025
**Estimated Time:** 15-20 minutes

---

## ✅ What's Been Completed

1. ✅ **Fixed N8N Workflow Created**
   - File: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/n8n-campaign-workflow-FIXED.json`
   - Has all proper Unipile API payloads
   - Includes randomized delays (2-5 min anti-spam)
   - Updates prospect statuses in database

2. ✅ **Sam API Route Configured**
   - File: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/campaigns/linkedin/execute-via-n8n/route.ts`
   - Points to webhook: `https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed`
   - Ready to call N8N workflow

3. ✅ **Comprehensive Documentation Created**
   - Handoff guide: `N8N_WORKFLOW_FIX_HANDOFF.md`
   - Diagnostic report: `N8N_WORKFLOW_CONFIG_REQUIRED.md`

4. ✅ **Test Data Prepared**
   - Campaign: "20251101-IAI-Outreach Campaign"
   - Prospects: 4 prospects with status='queued_in_n8n'
   - Script: `scripts/js/reset-to-pending.mjs` (resets for testing)

---

## 🎯 Your Mission (Claude Desktop)

### Step 1: Import Fixed Workflow into N8N (5 min)

1. **Go to:** https://innovareai.app.n8n.cloud
2. **Click:** Workflows → "+" → Import from File
3. **Upload:** `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/n8n-campaign-workflow-FIXED.json`
4. **Activate:** Toggle switch in top-right (make it green)

**Result:** New workflow active at `/webhook/campaign-execute-fixed`

### Step 2: Set Environment Variables (2 min)

1. **Go to:** Profile Icon (bottom left) → Settings → Variables
2. **Add these:**
   ```
   UNIPILE_DSN = api6.unipile.com:13670
   UNIPILE_API_KEY = [get from .env.local file]
   ```

**Get values from:** `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/.env.local`

### Step 3: Verify Workflow Structure (3 min)

**Click through each node to verify:**

1. **Campaign Execute Webhook** - Path: `campaign-execute-fixed` ✓
2. **Extract Campaign Data** - Has JavaScript code ✓
3. **Process Each Prospect** - Batch size: 1 ✓
4. **Get LinkedIn Profile ID** - GET to Unipile API ✓
5. **Send Connection Request** - POST to `/users/invite` with BODY ✓
6. **Update Prospect Status** - POST to Sam API ✓
7. **Random Delay** - 2-5 minutes ✓
8. **Loop Back** - Connects back to step 3 ✓

### Step 4: Test the Workflow (5 min)

**Option A: From Sam UI (Recommended)**

```bash
# Reset prospects to pending
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
node scripts/js/reset-to-pending.mjs

# Then go to Sam UI and execute campaign
open https://app.meet-sam.com
# Find "20251101-IAI-Outreach Campaign"
# Click "Execute Campaign"
```

**Option B: Direct Webhook Test**

```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
source .env.local

# Get Unipile account ID from database first
curl -X POST "https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "5067bfd4-e4c6-4082-a242-04323c8860c8",
    "workspace_id": "babdcab8-1a78-4b2f-913e-6e9fd9821009",
    "campaign_data": {
      "message_templates": {
        "connection_request": "Hi {first_name}, test message"
      },
      "prospects": [{
        "id": "test-1",
        "first_name": "Test",
        "last_name": "User",
        "company": "Test Corp",
        "job_title": "CEO",
        "linkedin_url": "https://linkedin.com/in/testuser"
      }]
    },
    "workspace_config": {
      "integration_config": {
        "linkedin_accounts": [{
          "unipile_account_id": "YOUR_UNIPILE_ACCOUNT_ID_HERE"
        }]
      }
    }
  }'
```

### Step 5: Verify Success (5 min)

**Check 1: N8N Execution**
- Go to: https://innovareai.app.n8n.cloud/executions
- Find latest execution
- All nodes should be GREEN ✅
- Execution time should be > 2 minutes (with delays)

**Check 2: Database**
```bash
node scripts/js/check-campaign-prospects.mjs
```
Expected:
- Status: `connection_requested` (not `queued_in_n8n`)
- Has `contacted_at` timestamp
- Has `unipile_message_id` in personalization_data

**Check 3: LinkedIn**
- Go to: https://linkedin.com/mynetwork/invitation-manager/sent/
- Should see connection request to test prospect

---

## 🔍 Common Issues & Fixes

### Issue 1: "Environment variable UNIPILE_DSN not found"
**Fix:** Add variables in N8N Settings → Variables (see Step 2)

### Issue 2: "Send Connection Request node fails"
**Fix:** Check that body has JSON with `account_id`, `user_id`, `message`

### Issue 3: "LinkedIn profile not found"
**Fix:** LinkedIn URL format must be `https://linkedin.com/in/username`

### Issue 4: "Unipile API 401 Unauthorized"
**Fix:** Verify UNIPILE_API_KEY is correct in environment variables

---

## 📊 Success Criteria

✅ **You'll know it's working when:**

1. N8N execution completes with all green nodes
2. Execution time is > 2 minutes (delays working)
3. Database shows `status='connection_requested'`
4. LinkedIn shows connection request in "Sent" folder
5. No red nodes in N8N execution
6. Sam UI shows "X connection requests sent"

---

## 📁 Key Files Reference

**Workflow JSON:**
`/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/n8n-campaign-workflow-FIXED.json`

**Sam API Route:**
`/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/campaigns/linkedin/execute-via-n8n/route.ts`

**Environment Variables:**
`/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/.env.local`

**Test Scripts:**
- Reset prospects: `scripts/js/reset-to-pending.mjs`
- Check status: `scripts/js/check-campaign-prospects.mjs`

**Documentation:**
- Full handoff: `N8N_WORKFLOW_FIX_HANDOFF.md`
- Diagnostic report: `N8N_WORKFLOW_CONFIG_REQUIRED.md`

---

## 🚀 Quick Start Commands

```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7

# 1. Reset test prospects
node scripts/js/reset-to-pending.mjs

# 2. Check prospect status
node scripts/js/check-campaign-prospects.mjs

# 3. Test N8N webhook (after importing workflow)
source .env.local
curl -X POST "https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed" \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

---

## 🎬 Final Steps After Success

Once everything is working:

1. ✅ Deploy to production:
   ```bash
   git add .
   git commit -m "feat: N8N workflow integration with full funnel"
   git push
   ```

2. ✅ Update environment variable:
   ```bash
   netlify env:set N8N_CAMPAIGN_WEBHOOK_URL "https://innovareai.app.n8n.cloud/webhook/campaign-execute-fixed"
   ```

3. ✅ Test with real prospects (start with 1-2)

4. ✅ Monitor N8N executions for 24 hours

---

## 📞 Need Help?

**If stuck, check:**
- N8N executions page for error details
- Netlify function logs for API errors
- `N8N_WORKFLOW_FIX_HANDOFF.md` for detailed instructions

**Ready to go! Good luck! 🚀**
