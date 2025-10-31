# n8n Workflow Quick Reference Card

## SAM Campaign Execution v3 - At-a-Glance

**Access:** https://workflows.innovareai.com

---

## Node Configuration Summary

### Node 1: Webhook
- **Type:** Webhook (n8n-nodes-base.webhook)
- **Path:** `campaign-execute-v3`
- **Method:** POST
- **Response:** On Received

### Node 2: Extract Campaign Data
- **Type:** Code (n8n-nodes-base.code)
- **Mode:** Run Once for All Items
- **Code:** Extract webhookData.body and return campaign fields

### Node 3: Process Each Prospect
- **Type:** Split In Batches (n8n-nodes-base.splitInBatches)
- **Batch Size:** 1
- **Reset:** OFF

### Node 4: Prepare Prospect Data
- **Type:** Code (n8n-nodes-base.code)
- **Mode:** Run Once for All Items
- **Code:** Extract single prospect from batch + campaign data

### Node 5: Send LinkedIn Message
- **Type:** HTTP Request (n8n-nodes-base.httpRequest)
- **Method:** POST
- **URL:** `={{ "https://" + $json.unipile_dsn + "/api/v1/messaging" }}`
- **Auth:** None
- **Headers:** X-API-KEY = `={{ $json.unipile_api_key }}`
- **Body:** JSON with account_id, attendees, text, type

### Node 6: Log Result
- **Type:** Code (n8n-nodes-base.code)
- **Mode:** Run Once for All Items
- **Code:** console.log message + return $input.all()

---

## Connections (Critical!)

```
Webhook → Extract → Split → Prepare → HTTP → Log
                      ↑                         ↓
                      └─────────────────────────┘
                            (loop back)
```

**Total:** 6 connections (5 forward + 1 loop back)

---

## Expression Fields (Enable "=" icon)

### Node 5 (HTTP Request):
- **URL:** `={{ "https://" + $json.unipile_dsn + "/api/v1/messaging" }}`
- **Header X-API-KEY:** `={{ $json.unipile_api_key }}`
- **Body fields:**
  - `account_id`: `={{ $json.unipile_account_id }}`
  - `attendees`: `["={{ $json.linkedin_user_id }}"]`
  - `text`: `={{ $json.message }}`
  - `type`: `"LINKEDIN"` (static)

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Nodes disconnected | Drag from output (right) to input (left) |
| "No input data" | Verify webhook triggered + connections exist |
| Expression errors | Click "=" icon to enable expression mode |
| Loop not working | Connect Log Result back to Split In Batches |
| Execution too fast (<100ms) | DELETE workflow, recreate from scratch |

---

## Testing Checklist

After creation:
- [ ] All 6 nodes created
- [ ] All 6 connections visible (including loop)
- [ ] Workflow activated (green toggle)
- [ ] Test webhook returns 200
- [ ] Execution shows data in all nodes
- [ ] Execution time >100ms
- [ ] Status: Success

---

## Test Commands

**Send test webhook:**
```bash
curl -X POST https://workflows.innovareai.com/webhook/campaign-execute-v3 \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "test-123",
    "campaignId": "campaign-456",
    "unipileAccountId": "account-789",
    "prospects": [{"id":"1", "first_name":"John", "last_name":"Doe", "linkedin_user_id":"user-1"}],
    "messages": {"cr": "Hello!"},
    "unipile_dsn": "api6.unipile.com:13670",
    "unipile_api_key": "YOUR_KEY"
  }'
```

**Run test script:**
```bash
node scripts/js/test-campaign-workflow-v3.mjs
```

---

## Success Indicators

✅ **Working Workflow:**
- Execution time: 500-5000ms (varies with prospect count)
- All nodes show data: YES
- Status: success (green checkmark)
- Visual connections intact

❌ **Broken Workflow:**
- Execution time: <100ms (instant)
- Nodes show: Data: NO
- Status: running but finished: true
- Visual disconnections

---

## Webhook URL

**Production:** `https://workflows.innovareai.com/webhook/campaign-execute-v3`

**Update in:**
- `.env.local`: `N8N_CAMPAIGN_WEBHOOK_URL=...`
- Sam application campaign execution code

---

## Important Notes

1. **NEVER deploy via API** - Always create manually in UI
2. **Use Code nodes** - NOT Function nodes (deprecated)
3. **Test immediately** - After creation, before production use
4. **Save frequently** - After each node configuration
5. **Verify connections** - Visually check all connection lines

---

## Support & Documentation

- **Full Guide:** N8N_MANUAL_WORKFLOW_CREATION_GUIDE.md
- **Troubleshooting:** N8N_TROUBLESHOOTING_COMPLETE_SUMMARY.md
- **Test Script:** scripts/js/test-campaign-workflow-v3.mjs

---

**Created:** October 31, 2025
**Version:** v3 (Manual UI Creation)
