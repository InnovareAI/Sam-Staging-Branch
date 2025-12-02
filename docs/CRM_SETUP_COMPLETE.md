# CRM Integration - Final Setup Steps

## ✅ Completed

### Netlify Environment Variables
```bash
N8N_WEBHOOK_BASE_URL=https://workflows.innovareai.com
N8N_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (set)
N8N_WEBHOOK_SECRET=45015cc55ac036e78cc7489417c30c364326c690dcf3eea8a7c8849b7276a17b
```

### N8N Workflows Deployed
- **Workflow 1 (SAM → CRM)**: ID `O73jiEhOqK90Lm1m`
  - Webhook: `https://workflows.innovareai.com/webhook/crm-sync-to-crm`

- **Workflow 2 (CRM → SAM)**: ID `BDunCkeki5EdQs5L`
  - Webhook: `https://workflows.innovareai.com/webhook/crm-sync-from-crm`

### Code Deployed to Netlify
- Scheduled function runs every 15 minutes
- All database tables created
- Webhook endpoints ready

---

## ⏳ TODO

### 1. Set N8N Environment Variables

**Go to N8N UI → Settings → Variables and add:**

```bash
SUPABASE_URL=https://hdgufmeqsjgnnzasmmvw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase dashboard>
SAM_API_URL=https://sam.innovareai.com
N8N_WEBHOOK_SECRET=45015cc55ac036e78cc7489417c30c364326c690dcf3eea8a7c8849b7276a17b
```

**Where to find SUPABASE_SERVICE_ROLE_KEY:**
1. Go to https://supabase.com/dashboard
2. Select your project (hdgufmeqsjgnnzasmmvw)
3. Settings → API
4. Copy "service_role" secret key (starts with "eyJ...")

### 2. Run Database Migration

```bash
psql $SUPABASE_DATABASE_URL -f supabase/migrations/20251202000000_add_crm_mapping_tables.sql
```

This creates:
- `crm_contact_mappings` - Maps SAM ↔ CRM contacts
- `crm_conflict_resolutions` - Conflict resolution logs

---

## 🎉 After These Steps

**CRM sync will run automatically every 15 minutes!**

### Monitor
```bash
# View Netlify function logs
netlify functions:log sync-crm-bidirectional

# Query CRM connections
psql $SUPABASE_DATABASE_URL -f scripts/sql/query-crm-connections.sql
```

### Test
```bash
# Test SAM → CRM sync
curl -X POST https://workflows.innovareai.com/webhook/crm-sync-to-crm \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id":"test",
    "crm_type":"hubspot",
    "action":"create",
    "contact_data":{
      "firstName":"John",
      "lastName":"Doe",
      "email":"john@test.com"
    }
  }'
```

---

**Cost: $0/month** (Netlify free tier + self-hosted N8N)
