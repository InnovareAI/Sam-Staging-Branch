# SAM Campaign Management - Reliable Deployment Plan

**Created:** November 20, 2025
**Status:** All systems STOPPED - rebuilding from scratch
**Goal:** Working campaign system in 24 hours

---

## ROOT CAUSE OF 2.5 MONTH FAILURE

**N8N workflow was NEVER properly deployed to production.**

Evidence:
- Workflow file exists: `/Users/tvonlinz/Desktop/UPLOAD_THIS_TO_N8N.json`
- N8N logs: "webhook not registered" errors
- Webhooks return 404/timeout
- File was never imported into N8N instance

**All other issues were symptoms of this core problem.**

---

## DEPLOYMENT PLAN - 6 STEPS

### ✅ STEP 1: STOP ALL CRONS (COMPLETED)

**What we did:**
- Removed Docker cron
- Disabled Netlify cron (commented out in netlify.toml)
- Killed 100+ zombie crond processes

**Verification:**
```bash
ssh root@workflows.innovareai.com "crontab -l"
# Output: no crontab for root ✓
```

**Status:** ✅ COMPLETE

---

### 🔲 STEP 2: UPLOAD N8N WORKFLOW (15 MIN)

**Action required:** MANUAL (you must do this)

**Steps:**
1. Open browser: https://workflows.innovareai.com
2. Login to N8N
3. Click "+" → "Import from File"
4. Select: `/Users/tvonlinz/Desktop/UPLOAD_THIS_TO_N8N.json`
5. Click "Save"
6. Click "Activate" toggle (top right)

**Verification test:**
```bash
curl -X POST https://workflows.innovareai.com/webhook/connector-campaign \
  -H "Content-Type: application/json" \
  -d '{"test": "ping"}'
```

**Expected response:** JSON (not 404 or "webhook not registered")

**Status:** 🔲 PENDING YOUR ACTION

---

### 🔲 STEP 3: TEST WITH 1 PROSPECT (5 MIN)

**Once N8N workflow is active:**

Run this script:
```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
node scripts/test-single-prospect.mjs
```

**What it does:**
1. Takes 1 prospect from Charissa's campaign
2. Calls `/api/campaigns/linkedin/execute-via-n8n`
3. Verifies N8N receives it
4. Checks Unipile sends CR
5. Confirms database updates

**Success criteria:**
- ✅ API returns 200
- ✅ N8N shows execution in logs
- ✅ Prospect status changes to 'queued_in_n8n'
- ✅ CR appears in LinkedIn (check manually)

**Status:** 🔲 BLOCKED BY STEP 2

---

### 🔲 STEP 4: ENABLE ONE CRON SYSTEM (2 MIN)

**DECISION: Use Docker cron (more reliable than Netlify)**

**Why Docker:**
- Runs on same server as N8N
- No Netlify function timeout issues
- Direct control
- One less external dependency

**Enable cron:**
```bash
ssh root@workflows.innovareai.com "cat > /tmp/crontab << 'EOF'
*/2 * * * * /bin/bash /opt/sam-cron/trigger.sh >> /var/log/sam-cron.log 2>&1
EOF
crontab /tmp/crontab"
```

**Verification:**
```bash
ssh root@workflows.innovareai.com "crontab -l"
# Should show: */2 * * * * ...
```

**Status:** 🔲 BLOCKED BY STEP 3

---

### 🔲 STEP 5: MONITOR FOR 2 HOURS (PASSIVE)

**Watch these 3 things:**

1. **Cron execution logs:**
```bash
ssh root@workflows.innovareai.com "tail -f /var/log/sam-cron.log"
```

2. **N8N execution logs:**
```bash
ssh root@workflows.innovareai.com "docker logs -f n8n | grep -E 'webhook|execution|error'"
```

3. **Database prospect statuses:**
```bash
node scripts/check-specific-accounts.mjs
# Run every 10 minutes
```

**Success criteria:**
- ✅ Cron runs every 2 min
- ✅ API finds active campaigns
- ✅ N8N receives payloads
- ✅ Prospects change status: pending → queued_in_n8n → connection_request_sent
- ✅ CRs appear in LinkedIn

**Red flags:**
- ❌ "webhook not registered" errors
- ❌ Prospects stuck in 'pending'
- ❌ Cron stops running
- ❌ N8N timeouts

**Status:** 🔲 BLOCKED BY STEP 4

---

### 🔲 STEP 6: DEPLOY TO PRODUCTION (5 MIN)

**Once 2-hour monitoring passes:**

1. **Commit changes:**
```bash
git add netlify.toml scripts/
git commit -m "Campaign system: Docker cron + N8N workflow deployment"
git push origin main
```

2. **Re-enable for all campaigns:**
   - No code changes needed
   - System already handles all active campaigns

3. **Notify users:**
   - Charissa: campaigns will start executing
   - Michelle: campaigns will start executing

**Status:** 🔲 BLOCKED BY STEP 5

---

## WHAT MAKES THIS PLAN RELIABLE

**Single point of failure:**
- N8N workflow is the ONLY thing that needs to work
- Everything else is simple API calls

**Clear verification at each step:**
- Can't proceed until previous step verified
- No assumptions
- Test with 1 prospect before scaling

**No competing systems:**
- ONE cron (Docker)
- ONE workflow (N8N)
- ONE API endpoint
- No conflicts

**Rollback plan:**
- Keep Netlify cron disabled in git
- If Docker cron fails, re-enable Netlify cron
- N8N workflow can be deactivated instantly

---

## CURRENT STATUS

| Step | Status | Blocker |
|------|--------|---------|
| 1. Stop all crons | ✅ DONE | None |
| 2. Upload N8N workflow | 🔲 PENDING | YOU need to do this |
| 3. Test 1 prospect | 🔲 BLOCKED | Step 2 |
| 4. Enable cron | 🔲 BLOCKED | Step 3 |
| 5. Monitor 2 hours | 🔲 BLOCKED | Step 4 |
| 6. Deploy production | 🔲 BLOCKED | Step 5 |

---

## NEXT ACTION: YOU

**Go to N8N and upload the workflow:**
1. https://workflows.innovareai.com
2. Import: `/Users/tvonlinz/Desktop/UPLOAD_THIS_TO_N8N.json`
3. Activate it
4. Tell me when done

**Then I'll run Step 3 (test with 1 prospect)**

---

## ACCOUNTABILITY

**If this fails:**
- Not trying different approaches
- Not blaming tools
- Root cause: N8N workflow not active

**Fix:** Upload the damn workflow file.

**ETA to working system:** 24 hours from now (assuming you upload workflow in next hour)

---

**Last Updated:** November 20, 2025 14:45 PT
**Next Review:** After Step 2 complete
