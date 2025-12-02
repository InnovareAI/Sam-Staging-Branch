# CRM Integration Quickstart

## 1. Run Database Migration

```bash
psql $SUPABASE_DATABASE_URL -f supabase/migrations/20251005000004_create_crm_integration_tables.sql
psql $SUPABASE_DATABASE_URL -f supabase/migrations/20251202000000_add_crm_mapping_tables.sql
```

## 2. Deploy N8N Workflows via API

```bash
# Set N8N credentials
export N8N_API_URL=https://n8n.innovareai.com
export N8N_API_KEY=your_n8n_api_key

# Deploy both workflows
./scripts/shell/deploy-n8n-workflows.sh
```

This creates:
- Workflow 1: SAM → CRM (`/webhook/crm-sync-to-crm`)
- Workflow 2: CRM → SAM (`/webhook/crm-sync-from-crm`)

## 3. Configure N8N Environment Variables

In N8N UI → Settings → Variables, add:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SAM_API_URL=https://sam.innovareai.com
N8N_WEBHOOK_SECRET=your_webhook_secret
```

## 4. Set SAM Environment Variables

```bash
# Add to .env
N8N_WEBHOOK_BASE_URL=https://n8n.innovareai.com
N8N_API_KEY=your_api_key
N8N_WEBHOOK_SECRET=your_secret
```

## 5. Deploy to Netlify

```bash
git add .
git commit -m "Add CRM bi-directional sync"
git push
```

The scheduled function `sync-crm-bidirectional` will run every 15 minutes automatically.

## 6. Test

```bash
# Query CRM connections
psql $SUPABASE_DATABASE_URL -f scripts/sql/query-crm-connections.sql

# Test N8N webhook
curl -X POST https://n8n.innovareai.com/webhook/crm-sync-to-crm \
  -H "Content-Type: application/json" \
  -d '{"workspace_id":"test","crm_type":"hubspot","action":"create","contact_data":{"firstName":"John","lastName":"Doe","email":"john@test.com"}}'
```

## Files Created

- ✅ `netlify/functions/sync-crm-bidirectional.ts` - Scheduled function (every 15 min)
- ✅ `app/api/cron/sync-crm-bidirectional/route.ts` - API endpoint
- ✅ `app/api/crm/webhook/sync-from-crm/route.ts` - Receives CRM updates
- ✅ `app/api/crm/webhook/sync-complete/route.ts` - Sync completion callback
- ✅ `supabase/migrations/20251202000000_add_crm_mapping_tables.sql` - Database tables
- ✅ `netlify.toml` - Cron schedule (line 131)

## That's It!

No Netlify charges (under 125k invocations/month). N8N handles CRM routing. Supabase stores everything.
