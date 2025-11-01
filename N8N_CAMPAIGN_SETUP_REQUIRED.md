# 🚀 N8N Campaign Setup - Action Required

**Date:** November 1, 2025
**Status:** ✅ Code Deployed - Manual Configuration Needed

---

## ✅ What Was Fixed

### 1. **All Campaign Execution Now Via N8N**
- ✅ Removed direct Unipile API calls from campaign execution
- ✅ All LinkedIn campaigns now route through: `/api/campaigns/linkedin/execute-via-n8n`
- ✅ This calls N8N webhook: `https://innovareai.app.n8n.cloud/webhook/campaign-execute`
- ✅ Environment variable added: `N8N_CAMPAIGN_WEBHOOK_URL`
- ✅ Code deployed: Commit `533ae89c`

### 2. **Changed Files**
- `app/components/CampaignHub.tsx` - Updated all execution endpoints
- Netlify environment variables - Added `N8N_CAMPAIGN_WEBHOOK_URL`

---

## ⚠️ What Still Needs Manual Setup

### 🔴 CRITICAL: No LinkedIn Accounts Connected

**Issue:** All 6 workspaces have ZERO LinkedIn accounts in the database.

**Affected Workspaces:**
1. Blue Label Labs (`014509ba-226e-43ee-ba58-ab5f20d2ed08`)
2. InnovareAI Workspace (`babdcab8-1a78-4b2f-913e-6e9fd9821009`)
3. 3cubed Workspace (`ecb08e55-2b7e-4d49-8f50-d38e39ce2482`)
4. WT Matchmaker Workspace (`edea7143-6987-458d-8dfe-7e3a6c7a4e6e`)
5. True People Consulting (`dea5a7f2-673c-4429-972d-6ba5fca473fb`)
6. Sendingcell Workspace (`b070d94f-11e2-41d4-a913-cc5a8c017208`)

**To Fix:** Connect Michelle's LinkedIn account (or appropriate account) to the workspace(s) that will send campaigns.

---

## 📋 Step-by-Step Setup Guide

### Step 1: Connect LinkedIn Account to Workspace (5 min)

**Option A: Via Sam UI (Recommended)**
1. Go to: https://app.meet-sam.com
2. Select the workspace you want to use for campaigns
3. Click **Settings** → **Integrations**
4. Click **Connect LinkedIn**
5. Authenticate with Michelle's LinkedIn credentials
6. Authorize Unipile to access LinkedIn

**Option B: Via Direct Database Insert (Advanced)**
If the UI integration doesn't work, manually insert:

```sql
INSERT INTO workspace_accounts (
  workspace_id,
  provider,
  account_name,
  unipile_account_id,
  status
) VALUES (
  '014509ba-226e-43ee-ba58-ab5f20d2ed08', -- Blue Label Labs workspace
  'linkedin',
  'Michelle LinkedIn',
  'YOUR_UNIPILE_ACCOUNT_ID', -- Get this from Unipile dashboard
  'active'
);
```

**Where to get Unipile Account ID:**
1. Log into Unipile dashboard
2. Go to Accounts
3. Find Michelle's LinkedIn account
4. Copy the Account ID

---

### Step 2: Verify N8N Campaign Workflow Exists (3 min)

**Check:**
1. Go to: https://innovareai.app.n8n.cloud/workflows
2. Search for: "campaign" or "linkedin"
3. Find workflow that listens to webhook: `/webhook/campaign-execute`

**Expected Workflow Structure:**
```
Webhook Trigger (campaign-execute)
  ↓
Parse Campaign Data
  ↓
Get Campaign Details from Supabase
  ↓
Get Prospects to Message
  ↓
Loop: For Each Prospect
  ↓
  Get LinkedIn Account (Unipile)
  ↓
  Send LinkedIn Message (Unipile API)
  ↓
  Update Prospect Status (Supabase)
  ↓
Mark Campaign Complete
```

**If workflow doesn't exist:**
- Import the campaign workflow JSON
- Configure Unipile and Supabase credentials
- Activate the workflow

---

### Step 3: Activate N8N Workflow (1 min)

1. Open the campaign workflow
2. Click the toggle switch in top-right corner
3. Ensure status shows: **Active** ✅

---

### Step 4: Test Campaign Execution (5 min)

**Run Test Campaign:**

```bash
# Option 1: Via test script
node scripts/js/test-campaign-n8n.mjs

# Option 2: Via UI
1. Go to Sam UI
2. Select a campaign with 1 prospect
3. Click "Execute Campaign"
4. Watch for success message
```

**Expected Flow:**
1. ✅ Campaign button clicked
2. ✅ API call to `/api/campaigns/linkedin/execute-via-n8n`
3. ✅ N8N webhook receives data
4. ✅ N8N workflow executes
5. ✅ Unipile sends LinkedIn message
6. ✅ Message appears in LinkedIn
7. ✅ Prospect status updated to `connection_requested`

**Check N8N Execution:**
- Go to: https://innovareai.app.n8n.cloud/executions
- Find latest execution
- Verify all nodes succeeded (green)

**Check LinkedIn:**
- Go to: https://linkedin.com/mynetwork/invitation-manager/sent/
- Verify connection request appears

---

## 🔍 Troubleshooting

### Issue 1: "No LinkedIn account found"

**Symptom:** Campaign execution fails with "No LinkedIn account configured"

**Fix:**
- Complete Step 1 above
- Verify `workspace_accounts` table has entry with `provider='linkedin'`
- Ensure `unipile_account_id` is not null

**Verify:**
```bash
node scripts/js/check-linkedin-accounts.mjs
```

---

### Issue 2: "N8N webhook not responding"

**Symptom:** Campaign button succeeds but no N8N execution

**Causes:**
1. Workflow is inactive
2. Webhook URL incorrect
3. N8N service down

**Fix:**
1. Check workflow is **Active**
2. Verify webhook URL: `https://innovareai.app.n8n.cloud/webhook/campaign-execute`
3. Test webhook directly:

```bash
curl -X POST "https://innovareai.app.n8n.cloud/webhook/campaign-execute" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "test",
    "workspace_id": "test",
    "test_mode": true
  }'
```

---

### Issue 3: "Message sent but not in LinkedIn"

**Symptom:** N8N shows success but message not in LinkedIn

**Causes:**
1. Unipile account disconnected
2. LinkedIn session expired
3. Wrong Unipile account ID

**Fix:**
1. Reconnect LinkedIn in workspace settings
2. Check Unipile dashboard for account status
3. Verify `unipile_account_id` matches Unipile

---

## 📊 Verification Checklist

Before declaring success, verify:

- [ ] At least one workspace has LinkedIn account connected
- [ ] `workspace_accounts` table has entry with `unipile_account_id`
- [ ] N8N campaign workflow exists
- [ ] N8N workflow is **Active**
- [ ] Webhook URL is correct in environment variables
- [ ] Test campaign executes successfully
- [ ] N8N execution shows all green nodes
- [ ] Message appears in LinkedIn sent folder
- [ ] Prospect status updates to `connection_requested`

---

## 🎯 Success Criteria

**Campaign messaging is working when:**
1. ✅ User clicks "Execute Campaign" in UI
2. ✅ Webhook triggers N8N workflow
3. ✅ N8N calls Unipile API with correct account
4. ✅ Unipile sends message to LinkedIn
5. ✅ Message appears in LinkedIn
6. ✅ Prospect status updates in database
7. ✅ User sees success confirmation

---

## 📞 Support

**N8N Issues:**
- Dashboard: https://innovareai.app.n8n.cloud
- Executions: https://innovareai.app.n8n.cloud/executions

**Unipile Issues:**
- Check account status in Unipile dashboard
- Verify LinkedIn session is active

**Database Issues:**
- Use scripts in `scripts/js/` to diagnose
- Check Supabase logs

---

**Last Updated:** November 1, 2025
**Deployment:** Commit `533ae89c`
**Status:** ⚠️ Awaiting LinkedIn account connection and N8N workflow verification
