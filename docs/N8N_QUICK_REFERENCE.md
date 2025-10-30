# N8N Quick Reference

## Correct Unipile Endpoints

```
✅ CORRECT for Connection Requests:
GET  https://{UNIPILE_DSN}/api/v1/users/{username}?account_id={BASE_ID}
POST https://{UNIPILE_DSN}/api/v1/users/invite

❌ WRONG (previous agent's mistake):
POST https://{UNIPILE_DSN}/api/v1/messaging/messages
```

## Environment Variables

### N8N Environment
```bash
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=<your_api_key>
```

### SAM Environment
```bash
N8N_CAMPAIGN_WEBHOOK_URL=https://workflows.innovareai.com/webhook/sam-campaign-execute
N8N_API_KEY=<your_api_key>
```

## Key Files

| File | Purpose |
|------|---------|
| `/n8n-workflows/sam-linkedin-campaign-v2.json` | N8N workflow definition (import this) |
| `/app/api/campaigns/linkedin/execute-live/route.ts` | SAM campaign trigger (modified) |
| `/app/api/campaigns/check-connection-status/[id]/route.ts` | Connection status check (new) |
| `/docs/N8N_MIGRATION_SUMMARY.md` | Complete migration documentation |
| `/docs/N8N_LINKEDIN_MESSAGING_SETUP.md` | Original setup guide |

## Workflow Nodes

1. **Campaign Webhook** - Receives campaign data from SAM
2. **Split Prospects** - Process one at a time
3. **Extract Username** - Parse LinkedIn URL
4. **Get Profile** - `GET /api/v1/users/{username}` → provider_id
5. **Personalize Message** - Replace {first_name}, {company_name}, etc.
6. **Send Connection Request** - `POST /api/v1/users/invite`
7. **Update Status** - Mark as 'connection_requested'
8. **Wait 24-48h** - Random delay
9. **Check Connection** - Call SAM API
10. **If Accepted** - Send Follow-Up 1
11. **If Not Accepted** - Mark and stop

## Testing Commands

```bash
# Test campaign execution (dry run)
curl -X POST https://app.meet-sam.com/api/campaigns/linkedin/execute-live \
  -H "Content-Type: application/json" \
  -d '{"campaignId": "ID", "maxProspects": 1, "dryRun": true}'

# Test campaign execution (live)
curl -X POST https://app.meet-sam.com/api/campaigns/linkedin/execute-live \
  -H "Content-Type: application/json" \
  -d '{"campaignId": "ID", "maxProspects": 1, "dryRun": false}'

# Check connection status
curl https://app.meet-sam.com/api/campaigns/check-connection-status/PROSPECT_ID
```

## Database Queries

```sql
-- Check prospects queued in N8N
SELECT id, first_name, last_name, status,
       personalization_data->>'n8n_execution_id' as n8n_id
FROM campaign_prospects
WHERE status = 'queued_in_n8n'
ORDER BY created_at DESC;

-- Check connection acceptance
SELECT id, first_name, last_name, status,
       personalization_data->>'connection_accepted_at' as accepted_at
FROM campaign_prospects
WHERE status = 'connected'
ORDER BY updated_at DESC;
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| N8N not receiving webhook | Check N8N_CAMPAIGN_WEBHOOK_URL, verify workflow activated |
| Connection requests not sending | Verify correct endpoint (POST /api/v1/users/invite) |
| Rate limit errors | Add delays, reduce maxProspects, rotate accounts |
| Stuck executions | Check N8N logs, verify Unipile account still connected |

## Import Instructions

1. Open N8N → Workflows
2. Click "Import from File"
3. Upload: `/n8n-workflows/sam-linkedin-campaign-v2.json`
4. Set environment variables
5. Activate workflow
6. Copy webhook URL
7. Set N8N_CAMPAIGN_WEBHOOK_URL in SAM environment

---

**Last Updated:** October 30, 2025
**Status:** Production Ready
