-- Workspace Invitations System
-- Allows workspace owners to invite users via email

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_workspace_invitations_workspace_id ON workspace_invitations(workspace_id);
CREATE INDEX idx_workspace_invitations_token ON workspace_invitations(token);
CREATE INDEX idx_workspace_invitations_email ON workspace_invitations(invited_email);
CREATE INDEX idx_workspace_invitations_status ON workspace_invitations(status);

-- RLS Policies
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Workspace members can view invitations for their workspace
CREATE POLICY "Workspace members can view invitations"
ON workspace_invitations
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);

-- Workspace admins can create invitations
CREATE POLICY "Workspace admins can create invitations"
ON workspace_invitations
FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  )
);

-- Workspace admins can update invitations (cancel, etc.)
CREATE POLICY "Workspace admins can update invitations"
ON workspace_invitations
FOR UPDATE
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  )
);

-- Workspace admins can delete invitations
CREATE POLICY "Workspace admins can delete invitations"
ON workspace_invitations
FOR DELETE
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  )
);

-- Function to generate secure invitation token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$;

-- Function to check if invitation is valid
CREATE OR REPLACE FUNCTION is_invitation_valid(invitation_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  invitation_record workspace_invitations;
BEGIN
  SELECT * INTO invitation_record
  FROM workspace_invitations
  WHERE token = invitation_token
  AND status = 'pending'
  AND expires_at > NOW();

  RETURN FOUND;
END;
$$;

-- Function to accept invitation
CREATE OR REPLACE FUNCTION accept_workspace_invitation(
  invitation_token TEXT,
  user_id UUID
)
RETURNS TABLE (
  workspace_id UUID,
  role TEXT,
  workspace_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record workspace_invitations;
  workspace_record workspaces;
BEGIN
  -- Get and validate invitation
  SELECT * INTO invitation_record
  FROM workspace_invitations
  WHERE token = invitation_token
  AND status = 'pending'
  AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- Get workspace details
  SELECT * INTO workspace_record
  FROM workspaces
  WHERE id = invitation_record.workspace_id;

  -- Add user to workspace
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (invitation_record.workspace_id, user_id, invitation_record.role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Mark invitation as accepted
  UPDATE workspace_invitations
  SET status = 'accepted',
      accepted_at = NOW(),
      accepted_by = user_id
  WHERE id = invitation_record.id;

  -- Return workspace details
  RETURN QUERY
  SELECT
    workspace_record.id,
    invitation_record.role,
    workspace_record.name;
END;
$$;

-- Comments
COMMENT ON TABLE workspace_invitations IS 'Email invitations for users to join workspaces';
COMMENT ON FUNCTION generate_invitation_token() IS 'Generates a secure random token for workspace invitations';
COMMENT ON FUNCTION is_invitation_valid(TEXT) IS 'Checks if an invitation token is valid and not expired';
COMMENT ON FUNCTION accept_workspace_invitation(TEXT, UUID) IS 'Accepts a workspace invitation and adds user to workspace';
