# N8N Workflow Required Fixes

## Current Issues

1. ❌ **Missing cadence delay** - No wait before sending CR
2. ❌ **Missing status update** - Prospect status not updated after CR sent
3. ❌ **Connection acceptance not tracked** - Shavayiz connected but system shows `queued_in_n8n`

## Required Changes

### Fix #1: Add Cadence Delay Wait Node

**Location:** Between "Merge Profile Data" and "Send CR"

**New Node:** "Wait for Cadence Delay"
- **Type:** Wait
- **Resume:** After time interval
- **Amount:** `={{ $json.send_delay_minutes || 0 }}`
- **Unit:** Minutes

**New Flow:**
```
Merge Profile Data → Wait for Cadence Delay → Send CR
```

---

### Fix #2: Add Status Update After CR Sent

**Location:** Between "Send CR" and "Init Connection Check"

**New Node:** "Update Status - CR Sent"
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://app.meet-sam.com/api/webhooks/n8n/prospect-status`
- **Body:**
  ```json
  {
    "prospect_id": "={{ $json.prospect.id }}",
    "campaign_id": "={{ $json.campaign_id }}",
    "status": "connection_requested",
    "contacted_at": "={{ $now.toISO() }}"
  }
  ```
- **Headers:**
  - `Content-Type`: `application/json`

**New Flow:**
```
Send CR → Update Status - CR Sent → Init Connection Check
```

---

### Fix #3: Add Status Update After Connection Accepted

**Location:** After "Connection Accepted?" (True branch)

**New Node:** "Update Status - Connected"
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://app.meet-sam.com/api/webhooks/n8n/prospect-status`
- **Body:**
  ```json
  {
    "prospect_id": "={{ $json.prospect.id }}",
    "campaign_id": "={{ $json.campaign_id }}",
    "status": "connected",
    "connected_at": "={{ $now.toISO() }}"
  }
  ```

**New Flow:**
```
Connection Accepted?
  → [TRUE] Update Status - Connected → Wait 4 Hours After Acceptance
  → [FALSE] Increment Check Counter
```

---

## Complete Fixed Flow Diagram

```
1. Campaign Execute Webhook
   ↓
2. Campaign Handler (processes data)
   ↓
3. Get LinkedIn Profile
   ↓
4. Merge Profile Data
   ↓
5. 🆕 Wait for Cadence Delay (NEW - uses send_delay_minutes)
   ↓
6. Send CR (Unipile invite)
   ↓
7. 🆕 Update Status - CR Sent (NEW - marks as connection_requested)
   ↓
8. Init Connection Check
   ↓
9. Wait 1 Hour
   ↓
10. Restore After Wait
   ↓
11. Check Connection Accepted
   ↓
12. Connection Accepted?
    ├─ TRUE → 🆕 Update Status - Connected (NEW) → Wait 4 Hours After Acceptance → ...
    └─ FALSE → Increment Check Counter → Should Retry Check? → ...
```

---

## Step-by-Step Instructions

### Step 1: Add Cadence Delay

1. Open workflow in N8N UI
2. Click on the connection between "Merge Profile Data" and "Send CR"
3. Click "+" to add node
4. Search for "Wait"
5. Configure:
   - **Resume:** After time interval
   - **Amount:** `={{ $json.send_delay_minutes || 0 }}`
   - **Unit:** Minutes
6. Rename to "Wait for Cadence Delay"
7. Save

### Step 2: Add CR Status Update

1. Click on the connection between "Send CR" and "Init Connection Check"
2. Click "+" to add node
3. Search for "HTTP Request"
4. Configure:
   - **Method:** POST
   - **URL:** `https://app.meet-sam.com/api/webhooks/n8n/prospect-status`
   - **Body Parameters:**
     - Click "Add Parameter"
     - `prospect_id`: `={{ $json.prospect.id }}`
     - `campaign_id`: `={{ $json.campaign_id }}`
     - `status`: `connection_requested`
     - `contacted_at`: `={{ $now.toISO() }}`
   - **Headers:**
     - `Content-Type`: `application/json`
5. Rename to "Update Status - CR Sent"
6. Save

### Step 3: Add Connected Status Update

1. Find the "Connection Accepted?" IF node
2. On the TRUE output (left), disconnect from "Wait 4 Hours After Acceptance"
3. Add new "HTTP Request" node
4. Configure same as Step 2 but:
   - Body: `status`: `connected`
   - Body: `connected_at`: `={{ $now.toISO() }}`
5. Rename to "Update Status - Connected"
6. Connect: Connection Accepted? → Update Status - Connected → Wait 4 Hours After Acceptance
7. Save

---

## Testing Checklist

After making changes:

- [ ] Workflow saved and active
- [ ] Test with 2-3 prospects
- [ ] Check delays working (check execution logs)
- [ ] Verify database updates:
  ```sql
  SELECT first_name, last_name, status, contacted_at
  FROM campaign_prospects
  WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
  ORDER BY contacted_at DESC;
  ```
- [ ] Expected statuses:
  - [ ] `connection_requested` - after CR sent
  - [ ] `connected` - after acceptance
  - [ ] `replied` - after they message you

---

## Verification SQL

```sql
-- Check if statuses are being updated
SELECT
  first_name,
  last_name,
  status,
  contacted_at,
  EXTRACT(EPOCH FROM (contacted_at - LAG(contacted_at) OVER (ORDER BY contacted_at))) / 60 as minutes_between
FROM campaign_prospects
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
  AND contacted_at IS NOT NULL
ORDER BY contacted_at;
```

Expected:
- First prospect: 0 minutes delay
- Second prospect: ~65 minutes delay
- Third prospect: ~121 minutes delay
- Statuses: All should be `connection_requested` or `connected`

---

## Rollback Instructions

If something breaks:

1. Go to N8N → Workflows
2. Click "..." on workflow
3. Click "Duplicate"
4. Open original backup: `n8n-campaign-orchestrator-BACKUP-20251110.json`
5. Import and activate

Or manually:
1. Delete "Wait for Cadence Delay" node
2. Delete "Update Status - CR Sent" node
3. Delete "Update Status - Connected" node
4. Reconnect nodes to original flow
5. Save
