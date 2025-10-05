# CRM Integration Migration Deployment

## Quick Deploy via Supabase Dashboard

Since direct psql connection failed, deploy via Supabase Dashboard:

### Steps:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
   - Navigate to: **SQL Editor**

2. **Run the Migration**
   - Click "New query"
   - Copy the entire contents of: `supabase/migrations/20251005000004_create_crm_integration_tables.sql`
   - Paste into SQL Editor
   - Click "Run" (or press Cmd/Ctrl + Enter)

3. **Verify Tables Created**
   Run this query to verify:
   ```sql
   SELECT tablename
   FROM pg_tables
   WHERE tablename LIKE 'crm_%'
   ORDER BY tablename;
   ```

   You should see:
   - `crm_connections`
   - `crm_field_mappings`
   - `crm_sync_logs`

4. **Test the Integration**
   - Go to: http://localhost:3000 (dev) or https://app.meet-sam.com (prod)
   - Click "CRM Integration" tile in Workspace section
   - Modal should open showing 9 CRM options

## What This Creates:

### Tables:
1. **`crm_connections`** - Stores OAuth credentials and connection status
2. **`crm_field_mappings`** - Maps SAM fields to CRM-specific fields
3. **`crm_sync_logs`** - Tracks synchronization activities

### Features:
- Row-level security (RLS) policies for multi-tenant isolation
- Automatic `updated_at` triggers
- Indexes for performance
- Support for 9 CRMs: HubSpot, Salesforce, Pipedrive, Zoho, ActiveCampaign, Keap, Close, Copper, Freshsales

## Next Steps After Migration:

1. **Configure OAuth Credentials** in `.env.local`:
   ```bash
   # HubSpot
   HUBSPOT_CLIENT_ID=your_hubspot_client_id
   HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret
   HUBSPOT_REDIRECT_URI=http://localhost:3000/api/crm/oauth/callback

   # Salesforce (when ready)
   SALESFORCE_CLIENT_ID=your_salesforce_client_id
   SALESFORCE_CLIENT_SECRET=your_salesforce_client_secret
   SALESFORCE_REDIRECT_URI=http://localhost:3000/api/crm/oauth/callback
   ```

2. **Test Connection Flow**:
   - Click "Connect" on HubSpot tile
   - Complete OAuth flow
   - Verify connection appears in `crm_connections` table

3. **Configure MCP Server** (optional, for SAM AI integration):
   - Build MCP server: `cd mcp-crm-server && npm run build`
   - MCP tools will be available for SAM to use CRM data

## Troubleshooting:

**If migration fails:**
- Check for existing tables: `SELECT * FROM crm_connections LIMIT 1;`
- Drop tables if needed: `DROP TABLE IF EXISTS crm_connections, crm_field_mappings, crm_sync_logs CASCADE;`
- Re-run migration

**If OAuth fails:**
- Verify redirect URI matches in CRM app settings
- Check OAuth credentials in `.env.local`
- Review browser console for errors
