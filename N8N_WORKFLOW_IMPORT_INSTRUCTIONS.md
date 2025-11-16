# N8N Workflow Import Instructions - FIXED VERSION

**Date**: November 16, 2025
**File**: `n8n-workflows/prospect-enrichment-workflow-http-fixed.json`
**Status**: ✅ Ready to import

---

## What's Fixed

### The Problem
The previous workflow used Supabase nodes with incomplete configuration:
- Missing filter values for UPDATE operations
- Error: `Could not find the '' column of 'enrichment_jobs' in the schema cache`
- Jobs stuck in `pending` status forever

### The Solution
All Supabase UPDATE nodes replaced with **HTTP Request nodes** using:
- **PATCH** method for updates (not POST)
- Proper filter in URL: `?id=eq.{{ $json.job_id }}`
- Direct Supabase REST API calls
- PostgreSQL RPC functions for atomic counter increments

---

## Import Steps

### 1. Apply Database Migration

The workflow requires two PostgreSQL functions. Run this:

```bash
PGPASSWORD='QFe75XZ2kqhy2AyH' psql \
  -h db.latxadqrvrrrcvkktrog.supabase.co \
  -p 5432 -U postgres -d postgres \
  -f supabase/migrations/20251116_add_enrichment_rpc_functions.sql
```

Or run manually in Supabase SQL editor:

```sql
-- Function to increment processed count
CREATE OR REPLACE FUNCTION increment_enrichment_processed(
  p_job_id UUID,
  p_result JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE enrichment_jobs
  SET processed_count = processed_count + 1,
      enrichment_results = enrichment_results || jsonb_build_array(p_result),
      updated_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment failed count
CREATE OR REPLACE FUNCTION increment_enrichment_failed(
  p_job_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE enrichment_jobs
  SET failed_count = failed_count + 1,
      updated_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_enrichment_processed TO service_role;
GRANT EXECUTE ON FUNCTION increment_enrichment_failed TO service_role;
```

### 2. Import Workflow to N8N

1. Go to https://workflows.innovareai.com
2. Click **"Workflows"** in sidebar
3. Click **"Import from File"** (top-right)
4. Select: `n8n-workflows/prospect-enrichment-workflow-http-fixed.json`
5. Click **"Import"**

### 3. Activate Workflow

1. Open the imported workflow
2. Click **"Inactive"** toggle (top-right)
3. Should change to **"Active"** (green)

### 4. Verify Webhook URL

1. Click on **"Enrichment Job Webhook"** node (first node)
2. Copy the webhook URL - should be:
   ```
   https://workflows.innovareai.com/webhook/prospect-enrichment
   ```
3. This is already configured in the code at `app/api/prospects/enrich/route.ts:340`

---

## What Changed (Technical)

### Before (BROKEN):
```json
{
  "type": "n8n-nodes-base.supabase",
  "operation": "update",
  "tableId": "enrichment_jobs",
  "matchingColumns": "id",  // ❌ Missing value!
  "columnsUi": {
    "columnValues": [
      { "column": "status", "value": "processing" }
    ]
  }
}
```

### After (FIXED):
```json
{
  "type": "n8n-nodes-base.httpRequest",
  "method": "PATCH",  // ✅ PATCH not POST
  "url": "{{ $json.supabase_url }}/rest/v1/enrichment_jobs?id=eq.{{ $json.job_id }}",  // ✅ Filter in URL
  "headers": {
    "apikey": "{{ $json.supabase_key }}",
    "Authorization": "Bearer {{ $json.supabase_key }}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
  },
  "body": {
    "status": "processing",
    "started_at": "{{ new Date().toISOString() }}"
  }
}
```

---

## Nodes Changed

All of these nodes now use HTTP Request instead of Supabase:

1. ✅ **Mark Job as Processing** - `PATCH /enrichment_jobs?id=eq.{job_id}`
2. ✅ **Get Prospects to Enrich** - `GET /prospect_approval_data?prospect_id=in.(...)`
3. ✅ **Update Current Prospect Progress** - `PATCH /enrichment_jobs?id=eq.{job_id}`
4. ✅ **Update Prospect with Enriched Data** - `PATCH /prospect_approval_data?id=eq.{id}`
5. ✅ **Increment Processed Count** - `POST /rpc/increment_enrichment_processed`
6. ✅ **Increment Failed Count** - `POST /rpc/increment_enrichment_failed`
7. ✅ **Mark Job Complete** - `PATCH /enrichment_jobs?id=eq.{job_id}`

---

## Testing

### Test 1: Check Database Functions

```sql
-- Verify functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%enrichment%';

-- Should show:
-- increment_enrichment_processed | FUNCTION
-- increment_enrichment_failed    | FUNCTION
```

### Test 2: Run Enrichment API

```bash
./test-enrich-api.sh
```

Expected output:
```json
{
  "success": true,
  "status": "queued",
  "queued_count": 1,
  "message": "🔄 Enriching 1 prospect(s) in background via N8N workflow."
}
```

### Test 3: Check Job Status

```sql
SELECT id, status, processed_count, failed_count, created_at
FROM enrichment_jobs
ORDER BY created_at DESC
LIMIT 1;
```

Should progress: `pending` → `processing` → `completed`

### Test 4: Check N8N Execution

1. Go to https://workflows.innovareai.com/executions
2. Find latest execution
3. All nodes should have green checkmarks ✅
4. No errors about missing columns

---

## Troubleshooting

### Error: "Could not find function increment_enrichment_processed"

**Solution**: Run the migration from Step 1 again

### Error: "404 Not Found" on webhook

**Solution**:
1. Make sure workflow is **Active** (green toggle)
2. Check webhook path is `/webhook/prospect-enrichment`
3. Deactivate and reactivate workflow

### Jobs still stuck in `pending`

**Solution**:
1. Check N8N executions page for errors
2. Verify all nodes have green checkmarks
3. Check Supabase service role key is correct
4. Ensure RPC functions exist (see Test 1)

---

## Key Differences from Old Workflow

| Aspect | Old Workflow | New Workflow (HTTP) |
|--------|-------------|---------------------|
| Node Type | Supabase nodes | HTTP Request nodes |
| Update Method | POST (creates new row) | PATCH (updates existing) |
| Filter | Missing value | In URL: `?id=eq.{value}` |
| Credentials | Dynamic (broken) | Passed via headers |
| Counter Updates | Raw SQL in node | PostgreSQL RPC functions |

---

## What Happens When You Run Enrichment

```
1. User clicks "Enrich Selected" in Sam UI
   ↓
2. /api/prospects/enrich creates enrichment_jobs record (status: pending)
   ↓
3. API triggers N8N webhook (fire-and-forget)
   ↓
4. N8N receives webhook → Parse Job Data
   ↓
5. Mark Job as Processing (PATCH /enrichment_jobs?id=eq.{job_id})
   ✅ NOW WORKS - before it failed here
   ↓
6. Get Prospects to Enrich (GET /prospect_approval_data)
   ↓
7. Loop Through Prospects (one at a time)
   ↓
8. For each prospect:
   - Extract LinkedIn URL from contact JSONB
   - Call BrightData API (35-40 seconds)
   - Parse email/phone from HTML
   - Update prospect_approval_data.contact (PATCH)
   - Increment processed_count (RPC)
   ↓
9. Mark Job Complete (PATCH /enrichment_jobs)
   ↓
10. User refreshes page → sees enriched data ✅
```

---

## Next Steps After Import

1. ✅ Import workflow to N8N
2. ✅ Activate workflow
3. ✅ Run test: `./test-enrich-api.sh`
4. ✅ Check N8N executions - all green
5. ✅ Check database - job status = `completed`
6. ✅ Check prospect data - email/phone enriched

---

**Status**: ✅ Ready to use
**Last Updated**: November 16, 2025
**Import File**: `n8n-workflows/prospect-enrichment-workflow-http-fixed.json`
