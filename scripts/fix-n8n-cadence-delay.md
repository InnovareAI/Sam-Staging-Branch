# N8N Workflow Fix: Add Cadence Delay

## Problem
The workflow sends all connection requests immediately, ignoring the `send_delay_minutes` that was calculated by the cadence randomizer.

## Solution
Add a Wait node that delays each connection request based on the calculated timing.

## Manual Fix (Recommended)

### Step 1: Open N8N Workflow
1. Go to: https://workflows.innovareai.com
2. Login
3. Open workflow: "SAM Master Campaign Orchestrator" (aVG6LC4ZFRMN7Bw6)

### Step 2: Add Wait Node
1. Click on the connection line between "Merge Profile Data" and "Send CR"
2. Click the "+" button to add a node
3. Search for "Wait"
4. Select "Wait" node

### Step 3: Configure Wait Node
**Settings:**
- **Node Name:** `Wait for Cadence Delay`
- **Resume:** `After time interval`
- **Amount:** `={{ $json.send_delay_minutes || 0 }}`
- **Unit:** `minutes`

**Expression breakdown:**
- `$json.send_delay_minutes` = The calculated delay from the cadence randomizer
- `|| 0` = Fallback to 0 if no delay specified (for backwards compatibility)

### Step 4: Update Connections
The flow should now be:
```
Merge Profile Data → Wait for Cadence Delay → Send CR
```

### Step 5: Save and Test
1. Click "Save" button
2. Ensure workflow is "Active"
3. Test with a small campaign (2-3 prospects)

## Verification

### Check Logs
After triggering a campaign, check the N8N execution:
1. Go to "Executions" tab
2. Open the latest execution
3. Click on "Wait for Cadence Delay" node
4. Verify it shows: "Waiting X minutes"

### Check Database
Query the database to see when connection requests were actually sent:

```sql
SELECT 
  first_name,
  last_name,
  contacted_at,
  contacted_at - LAG(contacted_at) OVER (ORDER BY contacted_at) as time_diff
FROM campaign_prospects
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
  AND status = 'connection_requested'
ORDER BY contacted_at;
```

Expected: Time differences should match the cadence pattern (varying intervals, not all at once)

## Technical Details

### Data Flow
1. **execute-live/route.ts** calculates `send_delay_minutes` for each prospect
2. Sends to N8N webhook with prospect data including `send_delay_minutes`
3. N8N Campaign Handler processes the data (keeps `send_delay_minutes`)
4. **NEW:** Wait node delays based on `send_delay_minutes`
5. Send CR executes at the right time

### Example Data
```json
{
  "id": "prospect-123",
  "first_name": "John",
  "last_name": "Doe",
  "linkedin_url": "https://linkedin.com/in/johndoe",
  "send_delay_minutes": 65,  // ← This value is used by Wait node
  "pattern_index": 1,
  "daily_pattern_seed": "2025-11-10"
}
```

## Rollback
If something breaks:
1. Delete the "Wait for Cadence Delay" node
2. Reconnect "Merge Profile Data" directly to "Send CR"
3. Save workflow

## Notes
- First prospect (index 0) typically has delay = 0 (sends immediately)
- Subsequent prospects have cumulative delays (65min, 121min, etc.)
- Pattern is deterministic per day (same for all campaigns on that day)
- Maximum daily limit: 20 connection requests per LinkedIn account
