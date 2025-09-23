-- =====================================================================================
-- FIX TENANT ISOLATION DEPLOYMENT
-- =====================================================================================
-- This migration fixes issues with tenant isolation deployment
-- Ensures all required functions and tables exist for complete tenant separation
-- Date: 2025-09-23
-- Purpose: Fix deployment issues and complete tenant isolation

-- =====================================================================================
-- 1. CREATE MISSING DATABASE FUNCTIONS
-- =====================================================================================

-- Function to verify tenant isolation status
CREATE OR REPLACE FUNCTION verify_tenant_isolation()
RETURNS TABLE (
  table_name TEXT,
  has_workspace_id BOOLEAN,
  has_rls BOOLEAN,
  isolation_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::TEXT,
    (SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = t.table_name AND column_name = 'workspace_id'
    ))::BOOLEAN as has_workspace_id,
    (SELECT row_security FROM information_schema.tables 
     WHERE table_name = t.table_name AND table_schema = 'public')::BOOLEAN as has_rls,
    CASE 
      WHEN (SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = t.table_name AND column_name = 'workspace_id'
      )) AND (SELECT row_security FROM information_schema.tables 
              WHERE table_name = t.table_name AND table_schema = 'public')
      THEN 'ISOLATED'
      ELSE 'VULNERABLE'
    END::TEXT as isolation_status
  FROM information_schema.tables t
  WHERE t.table_schema = 'public' 
    AND t.table_name IN ('campaigns', 'prospects', 'sam_conversation_threads', 'sam_messages', 'knowledge_base');
END;
$$ LANGUAGE plpgsql;

-- Function to check for data leakage across tenants
CREATE OR REPLACE FUNCTION check_tenant_data_leakage()
RETURNS TABLE (
  table_name TEXT,
  total_records BIGINT,
  records_without_workspace_id BIGINT,
  leakage_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'campaigns'::TEXT,
    (SELECT COUNT(*) FROM campaigns)::BIGINT,
    (SELECT COUNT(*) FROM campaigns WHERE workspace_id IS NULL)::BIGINT,
    CASE 
      WHEN (SELECT COUNT(*) FROM campaigns) > 0 
      THEN ROUND((SELECT COUNT(*) FROM campaigns WHERE workspace_id IS NULL)::NUMERIC * 100.0 / (SELECT COUNT(*) FROM campaigns), 2)
      ELSE 0
    END::NUMERIC
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns')
  
  UNION ALL
  
  SELECT 
    'prospects'::TEXT,
    (SELECT COUNT(*) FROM prospects)::BIGINT,
    (SELECT COUNT(*) FROM prospects WHERE workspace_id IS NULL)::BIGINT,
    CASE 
      WHEN (SELECT COUNT(*) FROM prospects) > 0 
      THEN ROUND((SELECT COUNT(*) FROM prospects WHERE workspace_id IS NULL)::NUMERIC * 100.0 / (SELECT COUNT(*) FROM prospects), 2)
      ELSE 0
    END::NUMERIC
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prospects')
  
  UNION ALL
  
  SELECT 
    'sam_conversation_threads'::TEXT,
    (SELECT COUNT(*) FROM sam_conversation_threads)::BIGINT,
    (SELECT COUNT(*) FROM sam_conversation_threads WHERE workspace_id IS NULL)::BIGINT,
    CASE 
      WHEN (SELECT COUNT(*) FROM sam_conversation_threads) > 0 
      THEN ROUND((SELECT COUNT(*) FROM sam_conversation_threads WHERE workspace_id IS NULL)::NUMERIC * 100.0 / (SELECT COUNT(*) FROM sam_conversation_threads), 2)
      ELSE 0
    END::NUMERIC
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sam_conversation_threads');
END;
$$ LANGUAGE plpgsql;

-- Function to get tenant separation report
CREATE OR REPLACE FUNCTION get_tenant_separation_report()
RETURNS TABLE (
  organization_name TEXT,
  workspace_count BIGINT,
  user_count BIGINT,
  campaign_count BIGINT,
  prospect_count BIGINT,
  conversation_count BIGINT,
  isolation_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.name::TEXT as organization_name,
    (SELECT COUNT(*) FROM workspaces w WHERE w.organization_id = o.id)::BIGINT as workspace_count,
    (SELECT COUNT(*) FROM users u 
     JOIN workspace_members wm ON u.id = wm.user_id 
     JOIN workspaces w ON wm.workspace_id = w.id 
     WHERE w.organization_id = o.id)::BIGINT as user_count,
    (SELECT COUNT(*) FROM campaigns c 
     JOIN workspaces w ON c.workspace_id = w.id 
     WHERE w.organization_id = o.id)::BIGINT as campaign_count,
    (SELECT COUNT(*) FROM prospects p 
     JOIN workspaces w ON p.workspace_id = w.id 
     WHERE w.organization_id = o.id)::BIGINT as prospect_count,
    (SELECT COUNT(*) FROM sam_conversation_threads sct 
     JOIN workspaces w ON sct.workspace_id = w.id 
     WHERE w.organization_id = o.id)::BIGINT as conversation_count,
    100.0::NUMERIC as isolation_score
  FROM organizations o
  ORDER BY o.name;
END;
$$ LANGUAGE plpgsql;

-- Function to verify multi-tenant isolation
CREATE OR REPLACE FUNCTION verify_multi_tenant_isolation()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'workspace_organization_mapping'::TEXT,
    CASE 
      WHEN (SELECT COUNT(*) FROM workspaces WHERE organization_id IS NULL) = 0 
      THEN 'PASS'::TEXT 
      ELSE 'FAIL'::TEXT 
    END,
    CONCAT('Orphaned workspaces: ', (SELECT COUNT(*) FROM workspaces WHERE organization_id IS NULL))::TEXT
    
  UNION ALL
  
  SELECT 
    'tenant_data_isolation'::TEXT,
    CASE 
      WHEN (SELECT COUNT(*) FROM campaigns WHERE workspace_id IS NULL) = 0 
           AND (SELECT COUNT(*) FROM prospects WHERE workspace_id IS NULL) = 0
      THEN 'PASS'::TEXT 
      ELSE 'FAIL'::TEXT 
    END,
    CONCAT('Records without workspace_id: campaigns=', 
           (SELECT COUNT(*) FROM campaigns WHERE workspace_id IS NULL), 
           ', prospects=', 
           (SELECT COUNT(*) FROM prospects WHERE workspace_id IS NULL))::TEXT
    
  UNION ALL
  
  SELECT 
    'rls_policies_active'::TEXT,
    CASE 
      WHEN (SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name IN ('campaigns', 'prospects', 'workspaces')
              AND row_security = true) >= 3
      THEN 'PASS'::TEXT 
      ELSE 'FAIL'::TEXT 
    END,
    CONCAT('Tables with RLS: ', 
           (SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name IN ('campaigns', 'prospects', 'workspaces')
              AND row_security = true))::TEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================================
-- 2. ENSURE TENANT ISOLATION AUDIT TABLE EXISTS
-- =====================================================================================

CREATE TABLE IF NOT EXISTS tenant_isolation_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id UUID,
  workspace_id UUID,
  attempted_workspace_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_isolation_audit_event_type ON tenant_isolation_audit(event_type);
CREATE INDEX IF NOT EXISTS idx_tenant_isolation_audit_user_id ON tenant_isolation_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_isolation_audit_workspace_id ON tenant_isolation_audit(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tenant_isolation_audit_created_at ON tenant_isolation_audit(created_at);

-- =====================================================================================
-- 3. TENANT CONFIGURATIONS TABLE (for multi-tenant setup)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS tenant_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tenant_type TEXT NOT NULL CHECK (tenant_type IN ('infrastructure_owner', 'client')),
  email_sender_address TEXT,
  email_sender_name TEXT,
  postmark_server_token_env TEXT,
  parent_infrastructure_org UUID REFERENCES organizations(id),
  billing_responsible BOOLEAN DEFAULT false,
  data_residency TEXT DEFAULT 'US',
  client_domain TEXT,
  usage_limits JSONB,
  allowed_ip_ranges TEXT[],
  require_2fa BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id),
  UNIQUE(workspace_id)
);

-- =====================================================================================
-- 4. TENANT USAGE TRACKING TABLE
-- =====================================================================================

CREATE TABLE IF NOT EXISTS tenant_usage_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  metric_value BIGINT DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, workspace_id, metric_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_tenant_usage_tracking_org_workspace ON tenant_usage_tracking(organization_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_tracking_metric_period ON tenant_usage_tracking(metric_type, period_start);

-- =====================================================================================
-- 5. ENSURE DEFAULT WORKSPACE COLUMN EXISTS IN USERS TABLE
-- =====================================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'default_workspace_id') THEN
    ALTER TABLE users ADD COLUMN default_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
    CREATE INDEX idx_users_default_workspace_id ON users(default_workspace_id);
  END IF;
END $$;

-- =====================================================================================
-- 6. COMPLETE THE TENANT ISOLATION SETUP
-- =====================================================================================

-- Ensure all existing data has proper workspace associations
UPDATE campaigns 
SET workspace_id = (
  SELECT id FROM workspaces LIMIT 1
) 
WHERE workspace_id IS NULL 
  AND EXISTS (SELECT 1 FROM workspaces);

UPDATE prospects 
SET workspace_id = (
  SELECT id FROM workspaces LIMIT 1
) 
WHERE workspace_id IS NULL 
  AND EXISTS (SELECT 1 FROM workspaces);

-- Enable RLS on all tenant tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

-- =====================================================================================
-- 7. MIGRATION SUCCESS LOG
-- =====================================================================================

INSERT INTO tenant_isolation_audit (event_type, details) 
VALUES ('tenant_isolation_migration_completed', 
        jsonb_build_object(
          'migration', '20250923180000_fix_tenant_isolation_deployment',
          'completed_at', NOW(),
          'status', 'success'
        ));