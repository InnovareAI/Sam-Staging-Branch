# N8N Webhook Fix - Visual Comparison

## The Problem: Invalid Syntax Mixing

### BROKEN Configuration (Current)

```json
{
  "name": "Update Status - CR Sent",
  "jsonBody": "={\n  \"prospect_id\": \"{{ $json.prospect.id }}\",\n  \"campaign_id\": \"{{ $json.campaign_id }}\",\n  \"status\": \"connection_requested\",\n  \"contacted_at\": \"{{ $now.toISO() }}\"\n}"
}
```

**What N8N Sees:**
```javascript
// N8N tries to evaluate this as JavaScript:
{
  "prospect_id": "{{ $json.prospect.id }}",  // ❌ String literal with {{ }}
  "campaign_id": "{{ $json.campaign_id }}",  // ❌ String literal with {{ }}
  "status": "connection_requested",
  "contacted_at": "{{ $now.toISO() }}"       // ❌ String literal with {{ }}
}

// Result: Invalid syntax error - N8N can't parse {{ }} inside JavaScript
```

**What Gets Sent to Webhook:**
```json
❌ Nothing - the node fails before making the HTTP request
```

---

### FIXED Configuration (Corrected)

```json
{
  "name": "Update Status - CR Sent",
  "jsonBody": "={{ { prospect_id: $json.prospect.id, campaign_id: $json.campaign_id, status: \"connection_requested\", contacted_at: $now.toISO() } }}"
}
```

**What N8N Sees:**
```javascript
// N8N evaluates this as valid JavaScript:
={{
  {
    prospect_id: $json.prospect.id,    // ✅ Variable reference
    campaign_id: $json.campaign_id,    // ✅ Variable reference
    status: "connection_requested",
    contacted_at: $now.toISO()         // ✅ Function call
  }
}}

// Result: Valid JavaScript object expression
```

**What Gets Sent to Webhook:**
```json
✅ {
  "prospect_id": "1163f722-914a-48b2-8150-35a0bbd01538",
  "campaign_id": "789abc-...",
  "status": "connection_requested",
  "contacted_at": "2025-11-20T08:17:45.123Z"
}
```

---

## Side-by-Side Comparison

| Element | BROKEN ❌ | FIXED ✅ |
|---------|----------|---------|
| **Template System** | Mixed: `={{ }}` + `{{ }}` | Consistent: `={{ }}` only |
| **Variable Syntax** | `"{{ $json.prospect.id }}"` | `$json.prospect.id` |
| **Quotes Around Variables** | Yes (makes it a string) | No (evaluates as variable) |
| **JavaScript Validity** | Invalid - can't parse `{{ }}` | Valid - pure JavaScript object |
| **N8N Execution** | Fails with syntax error | Executes successfully |
| **Webhook Called?** | No | Yes |
| **Database Updated?** | No | Yes |

---

## How to Apply the Fix

### Method 1: Upload Corrected Workflow (Recommended)

1. **File Location:**
   ```
   /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/temp/SAM-Master-Campaign-Orchestrator-CORRECTED.json
   ```

2. **Steps:**
   - Go to https://workflows.innovareai.com
   - Open "SAM Master Campaign Orchestrator" workflow
   - Click "..." menu → "Import from JSON"
   - Select the corrected JSON file
   - Click "Save"

### Method 2: Manual Edit in N8N UI

1. **Navigate to Node:**
   - Open workflow in N8N editor
   - Find "Update Status - CR Sent" node
   - Click to open parameters

2. **Update Configuration:**
   - Scroll to "Body Parameters" section
   - Ensure "Specify Body" is set to "JSON"
   - Replace the `jsonBody` field with:

   ```
   ={{ { prospect_id: $json.prospect.id, campaign_id: $json.campaign_id, status: "connection_requested", contacted_at: $now.toISO() } }}
   ```

3. **Save:**
   - Click "Save" button in top-right
   - Workflow will automatically activate

---

## Verification

### Quick Test

After applying the fix, the N8N workflow should:

1. ✅ Execute without errors (check execution logs)
2. ✅ Call the webhook successfully (HTTP 200 response)
3. ✅ Update database `campaign_prospects` table
4. ✅ Set `status='connection_requested'` and `contacted_at` timestamp

### Database Check

```sql
-- Should show recent prospect with correct status
SELECT id, first_name, last_name, status, contacted_at
FROM campaign_prospects
WHERE status = 'connection_requested'
ORDER BY contacted_at DESC
LIMIT 1;
```

**Expected Result:**
```
✅ Recent prospect with:
   - status: 'connection_requested'
   - contacted_at: [recent timestamp]
   - updated_at: [matches contacted_at]
```

---

## Why This Happens

**N8N Expression System:**
- Uses `={{ }}` to mark expressions
- Evaluates contents as **JavaScript code**
- Supports direct variable access (`$json.field`)
- Supports function calls (`$now.toISO()`)

**Common Mistake:**
- Mixing N8N expressions (`={{ }}`) with other template systems
- Using Handlebars syntax (`{{ }}`) inside N8N expressions
- Putting quotes around variable names (treats as string literals)

**Correct Pattern:**
```javascript
={{ { key: $variable, other: "literal" } }}
     ^   ^                    ^
     |   |                    |
     |   |                    String literal
     |   Variable reference
     N8N expression marker
```

---

## Related Working Examples

All these nodes in the same workflow use the **correct syntax**:

```json
// "Not Connected - Exit" node
"jsonBody": "={{ { prospect_id: $json.prospect.id, campaign_id: $json.campaign_id, status: \"not_connected\" } }}"

// "Mark Replied - Exit FU1" node
"jsonBody": "={{ { prospect_id: $json.prospect.id, campaign_id: $json.campaign_id, status: \"replied_fu1\" } }}"

// "Mark Campaign Complete" node
"jsonBody": "={{ { prospect_id: $json.prospect.id, campaign_id: $json.campaign_id, status: \"completed\" } }}"
```

All of these work correctly because they use **consistent N8N expression syntax** without mixing template systems.

---

## Key Takeaway

**ONE RULE:**
When using N8N expressions, use `={{ }}` and **JavaScript syntax only**. No mixing with other template systems.

✅ **DO:** `={{ $json.field }}`
❌ **DON'T:** `{{ $json.field }}`
❌ **DON'T:** `"={{ \"{{ $json.field }}\" }}"`
