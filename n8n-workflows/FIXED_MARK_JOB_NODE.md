# Fix for "Mark Job as Processing" N8N Node Error

## Error Message
```
Bad request - please check your parameters
(Could not find the '' column of 'enrichment_jobs' in the schema cache)
```

## Root Cause
The Supabase node is missing the **filter value** that specifies which row to update. It has `matchingColumns: "id"` but no value for the `id` column.

## Solution 1: Fix Supabase Node (Recommended)

### In N8N Workflow Editor:

1. Click on **"Mark Job as Processing"** node
2. Find the **"Row(s) to Update"** section
3. You should see:
   - **Matching Columns**: `id` (already set)
   - **Filter Values**: **(THIS IS MISSING!)**

4. Add the filter value:
   - Click **"Add Filter"** or find the **"Matching Rows"** section
   - Set the filter to match `id` = `{{ $json.job_id }}`

### Exact Configuration Needed:

**Match Rows Section:**
- Column: `id`
- Value: `={{ $json.job_id }}`

**Columns to Update:**
- `status` → `processing`
- `started_at` → `={{ new Date().toISOString() }}`

---

## Solution 2: Replace with HTTP Request Node (Easier)

If the Supabase node is confusing, delete it and create an HTTP Request node instead:

### Node Configuration:

**Name**: Mark Job as Processing

**Method**: PATCH

**URL**:
```
={{ $json.supabase_url }}/rest/v1/enrichment_jobs?id=eq.{{ $json.job_id }}
```

**Authentication**: None (we'll use headers)

**Headers**:
```json
{
  "apikey": "={{ $json.supabase_key }}",
  "Authorization": "Bearer ={{ $json.supabase_key }}",
  "Content-Type": "application/json",
  "Prefer": "return=minimal"
}
```

**Body**:
```json
{
  "status": "processing",
  "started_at": "={{ new Date().toISOString() }}"
}
```

**Send Body**: Yes (JSON)

---

## Solution 3: Quick JSON Fix

If you want to edit the JSON directly, replace the "Mark Job as Processing" node with this:

```json
{
  "id": "mark_job_processing",
  "name": "Mark Job as Processing",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.1,
  "position": [650, 300],
  "parameters": {
    "method": "PATCH",
    "url": "={{ $json.supabase_url }}/rest/v1/enrichment_jobs?id=eq.{{ $json.job_id }}",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "={{ $json.supabase_key }}"
        },
        {
          "name": "Authorization",
          "value": "Bearer ={{ $json.supabase_key }}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        },
        {
          "name": "Prefer",
          "value": "return=minimal"
        }
      ]
    },
    "sendBody": true,
    "contentType": "json",
    "body": "={{ JSON.stringify({ status: 'processing', started_at: new Date().toISOString() }) }}",
    "options": {}
  }
}
```

---

## Apply Same Fix to Other Supabase UPDATE Nodes

The following nodes likely have the **same issue** and need the same fix:

1. ✅ **Mark Job as Processing** (this one)
2. ⚠️ **Update Current Prospect Progress**
3. ⚠️ **Update Prospect with Enriched Data**
4. ⚠️ **Increment Processed Count**
5. ⚠️ **Increment Failed Count**
6. ⚠️ **Mark Job Complete**

For each node:
- Make sure the **filter value** is specified (e.g., `id = {{ $json.job_id }}`)
- Or replace with HTTP Request node using the same pattern as above

---

## Test After Fix

1. Save the workflow
2. Activate it
3. Run test script:
```bash
./test-enrich-api.sh
```

4. Check N8N execution logs - should see green checkmarks ✅

---

**Updated**: November 16, 2025
**Status**: Ready to apply
