# N8N Database Tracking Setup Guide

## Overview

This guide completes the LinkedIn campaign execution tracking system by adding automatic database updates when N8N sends LinkedIn connection requests.

## What Was Done

### 1. N8N Workflow Updated
- **File:** `/tmp/workflow-with-db-update.json`
- **Workflow ID:** aVG6LC4ZFRMN7Bw6
- **Status:** ✅ Imported, ⚠️ Needs activation

### 2. Database Migration Created
- **File:** `sql/migrations/20251030_campaign_tracking_enhancements.sql`
- **Status:** ⏳ Ready to execute

### 3. Helper Scripts Created
- `scripts/js/run-campaign-tracking-migration.mjs` - Migration runner
- `scripts/js/mark-prospects-contacted.mjs` - Manual fix for existing prospects
- `scripts/js/reset-queued-prospects.mjs` - Reset stuck prospects

---

## Step-by-Step Setup

### Step 1: Apply Database Migration

**Go to Supabase SQL Editor:**
```
https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql
```

**Copy and execute the SQL from:**
```bash
cat sql/migrations/20251030_campaign_tracking_enhancements.sql
```

**What this creates:**
1. **Columns** (if missing):
   - `contacted_at` - Timestamp when prospect contacted
   - `status` - Current prospect status
   - `personalization_data` - JSONB metadata

2. **Indexes for performance:**
   - `idx_campaign_prospects_status`
   - `idx_campaign_prospects_contacted_at`
   - `idx_campaign_prospects_campaign_status`
   - `idx_campaign_prospects_ready_to_contact`

3. **Database Functions:**
   - `update_prospect_contacted(prospect_id, unipile_message_id)` - Updates prospect after sending
   - `get_prospects_ready_for_messaging(campaign_id, limit)` - Retrieves prospects to contact

### Step 2: Activate N8N Workflow

**Go to N8N workflow:**
```
https://workflows.innovareai.com/workflow/aVG6LC4ZFRMN7Bw6
```

**Actions:**
1. Toggle "Active" switch to ON
2. Verify the new "Update Database" node exists
3. Confirm node order: Send CR → **Update Database** → Log Result

### Step 3: Verify N8N Workflow Configuration

The "Update Database" node should have:

**Type:** HTTP Request
**Method:** PATCH
**URL:** `{{ $('Split Prospects').item.json.supabase_url }}/rest/v1/campaign_prospects`
**Query Parameters:**
- `id` = `eq.{{ $('Split Prospects').item.json.prospect_id }}`

**Headers:**
- `apikey`: `{{ $('Split Prospects').item.json.supabase_service_key }}`
- `Authorization`: `Bearer {{ $('Split Prospects').item.json.supabase_service_key }}`
- `Content-Type`: `application/json`
- `Prefer`: `return=minimal`

**Body (JSON):**
```json
{
  "contacted_at": "{{ new Date().toISOString() }}",
  "status": "contacted"
}
```

---

## Testing the Complete Flow

### Test 1: Dry Run
```bash
# Execute dry run (no messages sent)
node scripts/js/test-execute-live-api.mjs --dry-run
```

**Expected:**
- Shows prospects that would be queued
- No N8N execution
- No database changes

### Test 2: Live Execution (1 Prospect)
```bash
# Queue ONE prospect for real execution
node scripts/js/test-execute-live-api.mjs --max=1
```

**Expected:**
1. Prospect status changes to `queued_in_n8n`
2. N8N workflow executes
3. LinkedIn connection request sent
4. Database automatically updates:
   - `contacted_at` = current timestamp
   - `status` = `contacted`
   - `personalization_data` contains tracking metadata

### Test 3: Verify Database Update
```sql
-- Check most recent contact
SELECT
  id,
  first_name,
  last_name,
  status,
  contacted_at,
  personalization_data->>'unipile_message_id' as message_id,
  personalization_data->>'contacted_via' as contacted_via
FROM campaign_prospects
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
  AND contacted_at > NOW() - INTERVAL '1 hour'
ORDER BY contacted_at DESC
LIMIT 1;
```

**Expected Output:**
```
first_name | last_name | status    | contacted_at         | message_id | contacted_via
-----------|-----------|-----------|----------------------|------------|---------------
John       | Doe       | contacted | 2025-10-30 14:30:00 | msg_abc... | n8n_workflow
```

### Test 4: Verify on LinkedIn
1. Go to LinkedIn: https://linkedin.com
2. Navigate to: My Network → Manage → Sent
3. Confirm connection request appears for the test prospect

---

## How N8N Now Works

### Current Flow:
```
Webhook Trigger
  ↓
Campaign Handler (parses payload)
  ↓
Prepare Prospects List (maps prospect data)
  ↓
Split Prospects (processes one at a time)
  ↓
Send CR (sends LinkedIn invitation via Unipile)
  ↓
✨ Update Database (NEW - updates contacted_at & status) ✨
  ↓
Log Result (logs success)
  ↓
Should Loop Again? (processes next prospect or finishes)
```

### What Gets Updated:
```javascript
{
  "contacted_at": "2025-10-30T14:30:00.000Z",  // ← NEW
  "status": "contacted"                          // ← CHANGED
}
```

---

## Troubleshooting

### Issue: Database not updating after sending

**Check 1: Is "Update Database" node executing?**
```
N8N → Executions → Latest execution → Check "Update Database" node
```

**Check 2: Are Supabase credentials correct?**
```javascript
// Verify in N8N node:
supabase_url: "https://latxadqrvrrrcvkktrog.supabase.co"
supabase_service_key: "eyJ..." (service role key)
```

**Check 3: Does prospect exist?**
```sql
SELECT * FROM campaign_prospects WHERE id = 'prospect_uuid';
```

### Issue: N8N workflow not executing

**Check 1: Is workflow active?**
```
N8N → Workflows → SAM Master Campaign Orchestrator → Active toggle
```

**Check 2: Is webhook URL correct?**
```bash
echo $N8N_CAMPAIGN_WEBHOOK_URL
# Should be: https://workflows.innovareai.com/webhook/campaign-execute
```

**Check 3: Are prospects being queued?**
```sql
SELECT COUNT(*)
FROM campaign_prospects
WHERE status = 'queued_in_n8n'
  AND contacted_at IS NULL;
```

### Issue: Prospect stuck in "queued_in_n8n"

**Solution 1: Manual update (if message was sent)**
```bash
node scripts/js/mark-prospects-contacted.mjs
```

**Solution 2: Reset to approved (to retry)**
```bash
node scripts/js/reset-queued-prospects.mjs
```

---

## Database Functions Reference

### update_prospect_contacted()

**Purpose:** Update prospect after LinkedIn message sent

**Usage:**
```sql
SELECT update_prospect_contacted(
  'prospect-uuid',
  'msg_abc123'  -- Optional: Unipile message ID
);
```

**Returns:**
```json
{
  "success": true,
  "prospect_id": "uuid",
  "contacted_at": "2025-10-30T14:30:00Z",
  "status": "contacted",
  "first_name": "John",
  "last_name": "Doe"
}
```

### get_prospects_ready_for_messaging()

**Purpose:** Get next batch of prospects to contact

**Usage:**
```sql
SELECT * FROM get_prospects_ready_for_messaging(
  'campaign-uuid',
  10  -- Limit
);
```

**Returns:**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Prospect ID |
| campaign_id | UUID | Campaign ID |
| first_name | TEXT | First name |
| last_name | TEXT | Last name |
| linkedin_url | TEXT | LinkedIn profile |
| title | TEXT | Job title |
| company_name | TEXT | Company |
| status | TEXT | Current status |
| personalization_data | JSONB | Metadata |

---

## Success Criteria

After completing setup, you should see:

✅ **Database:**
- Migration executed without errors
- Functions `update_prospect_contacted` and `get_prospects_ready_for_messaging` exist
- Indexes created successfully

✅ **N8N:**
- Workflow "SAM Master Campaign Orchestrator" is ACTIVE
- "Update Database" node exists in workflow
- Test execution succeeds without errors

✅ **Integration:**
- LinkedIn connection requests sent successfully
- Database automatically updates after each send
- `contacted_at` timestamp recorded correctly
- `status` changes from `queued_in_n8n` to `contacted`

✅ **Verification:**
- LinkedIn shows connection requests sent
- Database shows correct timestamps
- No prospects stuck in `queued_in_n8n` status
- N8N execution logs show success

---

## Files Modified/Created

### Created:
- ✅ `sql/migrations/20251030_campaign_tracking_enhancements.sql`
- ✅ `scripts/js/run-campaign-tracking-migration.mjs`
- ✅ `/tmp/workflow-with-db-update.json`
- ✅ `docs/N8N_DATABASE_TRACKING_SETUP.md` (this file)

### Previously Created (from last session):
- ✅ `/app/api/campaigns/update-contacted/route.ts` (alternative API approach)
- ✅ `scripts/js/mark-prospects-contacted.mjs`
- ✅ `scripts/js/reset-queued-prospects.mjs`
- ✅ `/docs/LINKEDIN_CAMPAIGN_WORKFLOW_STATUS.md`

---

## Next Steps

1. **Execute database migration** in Supabase SQL editor
2. **Activate N8N workflow** in N8N UI
3. **Run test campaign** with 1 prospect
4. **Verify database update** using SQL query
5. **Check LinkedIn** for connection request
6. **Scale up** to production volume

---

**Last Updated:** 2025-10-30
**Status:** Ready for execution
**Estimated Setup Time:** 10-15 minutes
