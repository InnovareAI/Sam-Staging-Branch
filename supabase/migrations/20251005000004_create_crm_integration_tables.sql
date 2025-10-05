-- CRM Integration Tables Migration
-- Creates tables for managing CRM connections and field mappings

-- CRM Connections Table
-- Stores OAuth credentials and connection status for each workspace
CREATE TABLE IF NOT EXISTS crm_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  crm_type TEXT NOT NULL CHECK (crm_type IN (
    'hubspot',
    'salesforce',
    'pipedrive',
    'zoho',
    'activecampaign',
    'keap',
    'close',
    'copper',
    'freshsales'
  )),

  -- OAuth credentials
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT[],

  -- Connection metadata
  crm_account_id TEXT, -- CRM's internal account/org ID
  crm_account_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  error_message TEXT,

  -- Timestamps
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one active connection per CRM type per workspace
  UNIQUE(workspace_id, crm_type)
);

-- Field Mappings Table
-- Maps SAM fields to CRM-specific field names
CREATE TABLE IF NOT EXISTS crm_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  crm_type TEXT NOT NULL CHECK (crm_type IN (
    'hubspot',
    'salesforce',
    'pipedrive',
    'zoho',
    'activecampaign',
    'keap',
    'close',
    'copper',
    'freshsales'
  )),

  -- Field mapping
  sam_field TEXT NOT NULL, -- e.g., 'firstName', 'email', 'companyName'
  crm_field TEXT NOT NULL, -- e.g., 'firstname', 'contact_email', 'company_name'
  field_type TEXT NOT NULL CHECK (field_type IN ('contact', 'company', 'deal')),
  data_type TEXT CHECK (data_type IN ('string', 'number', 'boolean', 'date', 'array')),

  -- Mapping metadata
  is_required BOOLEAN DEFAULT false,
  is_custom BOOLEAN DEFAULT false, -- Custom field in CRM

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique mapping per field per workspace per CRM
  UNIQUE(workspace_id, crm_type, field_type, sam_field)
);

-- CRM Sync Logs Table
-- Tracks synchronization activities and errors
CREATE TABLE IF NOT EXISTS crm_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES crm_connections(id) ON DELETE CASCADE,

  -- Sync details
  sync_type TEXT NOT NULL CHECK (sync_type IN ('manual', 'scheduled', 'webhook', 'campaign')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'company', 'deal')),
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'sync')),

  -- Results
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  records_processed INTEGER DEFAULT 0,
  records_succeeded INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_details JSONB,

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_connections_workspace ON crm_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_connections_status ON crm_connections(status);
CREATE INDEX IF NOT EXISTS idx_crm_field_mappings_workspace ON crm_field_mappings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_field_mappings_type ON crm_field_mappings(crm_type, field_type);
CREATE INDEX IF NOT EXISTS idx_crm_sync_logs_workspace ON crm_sync_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_logs_connection ON crm_sync_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_logs_created ON crm_sync_logs(created_at DESC);

-- Row Level Security Policies
ALTER TABLE crm_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_sync_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access CRM connections for workspaces they're members of
CREATE POLICY crm_connections_workspace_member_policy ON crm_connections
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY crm_field_mappings_workspace_member_policy ON crm_field_mappings
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY crm_sync_logs_workspace_member_policy ON crm_sync_logs
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Service role bypass (for MCP server operations)
CREATE POLICY crm_connections_service_role_policy ON crm_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY crm_field_mappings_service_role_policy ON crm_field_mappings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY crm_sync_logs_service_role_policy ON crm_sync_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_crm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_crm_connections_updated_at
  BEFORE UPDATE ON crm_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_updated_at();

CREATE TRIGGER update_crm_field_mappings_updated_at
  BEFORE UPDATE ON crm_field_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_updated_at();

-- Comments for documentation
COMMENT ON TABLE crm_connections IS 'Stores OAuth credentials and connection status for CRM integrations';
COMMENT ON TABLE crm_field_mappings IS 'Maps SAM standard fields to CRM-specific field names';
COMMENT ON TABLE crm_sync_logs IS 'Tracks CRM synchronization activities and errors';
