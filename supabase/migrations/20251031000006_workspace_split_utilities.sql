-- Workspace Split Utilities
-- Helper functions for splitting multi-user workspaces into personal ones
-- Date: October 31, 2025

BEGIN;

-- =====================================================================
-- Function to duplicate workspace data
-- =====================================================================

CREATE OR REPLACE FUNCTION duplicate_workspace_data(
  p_source_workspace_id TEXT,
  p_target_workspace_id TEXT,
  p_copy_prospects BOOLEAN DEFAULT true,
  p_copy_campaigns BOOLEAN DEFAULT true,
  p_copy_knowledge_base BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prospects_copied INTEGER := 0;
  v_campaigns_copied INTEGER := 0;
  v_kb_copied INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Copy prospects
  IF p_copy_prospects THEN
    BEGIN
      INSERT INTO workspace_prospects (
        workspace_id,
        first_name,
        last_name,
        company_name,
        job_title,
        linkedin_profile_url,
        email_address,
        phone_number,
        location,
        industry,
        data_source,
        consent_obtained,
        consent_date,
        consent_source,
        data_retention_days,
        is_eu_resident
      )
      SELECT
        p_target_workspace_id,
        first_name,
        last_name,
        company_name,
        job_title,
        linkedin_profile_url,
        email_address,
        phone_number,
        location,
        industry,
        data_source,
        consent_obtained,
        consent_date,
        consent_source,
        data_retention_days,
        is_eu_resident
      FROM workspace_prospects
      WHERE workspace_id = p_source_workspace_id;

      GET DIAGNOSTICS v_prospects_copied = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'Prospects: ' || SQLERRM);
    END;
  END IF;

  -- Copy campaigns
  IF p_copy_campaigns THEN
    BEGIN
      INSERT INTO campaigns (
        workspace_id,
        name,
        description,
        status,
        campaign_type,
        target_audience,
        start_date,
        end_date,
        metadata
      )
      SELECT
        p_target_workspace_id,
        name,
        description,
        'draft', -- Reset to draft
        campaign_type,
        target_audience,
        start_date,
        end_date,
        jsonb_set(
          COALESCE(metadata, '{}'),
          '{copied_from}',
          to_jsonb(p_source_workspace_id)
        )
      FROM campaigns
      WHERE workspace_id = p_source_workspace_id;

      GET DIAGNOSTICS v_campaigns_copied = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'Campaigns: ' || SQLERRM);
    END;
  END IF;

  -- Copy knowledge base
  IF p_copy_knowledge_base THEN
    BEGIN
      INSERT INTO knowledge_base (
        workspace_id,
        title,
        content,
        document_type,
        source_url,
        metadata,
        is_active
      )
      SELECT
        p_target_workspace_id,
        title,
        content,
        document_type,
        source_url,
        metadata,
        is_active
      FROM knowledge_base
      WHERE workspace_id = p_source_workspace_id
        AND is_active = true;

      GET DIAGNOSTICS v_kb_copied = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'Knowledge Base: ' || SQLERRM);
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', array_length(v_errors, 1) IS NULL OR array_length(v_errors, 1) = 0,
    'prospects_copied', v_prospects_copied,
    'campaigns_copied', v_campaigns_copied,
    'kb_documents_copied', v_kb_copied,
    'errors', v_errors
  );
END;
$$;

-- =====================================================================
-- Function to identify workspace by various methods
-- =====================================================================

CREATE OR REPLACE FUNCTION identify_workspace(
  p_identifier TEXT -- Can be: workspace_id, tenant, user_email, user_id
)
RETURNS TABLE (
  workspace_id TEXT,
  workspace_name TEXT,
  tenant TEXT,
  workspace_type TEXT,
  owner_id UUID,
  owner_email TEXT,
  member_count BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- Match by workspace ID
  SELECT
    w.id,
    w.name,
    w.tenant,
    w.workspace_type,
    w.owner_id,
    u.email as owner_email,
    COUNT(wm.id) as member_count,
    w.created_at
  FROM workspaces w
  LEFT JOIN users u ON w.owner_id = u.id
  LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
  WHERE w.id::text = p_identifier
  GROUP BY w.id, w.name, w.tenant, w.workspace_type, w.owner_id, u.email, w.created_at

  UNION ALL

  -- Match by tenant
  SELECT
    w.id,
    w.name,
    w.tenant,
    w.workspace_type,
    w.owner_id,
    u.email as owner_email,
    COUNT(wm.id) as member_count,
    w.created_at
  FROM workspaces w
  LEFT JOIN users u ON w.owner_id = u.id
  LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
  WHERE w.tenant = p_identifier
  GROUP BY w.id, w.name, w.tenant, w.workspace_type, w.owner_id, u.email, w.created_at

  UNION ALL

  -- Match by owner user_id
  SELECT
    w.id,
    w.name,
    w.tenant,
    w.workspace_type,
    w.owner_id,
    u.email as owner_email,
    COUNT(wm.id) as member_count,
    w.created_at
  FROM workspaces w
  LEFT JOIN users u ON w.owner_id = u.id
  LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
  WHERE w.owner_id::text = p_identifier
  GROUP BY w.id, w.name, w.tenant, w.workspace_type, w.owner_id, u.email, w.created_at

  UNION ALL

  -- Match by owner email
  SELECT
    w.id,
    w.name,
    w.tenant,
    w.workspace_type,
    w.owner_id,
    u.email as owner_email,
    COUNT(wm.id) as member_count,
    w.created_at
  FROM workspaces w
  JOIN users u ON w.owner_id = u.id
  LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
  WHERE u.email ILIKE p_identifier
  GROUP BY w.id, w.name, w.tenant, w.workspace_type, w.owner_id, u.email, w.created_at

  ORDER BY created_at DESC
  LIMIT 1;
END;
$$;

-- =====================================================================
-- Function to list all workspaces with owners
-- =====================================================================

CREATE OR REPLACE FUNCTION list_all_workspaces_with_owners()
RETURNS TABLE (
  workspace_id TEXT,
  workspace_name TEXT,
  tenant TEXT,
  workspace_type TEXT,
  owner_email TEXT,
  owner_name TEXT,
  member_count BIGINT,
  prospect_count BIGINT,
  campaign_count BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id as workspace_id,
    w.name as workspace_name,
    w.tenant,
    w.workspace_type,
    u.email as owner_email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email) as owner_name,
    COUNT(DISTINCT wm.id) as member_count,
    COUNT(DISTINCT wp.id) as prospect_count,
    COUNT(DISTINCT c.id) as campaign_count,
    w.created_at
  FROM workspaces w
  LEFT JOIN users u ON w.owner_id = u.id
  LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
  LEFT JOIN workspace_prospects wp ON w.id::text = wp.workspace_id
  LEFT JOIN campaigns c ON w.id::text = c.workspace_id
  GROUP BY
    w.id,
    w.name,
    w.tenant,
    w.workspace_type,
    u.email,
    u.raw_user_meta_data,
    w.created_at
  ORDER BY w.created_at DESC;
END;
$$;

-- =====================================================================
-- View: Workspace directory (easy lookup)
-- =====================================================================

CREATE OR REPLACE VIEW workspace_directory AS
SELECT
  w.id as workspace_id,
  w.name as workspace_name,
  w.tenant,
  w.workspace_type,
  w.owner_id,
  u.email as owner_email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)) as owner_display_name,

  -- Identifiers for lookup
  ARRAY[
    w.id::text,
    w.tenant,
    u.email,
    w.owner_id::text
  ] as identifiers,

  -- Stats
  w.team_member_count,
  (SELECT COUNT(*) FROM workspace_prospects WHERE workspace_id = w.id::text) as prospect_count,
  (SELECT COUNT(*) FROM campaigns WHERE workspace_id = w.id::text) as campaign_count,

  -- Timestamps
  w.created_at,
  w.updated_at

FROM workspaces w
LEFT JOIN users u ON w.owner_id = u.id
WHERE w.workspace_type IS NOT NULL
ORDER BY w.created_at DESC;

GRANT SELECT ON workspace_directory TO authenticated;

COMMENT ON VIEW workspace_directory IS 'Easy lookup directory for all workspaces with owner info and identifiers';

-- =====================================================================
-- Comments
-- =====================================================================

COMMENT ON FUNCTION duplicate_workspace_data IS 'Copy prospects, campaigns, and KB from one workspace to another';
COMMENT ON FUNCTION identify_workspace IS 'Find workspace by ID, tenant, user email, or user ID';
COMMENT ON FUNCTION list_all_workspaces_with_owners IS 'Get full list of workspaces with owner and stats';

COMMIT;
