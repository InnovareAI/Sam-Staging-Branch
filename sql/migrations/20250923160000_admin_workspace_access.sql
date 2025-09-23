-- Admin Workspace Access System
-- Allows admin users to access and manage campaigns across workspaces

-- User roles enum
CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');

-- Add role column to auth.users metadata or create separate table
-- We'll use a separate table for better control
CREATE TABLE user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'user',
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one role per user (can be updated)
  UNIQUE(user_id)
);

-- Workspace permissions for granular access control
CREATE TABLE workspace_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  permission_type TEXT NOT NULL, -- 'read', 'write', 'admin', 'owner'
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate permissions
  UNIQUE(user_id, workspace_id, permission_type)
);

-- Admin session tracking for workspace switching
CREATE TABLE admin_workspace_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target_workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  original_workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  actions_performed JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_workspace_permissions_user_id ON workspace_permissions(user_id);
CREATE INDEX idx_workspace_permissions_workspace_id ON workspace_permissions(workspace_id);
CREATE INDEX idx_admin_workspace_sessions_admin_user_id ON admin_workspace_sessions(admin_user_id);
CREATE INDEX idx_admin_workspace_sessions_target_workspace ON admin_workspace_sessions(target_workspace_id);

-- Functions for role management
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS user_role AS $$
DECLARE
  user_role_result user_role;
BEGIN
  SELECT role INTO user_role_result
  FROM user_roles
  WHERE user_id = user_uuid
    AND (expires_at IS NULL OR expires_at > NOW());
  
  -- Default to 'user' if no role found
  RETURN COALESCE(user_role_result, 'user'::user_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check workspace access
CREATE OR REPLACE FUNCTION has_workspace_access(
  user_uuid UUID,
  workspace_uuid UUID,
  required_permission TEXT DEFAULT 'read'
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role_result user_role;
  has_permission BOOLEAN := FALSE;
  is_workspace_owner BOOLEAN := FALSE;
BEGIN
  -- Get user role
  SELECT get_user_role(user_uuid) INTO user_role_result;
  
  -- Super admins have access to everything
  IF user_role_result = 'super_admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user owns the workspace
  SELECT EXISTS(
    SELECT 1 FROM workspaces 
    WHERE id = workspace_uuid AND user_id = user_uuid
  ) INTO is_workspace_owner;
  
  IF is_workspace_owner THEN
    RETURN TRUE;
  END IF;
  
  -- Check explicit workspace permissions
  SELECT EXISTS(
    SELECT 1 FROM workspace_permissions
    WHERE user_id = user_uuid
      AND workspace_id = workspace_uuid
      AND (
        permission_type = required_permission
        OR permission_type = 'admin'
        OR (required_permission = 'read' AND permission_type IN ('write', 'admin'))
        OR (required_permission = 'write' AND permission_type = 'admin')
      )
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO has_permission;
  
  -- Admins have read access to all workspaces by default
  IF user_role_result = 'admin' AND required_permission = 'read' THEN
    RETURN TRUE;
  END IF;
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get accessible workspaces for user
CREATE OR REPLACE FUNCTION get_accessible_workspaces(user_uuid UUID)
RETURNS TABLE(
  workspace_id UUID,
  workspace_name TEXT,
  workspace_slug TEXT,
  access_type TEXT,
  permission_level TEXT
) AS $$
DECLARE
  user_role_result user_role;
BEGIN
  SELECT get_user_role(user_uuid) INTO user_role_result;
  
  -- Super admins see all workspaces
  IF user_role_result = 'super_admin' THEN
    RETURN QUERY
    SELECT 
      w.id,
      w.name,
      w.slug,
      'super_admin'::TEXT,
      'admin'::TEXT
    FROM workspaces w
    ORDER BY w.name;
    RETURN;
  END IF;
  
  -- Return owned workspaces
  RETURN QUERY
  SELECT 
    w.id,
    w.name,
    w.slug,
    'owner'::TEXT,
    'admin'::TEXT
  FROM workspaces w
  WHERE w.user_id = user_uuid;
  
  -- Return explicitly granted workspaces
  RETURN QUERY
  SELECT 
    w.id,
    w.name,
    w.slug,
    'granted'::TEXT,
    wp.permission_type
  FROM workspaces w
  INNER JOIN workspace_permissions wp ON w.id = wp.workspace_id
  WHERE wp.user_id = user_uuid
    AND w.user_id != user_uuid  -- Don't duplicate owned workspaces
    AND (wp.expires_at IS NULL OR wp.expires_at > NOW());
  
  -- Admins get read access to all other workspaces
  IF user_role_result = 'admin' THEN
    RETURN QUERY
    SELECT 
      w.id,
      w.name,
      w.slug,
      'admin_default'::TEXT,
      'read'::TEXT
    FROM workspaces w
    WHERE w.user_id != user_uuid
      AND NOT EXISTS(
        SELECT 1 FROM workspace_permissions wp 
        WHERE wp.workspace_id = w.id AND wp.user_id = user_uuid
      );
  END IF;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to start admin workspace session
CREATE OR REPLACE FUNCTION start_admin_workspace_session(
  admin_uuid UUID,
  target_workspace_uuid UUID,
  original_workspace_uuid UUID
)
RETURNS UUID AS $$
DECLARE
  session_id UUID;
  user_role_result user_role;
BEGIN
  -- Verify admin access
  SELECT get_user_role(admin_uuid) INTO user_role_result;
  
  IF user_role_result NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Insufficient permissions for workspace switching';
  END IF;
  
  IF NOT has_workspace_access(admin_uuid, target_workspace_uuid, 'read') THEN
    RAISE EXCEPTION 'No access to target workspace';
  END IF;
  
  -- End any existing session
  UPDATE admin_workspace_sessions 
  SET session_end = NOW()
  WHERE admin_user_id = admin_uuid AND session_end IS NULL;
  
  -- Start new session
  INSERT INTO admin_workspace_sessions (
    admin_user_id,
    target_workspace_id,
    original_workspace_id
  ) VALUES (
    admin_uuid,
    target_workspace_uuid,
    original_workspace_uuid
  ) RETURNING id INTO session_id;
  
  RETURN session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies

-- User roles: Users can see their own role, admins can see all
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own role" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" ON user_roles
  FOR SELECT USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

CREATE POLICY "Super admins can manage roles" ON user_roles
  FOR ALL USING (get_user_role(auth.uid()) = 'super_admin');

-- Workspace permissions: Admins can manage, users can see their own
ALTER TABLE workspace_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own permissions" ON workspace_permissions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Workspace owners can manage permissions" ON workspace_permissions
  FOR ALL USING (
    EXISTS(SELECT 1 FROM workspaces WHERE id = workspace_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can view all permissions" ON workspace_permissions
  FOR SELECT USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

CREATE POLICY "Super admins can manage all permissions" ON workspace_permissions
  FOR ALL USING (get_user_role(auth.uid()) = 'super_admin');

-- Admin sessions: Only admins can see their own sessions
ALTER TABLE admin_workspace_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view their own sessions" ON admin_workspace_sessions
  FOR SELECT USING (
    admin_user_id = auth.uid() 
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

CREATE POLICY "Admins can manage their own sessions" ON admin_workspace_sessions
  FOR ALL USING (
    admin_user_id = auth.uid() 
    AND get_user_role(auth.uid()) IN ('admin', 'super_admin')
  );

-- Grant initial super admin role (replace with actual admin user ID)
-- INSERT INTO user_roles (user_id, role, granted_by) 
-- VALUES ('f6885ff3-deef-4781-8721-93011c990b1b', 'super_admin', 'f6885ff3-deef-4781-8721-93011c990b1b');

-- Comments for documentation
COMMENT ON TABLE user_roles IS 'System-wide user roles for access control';
COMMENT ON TABLE workspace_permissions IS 'Granular workspace-level permissions';
COMMENT ON TABLE admin_workspace_sessions IS 'Tracking for admin workspace switching sessions';
COMMENT ON FUNCTION get_user_role(UUID) IS 'Get effective user role with expiration checking';
COMMENT ON FUNCTION has_workspace_access(UUID, UUID, TEXT) IS 'Check if user has required access to workspace';
COMMENT ON FUNCTION get_accessible_workspaces(UUID) IS 'Get all workspaces accessible to user with permission levels';
COMMENT ON FUNCTION start_admin_workspace_session(UUID, UUID, UUID) IS 'Start admin session for cross-workspace access';