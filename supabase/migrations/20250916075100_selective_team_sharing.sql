-- Selective Team Member Sharing Controls
-- Adds granular per-user sharing controls and team member-specific permissions

-- 1. Individual team member sharing preferences 
CREATE TABLE IF NOT EXISTS workspace_member_sharing_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    data_owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Who owns the data
    share_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Who can access it
    
    -- Granular permissions per data source
    can_access_unipile BOOLEAN DEFAULT false,
    can_access_brightdata BOOLEAN DEFAULT false,
    can_access_apollo BOOLEAN DEFAULT false,
    can_access_manual BOOLEAN DEFAULT false,
    can_access_imported BOOLEAN DEFAULT false, -- CSV uploads, etc.
    
    -- Specific data type permissions
    can_access_prospects BOOLEAN DEFAULT true,
    can_access_companies BOOLEAN DEFAULT true,
    can_access_enrichment BOOLEAN DEFAULT true,
    can_access_contact_lists BOOLEAN DEFAULT false, -- More sensitive
    
    -- Usage permissions
    can_export_data BOOLEAN DEFAULT false,
    can_use_in_campaigns BOOLEAN DEFAULT true,
    can_see_data_source BOOLEAN DEFAULT true, -- Hide where data came from
    
    -- Sharing metadata
    permission_level TEXT DEFAULT 'view_only' CHECK (permission_level IN ('no_access', 'view_only', 'use_in_campaigns', 'full_access')),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES users(id), -- Who granted these permissions
    expires_at TIMESTAMPTZ, -- Optional expiration
    
    -- Audit trail
    last_accessed_at TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate permissions
    UNIQUE(workspace_id, data_owner_id, share_with_user_id),
    
    -- Can't share with yourself
    CHECK (data_owner_id != share_with_user_id)
);

-- 2. Team sharing invitations (for when someone wants to share with you)
CREATE TABLE IF NOT EXISTS workspace_sharing_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_user UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Invitation details
    invitation_message TEXT,
    data_sources_offered TEXT[] DEFAULT '{}', -- ['unipile', 'brightdata', 'apollo']
    permission_level_offered TEXT DEFAULT 'view_only',
    
    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workspace_id, invited_by, invited_user)
);

-- 3. Quick sharing presets for common scenarios
CREATE TABLE IF NOT EXISTS workspace_sharing_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Preset details
    preset_name TEXT NOT NULL,
    preset_description TEXT,
    
    -- Default permissions for this preset
    permissions JSONB NOT NULL DEFAULT '{
        "can_access_unipile": true,
        "can_access_brightdata": true,
        "can_access_apollo": false,
        "can_access_manual": false,
        "can_access_prospects": true,
        "can_access_companies": true,
        "can_use_in_campaigns": true,
        "can_export_data": false,
        "permission_level": "use_in_campaigns"
    }',
    
    -- Usage tracking
    times_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Preset status
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false, -- Can have one default per workspace
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workspace_id, preset_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_member_sharing_permissions_owner ON workspace_member_sharing_permissions(data_owner_id);
CREATE INDEX IF NOT EXISTS idx_member_sharing_permissions_shared_with ON workspace_member_sharing_permissions(share_with_user_id);
CREATE INDEX IF NOT EXISTS idx_member_sharing_permissions_workspace ON workspace_member_sharing_permissions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sharing_invitations_workspace ON workspace_sharing_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sharing_invitations_invited_user ON workspace_sharing_invitations(invited_user);
CREATE INDEX IF NOT EXISTS idx_sharing_invitations_status ON workspace_sharing_invitations(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sharing_presets_workspace ON workspace_sharing_presets(workspace_id);

-- Enable RLS
ALTER TABLE workspace_member_sharing_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_sharing_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_sharing_presets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own sharing permissions" ON workspace_member_sharing_permissions
    FOR ALL USING (
        data_owner_id = (SELECT id FROM users WHERE clerk_id = auth.uid()::text) OR
        share_with_user_id = (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
    );

CREATE POLICY "Users can see sharing invitations involving them" ON workspace_sharing_invitations
    FOR ALL USING (
        invited_by = (SELECT id FROM users WHERE clerk_id = auth.uid()::text) OR
        invited_user = (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
    );

CREATE POLICY "Users can manage workspace sharing presets" ON workspace_sharing_presets
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = 
            (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
        )
    );

-- Functions for selective sharing management

-- Function to invite a team member to access your data
CREATE OR REPLACE FUNCTION invite_team_member_to_data_sharing(
    p_workspace_id UUID,
    p_inviter_id UUID,
    p_invited_user_id UUID,
    p_data_sources TEXT[],
    p_permission_level TEXT DEFAULT 'view_only',
    p_invitation_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invitation_id UUID;
BEGIN
    -- Validate that both users are in the workspace
    IF NOT EXISTS (
        SELECT 1 FROM workspace_members 
        WHERE workspace_id = p_workspace_id AND user_id = p_inviter_id
    ) THEN
        RAISE EXCEPTION 'Inviter is not a member of this workspace';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM workspace_members 
        WHERE workspace_id = p_workspace_id AND user_id = p_invited_user_id
    ) THEN
        RAISE EXCEPTION 'Invited user is not a member of this workspace';
    END IF;
    
    -- Create or update invitation
    INSERT INTO workspace_sharing_invitations (
        workspace_id,
        invited_by,
        invited_user,
        invitation_message,
        data_sources_offered,
        permission_level_offered
    ) VALUES (
        p_workspace_id,
        p_inviter_id,
        p_invited_user_id,
        p_invitation_message,
        p_data_sources,
        p_permission_level
    )
    ON CONFLICT (workspace_id, invited_by, invited_user)
    DO UPDATE SET
        data_sources_offered = EXCLUDED.data_sources_offered,
        permission_level_offered = EXCLUDED.permission_level_offered,
        invitation_message = EXCLUDED.invitation_message,
        status = 'pending',
        expires_at = NOW() + INTERVAL '7 days',
        updated_at = NOW()
    RETURNING id INTO v_invitation_id;
    
    RETURN v_invitation_id;
END;
$$;

-- Function to accept/decline a sharing invitation
CREATE OR REPLACE FUNCTION respond_to_sharing_invitation(
    p_invitation_id UUID,
    p_user_id UUID,
    p_response TEXT, -- 'accept' or 'decline'
    p_custom_permissions JSONB DEFAULT NULL -- Override permissions if accepting
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invitation RECORD;
    v_permissions JSONB;
BEGIN
    -- Get invitation details
    SELECT * INTO v_invitation
    FROM workspace_sharing_invitations
    WHERE id = p_invitation_id
      AND invited_user = p_user_id
      AND status = 'pending'
      AND expires_at > NOW();
    
    IF v_invitation IS NULL THEN
        RAISE EXCEPTION 'Invitation not found, expired, or already responded to';
    END IF;
    
    -- Update invitation status
    UPDATE workspace_sharing_invitations
    SET 
        status = CASE WHEN p_response = 'accept' THEN 'accepted' ELSE 'declined' END,
        responded_at = NOW(),
        updated_at = NOW()
    WHERE id = p_invitation_id;
    
    -- If accepted, create permissions
    IF p_response = 'accept' THEN
        -- Use custom permissions if provided, otherwise use invitation defaults
        v_permissions := COALESCE(p_custom_permissions, jsonb_build_object(
            'can_access_unipile', 'unipile' = ANY(v_invitation.data_sources_offered),
            'can_access_brightdata', 'brightdata' = ANY(v_invitation.data_sources_offered),
            'can_access_apollo', 'apollo' = ANY(v_invitation.data_sources_offered),
            'can_access_manual', 'manual' = ANY(v_invitation.data_sources_offered),
            'can_use_in_campaigns', v_invitation.permission_level_offered IN ('use_in_campaigns', 'full_access'),
            'can_export_data', v_invitation.permission_level_offered = 'full_access',
            'permission_level', v_invitation.permission_level_offered
        ));
        
        -- Create sharing permissions
        INSERT INTO workspace_member_sharing_permissions (
            workspace_id,
            data_owner_id,
            share_with_user_id,
            can_access_unipile,
            can_access_brightdata,
            can_access_apollo,
            can_access_manual,
            can_use_in_campaigns,
            can_export_data,
            permission_level,
            granted_by
        ) VALUES (
            v_invitation.workspace_id,
            v_invitation.invited_by,
            p_user_id,
            (v_permissions->>'can_access_unipile')::boolean,
            (v_permissions->>'can_access_brightdata')::boolean,
            (v_permissions->>'can_access_apollo')::boolean,
            (v_permissions->>'can_access_manual')::boolean,
            (v_permissions->>'can_use_in_campaigns')::boolean,
            (v_permissions->>'can_export_data')::boolean,
            v_permissions->>'permission_level',
            v_invitation.invited_by
        )
        ON CONFLICT (workspace_id, data_owner_id, share_with_user_id)
        DO UPDATE SET
            can_access_unipile = EXCLUDED.can_access_unipile,
            can_access_brightdata = EXCLUDED.can_access_brightdata,
            can_access_apollo = EXCLUDED.can_access_apollo,
            can_access_manual = EXCLUDED.can_access_manual,
            can_use_in_campaigns = EXCLUDED.can_use_in_campaigns,
            can_export_data = EXCLUDED.can_export_data,
            permission_level = EXCLUDED.permission_level,
            updated_at = NOW();
    END IF;
    
    RETURN true;
END;
$$;

-- Function to update individual team member permissions
CREATE OR REPLACE FUNCTION update_team_member_permissions(
    p_workspace_id UUID,
    p_data_owner_id UUID,
    p_share_with_user_id UUID,
    p_permissions JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify data owner is making the request
    IF p_data_owner_id != (SELECT id FROM users WHERE clerk_id = auth.uid()::text) THEN
        RAISE EXCEPTION 'Only data owner can update permissions';
    END IF;
    
    -- Verify both users are in the workspace
    IF NOT EXISTS (
        SELECT 1 FROM workspace_members 
        WHERE workspace_id = p_workspace_id 
        AND user_id IN (p_data_owner_id, p_share_with_user_id)
        GROUP BY workspace_id
        HAVING COUNT(*) = 2
    ) THEN
        RAISE EXCEPTION 'Both users must be members of the workspace';
    END IF;
    
    -- Update or insert permissions
    INSERT INTO workspace_member_sharing_permissions (
        workspace_id,
        data_owner_id,
        share_with_user_id,
        can_access_unipile,
        can_access_brightdata,
        can_access_apollo,
        can_access_manual,
        can_access_imported,
        can_access_prospects,
        can_access_companies,
        can_access_enrichment,
        can_access_contact_lists,
        can_export_data,
        can_use_in_campaigns,
        can_see_data_source,
        permission_level
    ) VALUES (
        p_workspace_id,
        p_data_owner_id,
        p_share_with_user_id,
        COALESCE((p_permissions->>'can_access_unipile')::boolean, false),
        COALESCE((p_permissions->>'can_access_brightdata')::boolean, false),
        COALESCE((p_permissions->>'can_access_apollo')::boolean, false),
        COALESCE((p_permissions->>'can_access_manual')::boolean, false),
        COALESCE((p_permissions->>'can_access_imported')::boolean, false),
        COALESCE((p_permissions->>'can_access_prospects')::boolean, true),
        COALESCE((p_permissions->>'can_access_companies')::boolean, true),
        COALESCE((p_permissions->>'can_access_enrichment')::boolean, true),
        COALESCE((p_permissions->>'can_access_contact_lists')::boolean, false),
        COALESCE((p_permissions->>'can_export_data')::boolean, false),
        COALESCE((p_permissions->>'can_use_in_campaigns')::boolean, true),
        COALESCE((p_permissions->>'can_see_data_source')::boolean, true),
        COALESCE(p_permissions->>'permission_level', 'view_only')
    )
    ON CONFLICT (workspace_id, data_owner_id, share_with_user_id)
    DO UPDATE SET
        can_access_unipile = EXCLUDED.can_access_unipile,
        can_access_brightdata = EXCLUDED.can_access_brightdata,
        can_access_apollo = EXCLUDED.can_access_apollo,
        can_access_manual = EXCLUDED.can_access_manual,
        can_access_imported = EXCLUDED.can_access_imported,
        can_access_prospects = EXCLUDED.can_access_prospects,
        can_access_companies = EXCLUDED.can_access_companies,
        can_access_enrichment = EXCLUDED.can_access_enrichment,
        can_access_contact_lists = EXCLUDED.can_access_contact_lists,
        can_export_data = EXCLUDED.can_export_data,
        can_use_in_campaigns = EXCLUDED.can_use_in_campaigns,
        can_see_data_source = EXCLUDED.can_see_data_source,
        permission_level = EXCLUDED.permission_level,
        updated_at = NOW();
    
    RETURN true;
END;
$$;

-- View for team member sharing dashboard
CREATE OR REPLACE VIEW workspace_team_sharing_overview AS
SELECT 
    wm.workspace_id,
    data_owner.id as owner_id,
    data_owner.email as owner_email,
    data_owner.first_name || ' ' || data_owner.last_name as owner_name,
    shared_with.id as shared_with_id,
    shared_with.email as shared_with_email,
    shared_with.first_name || ' ' || shared_with.last_name as shared_with_name,
    wmsp.permission_level,
    wmsp.can_access_unipile,
    wmsp.can_access_brightdata,
    wmsp.can_access_apollo,
    wmsp.can_use_in_campaigns,
    wmsp.can_export_data,
    wmsp.access_count,
    wmsp.last_accessed_at,
    wmsp.granted_at
FROM workspace_members wm
JOIN users data_owner ON wm.user_id = data_owner.id
CROSS JOIN workspace_members wm2
JOIN users shared_with ON wm2.user_id = shared_with.id
LEFT JOIN workspace_member_sharing_permissions wmsp ON (
    wmsp.workspace_id = wm.workspace_id
    AND wmsp.data_owner_id = data_owner.id
    AND wmsp.share_with_user_id = shared_with.id
)
WHERE wm.workspace_id = wm2.workspace_id
  AND data_owner.id != shared_with.id;

-- Default sharing presets for common scenarios
INSERT INTO workspace_sharing_presets (workspace_id, created_by, preset_name, preset_description, permissions) 
SELECT 
    w.id,
    w.owner_id,
    'Sales Team Standard',
    'Standard sharing for sales team - Unipile and BrightData for campaigns',
    '{
        "can_access_unipile": true,
        "can_access_brightdata": true,
        "can_access_apollo": false,
        "can_access_manual": false,
        "can_access_prospects": true,
        "can_access_companies": true,
        "can_use_in_campaigns": true,
        "can_export_data": false,
        "permission_level": "use_in_campaigns"
    }'::jsonb
FROM workspaces w
ON CONFLICT DO NOTHING;

-- Comments
COMMENT ON TABLE workspace_member_sharing_permissions IS 'Granular per-user sharing controls for team member data access';
COMMENT ON TABLE workspace_sharing_invitations IS 'Invitations for team members to access shared data';
COMMENT ON TABLE workspace_sharing_presets IS 'Quick presets for common sharing scenarios';
COMMENT ON FUNCTION invite_team_member_to_data_sharing IS 'Invites specific team member to access your data sources';
COMMENT ON FUNCTION respond_to_sharing_invitation IS 'Accept or decline data sharing invitations from team members';
COMMENT ON FUNCTION update_team_member_permissions IS 'Update permissions for individual team members access to your data';