-- CRM Contact Mappings and Conflict Resolution Tables
-- Extends the existing CRM integration schema

-- CRM Contact Mappings Table
-- Maps SAM contacts to CRM contacts for bi-directional sync
CREATE TABLE IF NOT EXISTS crm_contact_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  crm_type TEXT NOT NULL CHECK (crm_type IN (
    'hubspot',
    'salesforce',
    'pipedrive',
    'zoho',
    'activecampaign',
    'airtable',
    'keap',
    'close',
    'copper',
    'freshsales'
  )),

  -- Mapping
  sam_contact_id UUID NOT NULL, -- References contacts(id) but no FK to allow soft deletes
  crm_contact_id TEXT NOT NULL, -- CRM's contact ID

  -- Sync timestamps for conflict detection
  sam_updated_at TIMESTAMPTZ, -- Last time SAM contact was updated
  crm_updated_at TIMESTAMPTZ, -- Last time CRM contact was updated

  -- Sync status
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'failed', 'conflict')),
  last_sync_error TEXT,
  last_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique mapping per contact per workspace per CRM
  UNIQUE(workspace_id, crm_type, sam_contact_id)
);

-- CRM Conflict Resolutions Table
-- Logs conflict resolution decisions
CREATE TABLE IF NOT EXISTS crm_conflict_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Entity information
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'company', 'deal')),
  entity_id TEXT NOT NULL, -- Generic ID (could be SAM or CRM)
  crm_type TEXT NOT NULL,

  -- Resolution details
  strategy TEXT NOT NULL CHECK (strategy IN ('sam_wins', 'crm_wins', 'manual', 'newest_wins')),
  winner_source TEXT NOT NULL CHECK (winner_source IN ('sam', 'crm')),

  -- Record IDs
  sam_record_id UUID, -- SAM record ID
  crm_record_id TEXT, -- CRM record ID

  -- Conflict data (for audit trail)
  sam_data JSONB,
  crm_data JSONB,

  -- Resolution metadata
  resolved_by UUID REFERENCES users(id), -- NULL if automated
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_contact_mappings_workspace ON crm_contact_mappings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_contact_mappings_sam_contact ON crm_contact_mappings(sam_contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_contact_mappings_crm_contact ON crm_contact_mappings(workspace_id, crm_type, crm_contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_contact_mappings_status ON crm_contact_mappings(last_sync_status);

CREATE INDEX IF NOT EXISTS idx_crm_conflict_resolutions_workspace ON crm_conflict_resolutions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_conflict_resolutions_entity ON crm_conflict_resolutions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_conflict_resolutions_created ON crm_conflict_resolutions(created_at DESC);

-- Row Level Security
ALTER TABLE crm_contact_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_conflict_resolutions ENABLE ROW LEVEL SECURITY;

-- Workspace member policies
CREATE POLICY crm_contact_mappings_workspace_member_policy ON crm_contact_mappings
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY crm_conflict_resolutions_workspace_member_policy ON crm_conflict_resolutions
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Service role bypass (for N8N and CRON operations)
CREATE POLICY crm_contact_mappings_service_role_policy ON crm_contact_mappings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY crm_conflict_resolutions_service_role_policy ON crm_conflict_resolutions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_crm_contact_mappings_updated_at
  BEFORE UPDATE ON crm_contact_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_updated_at();

-- Comments
COMMENT ON TABLE crm_contact_mappings IS 'Maps SAM contacts to CRM contacts for bi-directional sync';
COMMENT ON TABLE crm_conflict_resolutions IS 'Logs conflict resolution decisions when contact updated in both SAM and CRM';

COMMENT ON COLUMN crm_contact_mappings.sam_updated_at IS 'Last time SAM contact was updated (for conflict detection)';
COMMENT ON COLUMN crm_contact_mappings.crm_updated_at IS 'Last time CRM contact was updated (for conflict detection)';
COMMENT ON COLUMN crm_conflict_resolutions.strategy IS 'Resolution strategy used (e.g., crm_wins, sam_wins, newest_wins)';
COMMENT ON COLUMN crm_conflict_resolutions.winner_source IS 'Which system won the conflict (sam or crm)';
