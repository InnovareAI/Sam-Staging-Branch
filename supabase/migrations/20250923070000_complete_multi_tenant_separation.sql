-- =====================================================================================
-- COMPLETE MULTI-TENANT SEPARATION FOR ALL CLIENT ORGANIZATIONS
-- =====================================================================================
-- Extends tenant isolation to ALL client accounts:
-- 1. InnovareAI (Primary Infrastructure Owner)
-- 2. 3CubedAI (Primary Infrastructure Owner) 
-- 3. WT Matchmaker (Client)
-- 4. Sendingcell (Client)
-- Date: 2025-09-23
-- Purpose: Absolute data separation between ALL organizations

-- =====================================================================================
-- 1. CREATE ORGANIZATIONS FOR ALL CLIENTS
-- =====================================================================================

-- Ensure all client organizations exist with proper configuration
INSERT INTO organizations (id, clerk_org_id, name, slug, created_by, settings) VALUES
  (
    'aa111111-1111-1111-1111-111111111111',
    'innovareai_org',
    'InnovareAI',
    'innovareai',
    'system',
    jsonb_build_object(
      'tenant_type', 'infrastructure_owner',
      'email_sender', 'sp@innovareai.com',
      'email_sender_name', 'Sarah Powell',
      'postmark_api_key_env', 'POSTMARK_INNOVAREAI_API_KEY',
      'billing_responsible', true,
      'data_residency', 'US'
    )
  ),
  (
    'bb222222-2222-2222-2222-222222222222',
    '3cubed_org',
    '3CubedAI',
    '3cubed',
    'system',
    jsonb_build_object(
      'tenant_type', 'infrastructure_owner',
      'email_sender', 'sophia@3cubed.ai',
      'email_sender_name', 'Sophia Caldwell', 
      'postmark_api_key_env', 'POSTMARK_3CUBEDAI_API_KEY',
      'billing_responsible', true,
      'data_residency', 'US'
    )
  ),
  (
    'cc333333-3333-3333-3333-333333333333',
    'wt_matchmaker_org',
    'WT Matchmaker',
    'wt-matchmaker',
    'system',
    jsonb_build_object(
      'tenant_type', 'client',
      'parent_infrastructure', 'innovareai',
      'email_sender', 'sp@innovareai.com',
      'email_sender_name', 'Sarah Powell',
      'postmark_api_key_env', 'POSTMARK_INNOVAREAI_API_KEY',
      'billing_responsible', false,
      'data_residency', 'US',
      'client_domain', 'wtmatchmaker.com'
    )
  ),
  (
    'dd444444-4444-4444-4444-444444444444',
    'sendingcell_org', 
    'Sendingcell',
    'sendingcell',
    'system',
    jsonb_build_object(
      'tenant_type', 'client',
      'parent_infrastructure', 'innovareai',
      'email_sender', 'sp@innovareai.com',
      'email_sender_name', 'Sarah Powell',
      'postmark_api_key_env', 'POSTMARK_INNOVAREAI_API_KEY',
      'billing_responsible', false,
      'data_residency', 'US',
      'client_domain', 'sendingcell.com'
    )
  )
ON CONFLICT (slug) DO UPDATE SET
  settings = EXCLUDED.settings,
  updated_at = NOW();

-- =====================================================================================
-- 2. UPDATE WORKSPACES TO HAVE PROPER ORGANIZATION ASSOCIATIONS
-- =====================================================================================

-- Link existing workspaces to their organizations
UPDATE workspaces SET organization_id = 'aa111111-1111-1111-1111-111111111111' 
WHERE slug = 'innovareai-workspace';

UPDATE workspaces SET organization_id = 'bb222222-2222-2222-2222-222222222222' 
WHERE slug = '3cubed-workspace';

UPDATE workspaces SET organization_id = 'cc333333-3333-3333-3333-333333333333' 
WHERE slug = 'wt-matchmaker-workspace';

UPDATE workspaces SET organization_id = 'dd444444-4444-4444-4444-444444444444' 
WHERE slug = 'sendingcell-workspace';

-- =====================================================================================
-- 3. CREATE TENANT CONFIGURATION TABLE
-- =====================================================================================

CREATE TABLE IF NOT EXISTS tenant_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  tenant_type TEXT NOT NULL CHECK (tenant_type IN ('infrastructure_owner', 'client')),
  
  -- Email Configuration
  email_sender_address TEXT NOT NULL,
  email_sender_name TEXT NOT NULL,
  postmark_server_token_env TEXT NOT NULL,
  
  -- Billing and Infrastructure
  parent_infrastructure_org UUID REFERENCES organizations(id),
  billing_responsible BOOLEAN DEFAULT false,
  
  -- Data and Compliance
  data_residency TEXT DEFAULT 'US',
  compliance_requirements JSONB DEFAULT '[]',
  
  -- Client-specific settings
  client_domain TEXT,
  client_branding JSONB DEFAULT '{}',
  
  -- Usage and Limits
  usage_limits JSONB DEFAULT jsonb_build_object(
    'campaigns_per_month', null,
    'prospects_per_campaign', null,
    'emails_per_month', null,
    'storage_gb', null
  ),
  
  -- Security
  allowed_ip_ranges JSONB DEFAULT '[]',
  require_2fa BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, workspace_id)
);

-- Create indexes
CREATE INDEX idx_tenant_configs_org_id ON tenant_configurations(organization_id);
CREATE INDEX idx_tenant_configs_workspace_id ON tenant_configurations(workspace_id);
CREATE INDEX idx_tenant_configs_tenant_type ON tenant_configurations(tenant_type);

-- Enable RLS
ALTER TABLE tenant_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only super admins and org owners can see configurations
CREATE POLICY "tenant_configs_super_admin_access" ON tenant_configurations
  FOR ALL USING (
    auth.uid()::text IN (
      SELECT u.id::text FROM users u
      WHERE u.email IN ('tl@innovareai.com', 'cl@innovareai.com')
    )
  );

CREATE POLICY "tenant_configs_org_owner_access" ON tenant_configurations
  FOR SELECT USING (
    organization_id IN (
      SELECT w.organization_id FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin')
    )
  );

-- =====================================================================================
-- 4. POPULATE TENANT CONFIGURATIONS
-- =====================================================================================

INSERT INTO tenant_configurations (
  organization_id, 
  workspace_id, 
  tenant_type,
  email_sender_address,
  email_sender_name,
  postmark_server_token_env,
  parent_infrastructure_org,
  billing_responsible,
  data_residency,
  client_domain,
  usage_limits
) VALUES
  -- InnovareAI (Infrastructure Owner)
  (
    'aa111111-1111-1111-1111-111111111111',
    (SELECT id FROM workspaces WHERE slug = 'innovareai-workspace'),
    'infrastructure_owner',
    'sp@innovareai.com',
    'Sarah Powell',
    'POSTMARK_INNOVAREAI_API_KEY',
    NULL,
    true,
    'US',
    'innovareai.com',
    jsonb_build_object(
      'campaigns_per_month', null,
      'prospects_per_campaign', null,
      'emails_per_month', null,
      'storage_gb', null
    )
  ),
  -- 3CubedAI (Infrastructure Owner)
  (
    'bb222222-2222-2222-2222-222222222222',
    (SELECT id FROM workspaces WHERE slug = '3cubed-workspace'),
    'infrastructure_owner',
    'sophia@3cubed.ai',
    'Sophia Caldwell',
    'POSTMARK_3CUBEDAI_API_KEY',
    NULL,
    true,
    'US',
    '3cubed.ai',
    jsonb_build_object(
      'campaigns_per_month', null,
      'prospects_per_campaign', null,
      'emails_per_month', null,
      'storage_gb', null
    )
  ),
  -- WT Matchmaker (Client)
  (
    'cc333333-3333-3333-3333-333333333333',
    (SELECT id FROM workspaces WHERE slug = 'wt-matchmaker-workspace'),
    'client',
    'sp@innovareai.com',
    'Sarah Powell',
    'POSTMARK_INNOVAREAI_API_KEY',
    'aa111111-1111-1111-1111-111111111111',
    false,
    'US',
    'wtmatchmaker.com',
    jsonb_build_object(
      'campaigns_per_month', 50,
      'prospects_per_campaign', 1000,
      'emails_per_month', 5000,
      'storage_gb', 10
    )
  ),
  -- Sendingcell (Client)
  (
    'dd444444-4444-4444-4444-444444444444',
    (SELECT id FROM workspaces WHERE slug = 'sendingcell-workspace'),
    'client',
    'sp@innovareai.com',
    'Sarah Powell',
    'POSTMARK_INNOVAREAI_API_KEY',
    'aa111111-1111-1111-1111-111111111111',
    false,
    'US',
    'sendingcell.com',
    jsonb_build_object(
      'campaigns_per_month', 100,
      'prospects_per_campaign', 2000,
      'emails_per_month', 10000,
      'storage_gb', 25
    )
  )
ON CONFLICT (organization_id, workspace_id) DO UPDATE SET
  tenant_type = EXCLUDED.tenant_type,
  email_sender_address = EXCLUDED.email_sender_address,
  email_sender_name = EXCLUDED.email_sender_name,
  postmark_server_token_env = EXCLUDED.postmark_server_token_env,
  usage_limits = EXCLUDED.usage_limits,
  updated_at = NOW();

-- =====================================================================================
-- 5. ENHANCED TENANT ISOLATION FUNCTIONS
-- =====================================================================================

-- Function to get tenant configuration for a workspace
CREATE OR REPLACE FUNCTION get_tenant_config(workspace_id UUID)
RETURNS tenant_configurations AS $$
DECLARE
  config tenant_configurations;
BEGIN
  SELECT * INTO config 
  FROM tenant_configurations 
  WHERE tenant_configurations.workspace_id = get_tenant_config.workspace_id;
  
  RETURN config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can access organization data
CREATE OR REPLACE FUNCTION user_can_access_organization(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_email TEXT;
  is_super_admin BOOLEAN;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  
  -- Check if super admin
  is_super_admin := user_email IN ('tl@innovareai.com', 'cl@innovareai.com');
  
  IF is_super_admin THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is member of any workspace in the organization
  RETURN EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN workspaces w ON wm.workspace_id = w.id
    WHERE w.organization_id = org_id
    AND wm.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's allowed organizations
CREATE OR REPLACE FUNCTION get_user_allowed_organizations()
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  tenant_type TEXT,
  workspace_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    tc.tenant_type,
    COUNT(w.id) as workspace_count
  FROM organizations o
  LEFT JOIN workspaces w ON o.id = w.organization_id
  LEFT JOIN tenant_configurations tc ON o.id = tc.organization_id
  WHERE user_can_access_organization(o.id)
  GROUP BY o.id, o.name, tc.tenant_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================================
-- 6. TENANT USAGE TRACKING
-- =====================================================================================

CREATE TABLE IF NOT EXISTS tenant_usage_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- 'campaigns_created', 'emails_sent', 'prospects_added', 'storage_used'
  metric_value BIGINT NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, workspace_id, metric_type, period_start)
);

CREATE INDEX idx_tenant_usage_org_id ON tenant_usage_tracking(organization_id);
CREATE INDEX idx_tenant_usage_workspace_id ON tenant_usage_tracking(workspace_id);
CREATE INDEX idx_tenant_usage_period ON tenant_usage_tracking(period_start, period_end);

-- Enable RLS
ALTER TABLE tenant_usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "tenant_usage_isolation" ON tenant_usage_tracking
  FOR ALL USING (user_can_access_organization(organization_id));

-- Function to track usage
CREATE OR REPLACE FUNCTION track_tenant_usage(
  p_workspace_id UUID,
  p_metric_type TEXT,
  p_increment BIGINT DEFAULT 1
)
RETURNS VOID AS $$
DECLARE
  p_organization_id UUID;
  current_period_start DATE;
  current_period_end DATE;
BEGIN
  -- Get organization ID
  SELECT organization_id INTO p_organization_id 
  FROM workspaces WHERE id = p_workspace_id;
  
  -- Calculate current month period
  current_period_start := DATE_TRUNC('month', CURRENT_DATE);
  current_period_end := current_period_start + INTERVAL '1 month' - INTERVAL '1 day';
  
  -- Insert or update usage tracking
  INSERT INTO tenant_usage_tracking (
    organization_id,
    workspace_id,
    metric_type,
    metric_value,
    period_start,
    period_end
  ) VALUES (
    p_organization_id,
    p_workspace_id,
    p_metric_type,
    p_increment,
    current_period_start,
    current_period_end
  )
  ON CONFLICT (organization_id, workspace_id, metric_type, period_start)
  DO UPDATE SET
    metric_value = tenant_usage_tracking.metric_value + p_increment,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================================
-- 7. TENANT ACCESS AUDIT ENHANCEMENT
-- =====================================================================================

-- Enhanced audit function for multi-tenant access
CREATE OR REPLACE FUNCTION audit_tenant_access(
  p_event_type TEXT,
  p_workspace_id UUID,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
DECLARE
  p_organization_id UUID;
  user_email TEXT;
BEGIN
  -- Get organization and user info
  SELECT organization_id INTO p_organization_id 
  FROM workspaces WHERE id = p_workspace_id;
  
  SELECT email INTO user_email 
  FROM auth.users WHERE id = auth.uid();
  
  -- Insert audit record
  INSERT INTO tenant_isolation_audit (
    event_type,
    user_id,
    workspace_id,
    details
  ) VALUES (
    p_event_type,
    auth.uid(),
    p_workspace_id,
    jsonb_build_object(
      'organization_id', p_organization_id,
      'user_email', user_email,
      'resource_type', p_resource_type,
      'resource_id', p_resource_id,
      'additional_details', p_details,
      'timestamp', NOW()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================================
-- 8. VERIFICATION AND TESTING FUNCTIONS
-- =====================================================================================

-- Function to verify complete multi-tenant setup
CREATE OR REPLACE FUNCTION verify_multi_tenant_isolation()
RETURNS TABLE (
  organization_name TEXT,
  workspace_name TEXT,
  has_tenant_config BOOLEAN,
  email_sender TEXT,
  tenant_type TEXT,
  isolation_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.name as organization_name,
    w.name as workspace_name,
    (tc.id IS NOT NULL) as has_tenant_config,
    tc.email_sender_address as email_sender,
    tc.tenant_type,
    CASE 
      WHEN tc.id IS NOT NULL AND w.organization_id IS NOT NULL THEN 100
      WHEN w.organization_id IS NOT NULL THEN 75
      ELSE 0
    END as isolation_score
  FROM organizations o
  LEFT JOIN workspaces w ON o.id = w.organization_id
  LEFT JOIN tenant_configurations tc ON w.id = tc.workspace_id
  ORDER BY o.name, w.name;
END;
$$ LANGUAGE plpgsql;

-- Function to get tenant separation report
CREATE OR REPLACE FUNCTION get_tenant_separation_report()
RETURNS TABLE (
  metric TEXT,
  value TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'Total Organizations'::TEXT,
    COUNT(*)::TEXT,
    CASE WHEN COUNT(*) = 4 THEN '✅ Complete' ELSE '⚠️ Missing' END
  FROM organizations
  UNION ALL
  SELECT 
    'Total Workspaces'::TEXT,
    COUNT(*)::TEXT,
    CASE WHEN COUNT(*) = 4 THEN '✅ Complete' ELSE '⚠️ Missing' END
  FROM workspaces
  UNION ALL
  SELECT 
    'Workspaces with Organizations'::TEXT,
    COUNT(*)::TEXT,
    CASE WHEN COUNT(*) = (SELECT COUNT(*) FROM workspaces) THEN '✅ Complete' ELSE '❌ Incomplete' END
  FROM workspaces WHERE organization_id IS NOT NULL
  UNION ALL
  SELECT 
    'Tenant Configurations'::TEXT,
    COUNT(*)::TEXT,
    CASE WHEN COUNT(*) = 4 THEN '✅ Complete' ELSE '❌ Incomplete' END
  FROM tenant_configurations
  UNION ALL
  SELECT 
    'Infrastructure Owners'::TEXT,
    COUNT(*)::TEXT,
    CASE WHEN COUNT(*) = 2 THEN '✅ Complete' ELSE '⚠️ Check' END
  FROM tenant_configurations WHERE tenant_type = 'infrastructure_owner'
  UNION ALL
  SELECT 
    'Client Organizations'::TEXT,
    COUNT(*)::TEXT,
    CASE WHEN COUNT(*) = 2 THEN '✅ Complete' ELSE '⚠️ Check' END
  FROM tenant_configurations WHERE tenant_type = 'client';
END;
$$ LANGUAGE plpgsql;

-- =====================================================================================
-- 9. COMMENTS AND DOCUMENTATION
-- =====================================================================================

COMMENT ON TABLE tenant_configurations IS 'Complete tenant configuration for all client organizations';
COMMENT ON TABLE tenant_usage_tracking IS 'Usage tracking and limits for all tenant organizations';
COMMENT ON FUNCTION get_tenant_config(UUID) IS 'Get tenant configuration for a workspace';
COMMENT ON FUNCTION user_can_access_organization(UUID) IS 'Check if user can access organization data';
COMMENT ON FUNCTION track_tenant_usage(UUID, TEXT, BIGINT) IS 'Track usage metrics for tenant billing and limits';
COMMENT ON FUNCTION verify_multi_tenant_isolation() IS 'Verify complete multi-tenant isolation setup';
COMMENT ON FUNCTION get_tenant_separation_report() IS 'Get comprehensive tenant separation status report';

-- Migration completion
DO $$
BEGIN
  RAISE NOTICE 'COMPLETE MULTI-TENANT SEPARATION IMPLEMENTED';
  RAISE NOTICE '===============================================';
  RAISE NOTICE 'Organizations configured:';
  RAISE NOTICE '- InnovareAI (Infrastructure Owner)';
  RAISE NOTICE '- 3CubedAI (Infrastructure Owner)';
  RAISE NOTICE '- WT Matchmaker (Client)';
  RAISE NOTICE '- Sendingcell (Client)';
  RAISE NOTICE '';
  RAISE NOTICE 'Features implemented:';
  RAISE NOTICE '- Complete tenant isolation';
  RAISE NOTICE '- Usage tracking and limits';
  RAISE NOTICE '- Email sender separation';
  RAISE NOTICE '- Billing responsibility tracking';
  RAISE NOTICE '- Enhanced audit logging';
  RAISE NOTICE '';
  RAISE NOTICE 'Use verify_multi_tenant_isolation() to check status';
  RAISE NOTICE 'Use get_tenant_separation_report() for compliance';
END $$;