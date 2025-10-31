# URGENT: Fix Client Campaign - 49 Stuck Prospects

**Date:** October 31, 2025
**Client Campaign:** 20251028-3AI-SEO search 3
**Issue:** 49 prospects stuck in queue for 8+ hours

---

## Problem Summary

17 client prospects have been **sent connection requests** but are stuck in `queued_in_n8n` status because:

1. ✅ Messages were sent successfully (have `unipile_message_id`)
2. ❌ N8N workflow didn't update status back to `connection_requested`
3. ❌ Database constraint prevents manual status update
4. ❌ Old constraint blocks `connection_requested` status value

**Impact:**
- Dashboard shows "0 sent" instead of "17 sent"
- Cannot track which prospects were actually contacted
- Campaign analytics are incorrect

---

## Root Cause

The `campaign_prospects` table has an outdated status constraint that doesn't include `connection_requested`. Multiple migrations created conflicting status values:

**Old constraint (blocking updates):**
```sql
CHECK (status IN (
    'pending', 'invitation_sent', 'connected', 'message_sent',
    'replied', 'interested', 'not_interested', 'bounced',
    'error', 'completed', 'paused', 'excluded'
))
```

**Current code expects:**
```sql
'connection_requested' -- Not in constraint! ❌
```

---

## Solution: 3-Step Fix

### Step 1: Apply Database Migration

**Action:** Update database constraint to allow current status values

1. **Open Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql
   ```

2. **Copy SQL from:**
   ```
   sql/migrations/20251031_cleanup_campaign_prospects.sql
   ```

3. **Paste into SQL Editor and click "Run"**

4. **Verify success message:**
   ```
   ✅ Campaign prospects schema cleaned up successfully
   ```

**What this does:**
- Drops old broken constraint
- Adds new constraint with all current statuses
- Creates helper function `mark_prospect_contacted()`
- Adds performance indexes

---

### Step 2: Fix Stuck Prospects

**Action:** Update the 17 prospects from `queued_in_n8n` to `connection_requested`

```bash
node scripts/js/fix-stuck-queued-prospects.mjs
```

**Expected output:**
```
📊 Found 56 total queued prospects:
   ✅ 17 have message IDs (will fix)
   ⏳ 39 waiting to send (will skip)

🔧 Starting fix...
Fixing: Stefanie Greenfeld
   ✅ Status: queued_in_n8n → connection_requested

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Summary:
   ✅ Fixed: 17
   ❌ Errors: 0
   ⏳ Still waiting: 39
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Step 3: Verify Fix

**Check Dashboard:**
```
Campaign: 20251028-3AI-SEO search 3
Expected: "17 of 49 contacted"
```

**Check Database:**
```bash
node scripts/js/view-campaign-queue.mjs
```

Expected: 17 prospects removed from queue

**Check LinkedIn:**
1. Go to: https://linkedin.com
2. Navigate to: My Network → Manage → Sent
3. Verify: 17 connection requests visible

---

## Status Values - Cleaned Up

### ✅ Valid Statuses (After Migration)

**Active Flow:**
- `pending` - Initial state
- `approved` - Approved for outreach
- `ready_to_message` - Ready to send
- `queued_in_n8n` - Queued in N8N workflow
- `contacted` - Legacy status (keep for compatibility)
- `connection_requested` - **NEW STANDARD** (LinkedIn CR sent)
- `connected` - Connection accepted
- `replied` - Prospect replied
- `completed` - Campaign sequence done

**Error States:**
- `failed` - Failed to send
- `error` - Error occurred
- `bounced` - Email bounced

**Inactive:**
- `not_interested` - Prospect declined
- `paused` - Paused
- `excluded` - Excluded

### ❌ Removed Statuses (Unused)

These were causing conflicts and have been removed:
- `invitation_sent` - Use `connection_requested` instead
- `message_sent` - Use sequence tracking instead
- `interested` - Use `replied` or custom notes

---

## Files Created/Modified

### Created:
- ✅ `sql/migrations/20251031_cleanup_campaign_prospects.sql` - Database fix
- ✅ `scripts/js/fix-stuck-queued-prospects.mjs` - Fixes stuck prospects
- ✅ `scripts/js/apply-schema-cleanup.mjs` - Migration instructions
- ✅ `docs/URGENT_FIX_CLIENT_CAMPAIGN.md` - This document

### Modified:
- None (migration only)

---

## Timeline

**Oct 31, 4:10 AM** - 49 prospects queued in campaign
**Oct 31, 4:10-4:20 AM** - 17 connection requests sent by N8N
**Oct 31, 12:30 PM** - Issue discovered (8 hours stuck)
**Oct 31, 12:45 PM** - Root cause identified (status constraint)
**Oct 31, 1:00 PM** - Migration created
**Next:** Apply migration and fix prospects

---

## Prevention

### Why This Happened

1. Multiple migrations created over time
2. Different migrations defined different status values
3. No single source of truth for valid statuses
4. Status constraint became outdated

### How to Prevent

1. **Single status enum:**
   - Document valid statuses in one place
   - All migrations must reference this list
   - Code must use these exact values

2. **Migration testing:**
   - Test all migrations on staging first
   - Verify constraint changes don't break existing code
   - Check for conflicting constraints before deploying

3. **N8N workflow fixes:**
   - Ensure N8N updates database after sending
   - Add error handling if status update fails
   - Monitor for stuck prospects daily

---

## Monitoring

### Daily Check (After Fix)

```bash
# Check for stuck prospects
node scripts/js/view-campaign-queue.mjs

# Should see:
# - Prospects older than 24 hours: 0
# - All queued prospects have no message_id yet
```

### Weekly Check

```sql
-- Find prospects stuck >48 hours
SELECT
  c.name,
  COUNT(*) as stuck_count,
  MIN(cp.personalization_data->>'queued_at') as oldest
FROM campaign_prospects cp
JOIN campaigns c ON c.id = cp.campaign_id
WHERE cp.status = 'queued_in_n8n'
  AND cp.personalization_data->>'unipile_message_id' IS NOT NULL
  AND (cp.personalization_data->>'queued_at')::timestamp < NOW() - INTERVAL '48 hours'
GROUP BY c.name;

-- Expected: 0 rows
```

---

## Next Steps After Fix

1. ✅ Apply migration (Step 1)
2. ✅ Fix stuck prospects (Step 2)
3. ✅ Verify dashboard shows correct counts
4. 🔍 Investigate why N8N didn't update status
5. 🔧 Fix N8N workflow to update database
6. 📊 Add monitoring for stuck prospects
7. 🚀 Resume campaign execution

---

## Support

**Questions?**
- Check: `/docs/CAMPAIGN_QUEUE_MONITORING.md`
- Check: `/docs/N8N_DATABASE_TRACKING_SETUP.md`

**Still stuck?**
- Slack: #sam-ai-support
- Email: dev@innovareai.com

---

**CRITICAL:** Execute Step 1 (migration) IMMEDIATELY to unblock the client campaign.

After migration: Run Step 2 to fix the 17 stuck prospects.
