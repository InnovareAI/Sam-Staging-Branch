# N8N Enrichment Workflow - Quick Reference

## 🚀 Import Now

**File**: `n8n-workflows/prospect-enrichment-workflow-http-fixed.json`

1. Go to https://workflows.innovareai.com
2. Import → Select file
3. Activate workflow
4. Done! ✅

---

## 📋 What Was Fixed

**Error**: `Could not find the '' column of 'enrichment_jobs' in the schema cache`

**Root Cause**: Supabase nodes missing filter values for UPDATE operations

**Fix**: Replaced all Supabase UPDATE nodes with HTTP Request nodes using:
- `PATCH` method (not POST)
- Filter in URL: `?id=eq.{{ $json.job_id }}`
- PostgreSQL RPC functions for counters

---

## ✅ Verify It's Working

### 1. Run Test
```bash
./test-enrich-api.sh
```

### 2. Check Job Status
```sql
SELECT id, status, processed_count, created_at
FROM enrichment_jobs
ORDER BY created_at DESC
LIMIT 1;
```

Should see: `pending` → `processing` → `completed`

### 3. Check N8N Execution
https://workflows.innovareai.com/executions

All nodes should be green ✅

---

## 🔧 Key Nodes (All HTTP Request)

| Node | Method | URL Pattern |
|------|--------|-------------|
| Mark Job as Processing | PATCH | `/enrichment_jobs?id=eq.{job_id}` |
| Get Prospects | GET | `/prospect_approval_data?prospect_id=in.(...)` |
| Update Prospect | PATCH | `/prospect_approval_data?id=eq.{id}` |
| Increment Processed | POST | `/rpc/increment_enrichment_processed` |
| Increment Failed | POST | `/rpc/increment_enrichment_failed` |
| Mark Complete | PATCH | `/enrichment_jobs?id=eq.{job_id}` |

---

## 🛠️ If It Breaks

**Jobs stuck in `pending`**:
1. Check workflow is Active (green toggle)
2. Check N8N executions for errors
3. Verify webhook URL: `/webhook/prospect-enrichment`

**"Function not found" error**:
Run migration:
```bash
psql -f supabase/migrations/20251116_add_enrichment_rpc_functions.sql
```

**404 webhook error**:
Deactivate workflow → wait 5 seconds → Activate again

---

## 📊 Success Metrics

- ✅ Jobs progress from `pending` → `completed`
- ✅ N8N executions show all green nodes
- ✅ `processed_count` increments correctly
- ✅ Prospect `contact.email` and `contact.phone` populated

---

**Updated**: November 16, 2025
