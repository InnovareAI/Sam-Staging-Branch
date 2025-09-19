-- Integration Status Tracking for Multi-Tenant Unipile Deployment
-- Created: 2025-09-17

-- Drop existing table if it exists (for development)
DROP TABLE IF EXISTS integration_status;

-- Create integration status tracking table
CREATE TABLE integration_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Integration Details
  integration_type TEXT NOT NULL, -- 'unipile_linkedin' | 'brightdata_proxy' | 'reachinbox_email'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'configured' | 'connected' | 'error' | 'disconnected'
  
  -- Account/Connection Metadata
  account_identifier TEXT, -- email, linkedin_id, proxy_endpoint, workspace_slug
  account_name TEXT,
  connection_details JSONB DEFAULT '{}',
  
  -- Status Tracking
  last_checked_at TIMESTAMP DEFAULT NOW(),
  last_successful_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Performance Metrics
  response_time_ms INTEGER,
  success_rate FLOAT DEFAULT 1.0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, workspace_id, integration_type)
);

-- Indexes for fast lookups
CREATE INDEX idx_integration_status_lookup ON integration_status 
(user_id, workspace_id, integration_type);

CREATE INDEX idx_integration_status_by_type ON integration_status 
(integration_type, status);

CREATE INDEX idx_integration_status_workspace ON integration_status 
(workspace_id, status);

-- RLS Policies
ALTER TABLE integration_status ENABLE ROW LEVEL SECURITY;

-- Users can only see their own workspace integration status
CREATE POLICY "Users can view their workspace integration status" ON integration_status
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm 
      WHERE wm.workspace_id = integration_status.workspace_id 
      AND wm.user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Users can insert integration status for their workspaces  
CREATE POLICY "Users can insert integration status for their workspaces" ON integration_status
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm 
      WHERE wm.workspace_id = integration_status.workspace_id 
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
    OR user_id = auth.uid()
  );

-- Users can update integration status for their workspaces
CREATE POLICY "Users can update their workspace integration status" ON integration_status
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm 
      WHERE wm.workspace_id = integration_status.workspace_id 
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
    OR user_id = auth.uid()
  );

-- Service role can do everything (for admin APIs)
CREATE POLICY "Service role full access" ON integration_status
  FOR ALL USING (auth.role() = 'service_role');

-- Functions for status management
CREATE OR REPLACE FUNCTION update_integration_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
CREATE TRIGGER trigger_integration_status_updated_at
  BEFORE UPDATE ON integration_status
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_status_timestamp();

-- Helper function to get workspace integration summary
CREATE OR REPLACE FUNCTION get_workspace_integration_summary(workspace_uuid UUID)
RETURNS TABLE (
  integration_type TEXT,
  status TEXT,
  account_name TEXT,
  last_checked_at TIMESTAMP,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.integration_type,
    i.status,
    i.account_name,
    i.last_checked_at,
    i.error_message
  FROM integration_status i
  WHERE i.workspace_id = workspace_uuid
  ORDER BY i.integration_type, i.updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Helper function to update integration health
CREATE OR REPLACE FUNCTION update_integration_health(
  p_workspace_id UUID,
  p_integration_type TEXT,
  p_status TEXT,
  p_response_time INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE integration_status 
  SET 
    status = p_status,
    last_checked_at = NOW(),
    response_time_ms = COALESCE(p_response_time, response_time_ms),
    error_message = p_error_message,
    last_successful_at = CASE 
      WHEN p_status IN ('connected', 'configured') THEN NOW() 
      ELSE last_successful_at 
    END,
    retry_count = CASE 
      WHEN p_status = 'error' THEN retry_count + 1 
      ELSE 0 
    END,
    updated_at = NOW()
  WHERE workspace_id = p_workspace_id 
    AND integration_type = p_integration_type;
END;
$$ LANGUAGE plpgsql;

-- Sample data for testing (optional - remove in production)
INSERT INTO integration_status (user_id, workspace_id, integration_type, status, account_identifier, account_name, connection_details)
SELECT 
  u.id,
  w.id,
  'unipile_linkedin',
  'configured',
  w.slug,
  w.name || ' LinkedIn',
  jsonb_build_object(
    'deployment_mode', 'production',
    'auto_deployed', true,
    'deployment_date', NOW()
  )
FROM users u
JOIN workspaces w ON w.owner_id = u.id
WHERE w.is_active = true
ON CONFLICT (user_id, workspace_id, integration_type) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE integration_status IS 'Tracks integration status across all tenants/workspaces for monitoring and deployment';
COMMENT ON COLUMN integration_status.integration_type IS 'Type of integration: unipile_linkedin, brightdata_proxy, reachinbox_email, etc.';
COMMENT ON COLUMN integration_status.status IS 'Current status: pending, configured, connected, error, disconnected';
COMMENT ON COLUMN integration_status.connection_details IS 'JSON metadata specific to each integration type';
COMMENT ON FUNCTION get_workspace_integration_summary IS 'Returns summary of all integrations for a workspace';
COMMENT ON FUNCTION update_integration_health IS 'Updates integration health status from monitoring systems';