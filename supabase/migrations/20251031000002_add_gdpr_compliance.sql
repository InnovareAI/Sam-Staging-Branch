-- GDPR Compliance: Data Subject Rights
-- Implements Right to be Forgotten, Consent Tracking, and Data Retention
-- Date: October 31, 2025

BEGIN;

-- =====================================================================
-- Add GDPR compliance fields to workspace_prospects
-- =====================================================================

ALTER TABLE workspace_prospects
-- Consent tracking
ADD COLUMN IF NOT EXISTS consent_obtained BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS consent_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS consent_source TEXT, -- 'csv_upload', 'manual_entry', 'linkedin_scrape', 'api_integration'
ADD COLUMN IF NOT EXISTS consent_withdrawn_at TIMESTAMPTZ,

-- Data retention
ADD COLUMN IF NOT EXISTS data_retention_days INTEGER DEFAULT 730, -- 2 years default
ADD COLUMN IF NOT EXISTS scheduled_deletion_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deletion_reason TEXT,

-- Processing purposes
ADD COLUMN IF NOT EXISTS processing_purposes TEXT[] DEFAULT ARRAY['marketing', 'sales_outreach'],
ADD COLUMN IF NOT EXISTS data_source TEXT, -- 'linkedin', 'manual', 'import', 'enrichment'

-- GDPR flags
ADD COLUMN IF NOT EXISTS is_eu_resident BOOLEAN DEFAULT NULL, -- NULL = unknown, true = confirmed EU
ADD COLUMN IF NOT EXISTS gdpr_compliant BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS data_processing_agreement_version TEXT;

-- =====================================================================
-- Data deletion request table
-- =====================================================================

CREATE TABLE IF NOT EXISTS gdpr_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Subject information
  prospect_id UUID REFERENCES workspace_prospects(id) ON DELETE SET NULL,
  email_address TEXT, -- Store for reference even if prospect deleted
  linkedin_profile_url TEXT,
  full_name TEXT,

  -- Request details
  request_type TEXT NOT NULL CHECK (request_type IN (
    'right_to_be_forgotten',
    'right_to_erasure',
    'data_export',
    'data_correction',
    'processing_restriction'
  )),

  request_source TEXT NOT NULL CHECK (request_source IN (
    'prospect_request',
    'workspace_admin',
    'system_automated',
    'compliance_audit'
  )),

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'reviewing',
    'approved',
    'rejected',
    'completed',
    'failed'
  )),

  -- Verification
  verification_method TEXT, -- 'email', 'linkedin', 'manual'
  verification_completed_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id),

  -- Execution
  scheduled_execution_date TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  executed_by UUID REFERENCES users(id),

  -- Audit trail
  deletion_scope JSONB, -- What was deleted
  backup_reference TEXT, -- Reference to backup if needed for legal holds

  -- Notes
  notes TEXT,
  rejection_reason TEXT,

  -- Timestamps
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Metadata
  request_metadata JSONB -- IP, user agent, etc.
);

-- Enable RLS
ALTER TABLE gdpr_deletion_requests ENABLE ROW LEVEL SECURITY;

-- RLS: Workspace members can see deletion requests for their workspace
DROP POLICY IF EXISTS "Workspace members see deletion requests" ON gdpr_deletion_requests;
CREATE POLICY "Workspace members see deletion requests" ON gdpr_deletion_requests
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS: Only admins can create/update deletion requests
DROP POLICY IF EXISTS "Workspace admins manage deletion requests" ON gdpr_deletion_requests;
CREATE POLICY "Workspace admins manage deletion requests" ON gdpr_deletion_requests
  FOR ALL TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'owner')
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requests_workspace ON gdpr_deletion_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requests_prospect ON gdpr_deletion_requests(prospect_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requests_status ON gdpr_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requests_scheduled ON gdpr_deletion_requests(scheduled_execution_date)
  WHERE status = 'approved';

-- =====================================================================
-- Data retention policy table
-- =====================================================================

CREATE TABLE IF NOT EXISTS data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Policy details
  policy_name TEXT NOT NULL,
  applies_to TEXT[] DEFAULT ARRAY['prospects', 'campaigns', 'messages'],

  -- Retention periods (in days)
  default_retention_days INTEGER DEFAULT 730, -- 2 years
  inactive_prospect_retention_days INTEGER DEFAULT 365, -- 1 year for inactive
  campaign_data_retention_days INTEGER DEFAULT 1095, -- 3 years
  message_history_retention_days INTEGER DEFAULT 730,

  -- Geographic rules
  eu_resident_retention_days INTEGER DEFAULT 365, -- Shorter for EU
  non_eu_retention_days INTEGER DEFAULT 730,

  -- Deletion behavior
  auto_delete_enabled BOOLEAN DEFAULT false,
  notify_before_deletion_days INTEGER DEFAULT 30,

  -- Legal holds
  legal_hold_enabled BOOLEAN DEFAULT false,
  legal_hold_reason TEXT,
  legal_hold_until TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  is_active BOOLEAN DEFAULT true,

  UNIQUE(workspace_id, is_active) -- One active policy per workspace
);

-- Enable RLS
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;

-- RLS: Workspace members can view retention policies
DROP POLICY IF EXISTS "Workspace members view retention policies" ON data_retention_policies;
CREATE POLICY "Workspace members view retention policies" ON data_retention_policies
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS: Only admins can manage retention policies
DROP POLICY IF EXISTS "Workspace admins manage retention policies" ON data_retention_policies;
CREATE POLICY "Workspace admins manage retention policies" ON data_retention_policies
  FOR ALL TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'owner')
    )
  );

-- =====================================================================
-- Functions for GDPR compliance
-- =====================================================================

-- Function to calculate scheduled deletion date
CREATE OR REPLACE FUNCTION calculate_scheduled_deletion_date(
  p_prospect_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
DECLARE
  v_workspace_id TEXT;
  v_retention_days INTEGER;
  v_last_activity_date TIMESTAMPTZ;
  v_is_eu BOOLEAN;
BEGIN
  -- Get prospect details
  SELECT
    workspace_id::uuid,
    is_eu_resident,
    data_retention_days,
    GREATEST(created_at, updated_at, COALESCE(consent_date, created_at))
  INTO v_workspace_id, v_is_eu, v_retention_days, v_last_activity_date
  FROM workspace_prospects
  WHERE id = p_prospect_id;

  -- Get workspace retention policy
  IF v_is_eu = true THEN
    SELECT eu_resident_retention_days INTO v_retention_days
    FROM data_retention_policies
    WHERE workspace_id = v_workspace_id
      AND is_active = true
    LIMIT 1;
  ELSE
    SELECT non_eu_retention_days INTO v_retention_days
    FROM data_retention_policies
    WHERE workspace_id = v_workspace_id
      AND is_active = true
    LIMIT 1;
  END IF;

  -- Default to 2 years if no policy
  v_retention_days := COALESCE(v_retention_days, 730);

  RETURN v_last_activity_date + (v_retention_days || ' days')::INTERVAL;
END;
$$;

-- Function to mark prospects for deletion
CREATE OR REPLACE FUNCTION mark_prospects_for_deletion()
RETURNS TABLE (
  prospect_id UUID,
  workspace_id TEXT,
  scheduled_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update prospects that have passed retention period
  UPDATE workspace_prospects wp
  SET scheduled_deletion_date = calculate_scheduled_deletion_date(wp.id)
  WHERE wp.scheduled_deletion_date IS NULL
    AND wp.consent_withdrawn_at IS NULL
    AND wp.created_at < (NOW() - INTERVAL '30 days') -- At least 30 days old
  RETURNING wp.id, wp.workspace_id, wp.scheduled_deletion_date;
END;
$$;

-- Function to execute GDPR deletion request
CREATE OR REPLACE FUNCTION execute_gdpr_deletion(
  p_request_id UUID,
  p_executed_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request gdpr_deletion_requests%ROWTYPE;
  v_deletion_scope JSONB := '{}';
  v_deleted_count INTEGER;
BEGIN
  -- Get request details
  SELECT * INTO v_request
  FROM gdpr_deletion_requests
  WHERE id = p_request_id
    AND status = 'approved';

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or not approved');
  END IF;

  -- Delete from workspace_prospects
  IF v_request.prospect_id IS NOT NULL THEN
    DELETE FROM workspace_prospects
    WHERE id = v_request.prospect_id;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_deletion_scope := jsonb_set(v_deletion_scope, '{workspace_prospects}', to_jsonb(v_deleted_count));
  END IF;

  -- Delete from campaign_prospects (cascades automatically, but log it)
  DELETE FROM campaign_prospects
  WHERE prospect_id = v_request.prospect_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deletion_scope := jsonb_set(v_deletion_scope, '{campaign_prospects}', to_jsonb(v_deleted_count));

  -- Delete from linkedin_contacts
  DELETE FROM linkedin_contacts
  WHERE linkedin_profile_url = v_request.linkedin_profile_url;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_deletion_scope := jsonb_set(v_deletion_scope, '{linkedin_contacts}', to_jsonb(v_deleted_count));

  -- Update request status
  UPDATE gdpr_deletion_requests
  SET
    status = 'completed',
    executed_at = NOW(),
    executed_by = p_executed_by,
    completed_at = NOW(),
    deletion_scope = v_deletion_scope
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'deletion_scope', v_deletion_scope
  );
END;
$$;

-- Function to auto-delete expired prospects
CREATE OR REPLACE FUNCTION auto_delete_expired_prospects(
  p_batch_size INTEGER DEFAULT 100
)
RETURNS TABLE (
  deleted_count INTEGER,
  workspace_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id TEXT;
  v_deleted INTEGER;
BEGIN
  -- Process each workspace
  FOR v_workspace_id IN
    SELECT DISTINCT wp.workspace_id
    FROM workspace_prospects wp
    WHERE wp.scheduled_deletion_date <= NOW()
      AND wp.scheduled_deletion_date IS NOT NULL
    LIMIT p_batch_size
  LOOP
    -- Delete expired prospects
    DELETE FROM workspace_prospects
    WHERE workspace_id = v_workspace_id
      AND scheduled_deletion_date <= NOW()
      AND scheduled_deletion_date IS NOT NULL;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    IF v_deleted > 0 THEN
      RETURN QUERY SELECT v_deleted, v_workspace_id;
    END IF;
  END LOOP;
END;
$$;

-- Function to create deletion request
CREATE OR REPLACE FUNCTION create_gdpr_deletion_request(
  p_workspace_id TEXT,
  p_prospect_id UUID,
  p_request_type TEXT DEFAULT 'right_to_be_forgotten',
  p_request_source TEXT DEFAULT 'prospect_request',
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_id UUID;
  v_prospect workspace_prospects%ROWTYPE;
BEGIN
  -- Get prospect details
  SELECT * INTO v_prospect
  FROM workspace_prospects
  WHERE id = p_prospect_id
    AND workspace_id = p_workspace_id::text;

  IF v_prospect.id IS NULL THEN
    RAISE EXCEPTION 'Prospect not found';
  END IF;

  -- Create deletion request
  INSERT INTO gdpr_deletion_requests (
    workspace_id,
    prospect_id,
    email_address,
    linkedin_profile_url,
    full_name,
    request_type,
    request_source,
    notes,
    scheduled_execution_date
  )
  VALUES (
    p_workspace_id,
    p_prospect_id,
    v_prospect.email_address,
    v_prospect.linkedin_profile_url,
    v_prospect.first_name || ' ' || v_prospect.last_name,
    p_request_type,
    p_request_source,
    p_notes,
    NOW() + INTERVAL '30 days' -- 30 day grace period
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- =====================================================================
-- Triggers for automatic retention date calculation
-- =====================================================================

-- Trigger function to set scheduled deletion date on new prospects
CREATE OR REPLACE FUNCTION set_prospect_deletion_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.scheduled_deletion_date IS NULL THEN
    NEW.scheduled_deletion_date := calculate_scheduled_deletion_date(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger: Set deletion date when prospect created
CREATE TRIGGER trigger_set_prospect_deletion_date
  BEFORE INSERT ON workspace_prospects
  FOR EACH ROW
  EXECUTE FUNCTION set_prospect_deletion_date();

-- =====================================================================
-- Comments
-- =====================================================================

COMMENT ON TABLE gdpr_deletion_requests IS 'GDPR data subject deletion requests (Right to be Forgotten)';
COMMENT ON TABLE data_retention_policies IS 'Workspace-specific data retention policies for GDPR compliance';
COMMENT ON FUNCTION execute_gdpr_deletion IS 'Executes approved GDPR deletion request (deletes prospect and related data)';
COMMENT ON FUNCTION auto_delete_expired_prospects IS 'Automatically deletes prospects past retention period (run via cron)';
COMMENT ON FUNCTION create_gdpr_deletion_request IS 'Creates new GDPR deletion request with 30-day grace period';

COMMIT;
