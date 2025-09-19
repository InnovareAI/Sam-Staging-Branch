-- SAM AI System Override Authentication
-- Allows authorized InnovareAI workspace users to bypass onboarding with #OverrideCode

-- Admin users table for system override access
CREATE TABLE IF NOT EXISTS sam_admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Optional link to actual user
    
    -- Authentication credentials  
    email TEXT NOT NULL,
    pin_hash TEXT NOT NULL, -- SHA256 hash of PIN
    password_hash TEXT NOT NULL, -- SHA256 hash of password
    
    -- Access control
    full_access BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    notes TEXT, -- Admin notes about this override user
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique email per workspace
    UNIQUE(workspace_id, email)
);

-- Override session logs for audit trail
CREATE TABLE IF NOT EXISTS sam_override_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES sam_admin_users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Session details
    session_start TIMESTAMPTZ DEFAULT NOW(),
    session_end TIMESTAMPTZ,
    commands_executed INTEGER DEFAULT 0,
    
    -- Request metadata
    ip_address INET,
    user_agent TEXT,
    
    -- Session data
    session_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Override command logs for detailed audit
CREATE TABLE IF NOT EXISTS sam_override_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sam_override_sessions(id) ON DELETE CASCADE,
    admin_user_id UUID NOT NULL REFERENCES sam_admin_users(id) ON DELETE CASCADE,
    
    -- Command details
    command_type TEXT NOT NULL, -- 'research', 'search', 'analysis', etc.
    command_text TEXT NOT NULL,
    command_params JSONB DEFAULT '{}',
    
    -- Execution details
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    execution_time_ms INTEGER,
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout')),
    
    -- Results
    result_summary TEXT,
    result_data JSONB DEFAULT '{}',
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sam_admin_users_workspace ON sam_admin_users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sam_admin_users_email ON sam_admin_users(email) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sam_admin_users_active ON sam_admin_users(is_active, workspace_id);

CREATE INDEX IF NOT EXISTS idx_sam_override_sessions_admin ON sam_override_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_sam_override_sessions_workspace ON sam_override_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sam_override_sessions_date ON sam_override_sessions(session_start);

CREATE INDEX IF NOT EXISTS idx_sam_override_commands_session ON sam_override_commands(session_id);
CREATE INDEX IF NOT EXISTS idx_sam_override_commands_admin ON sam_override_commands(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_sam_override_commands_type ON sam_override_commands(command_type);

-- Enable RLS
ALTER TABLE sam_admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_override_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_override_commands ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Workspace admins can manage override users" ON sam_admin_users
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = 
            (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Admin users can view their own sessions" ON sam_override_sessions
    FOR SELECT USING (
        admin_user_id IN (
            SELECT id FROM sam_admin_users WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members WHERE user_id = 
                (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
            )
        )
    );

CREATE POLICY "System can insert override sessions" ON sam_override_sessions
    FOR INSERT WITH CHECK (true); -- Allow system inserts

CREATE POLICY "Admin users can view their commands" ON sam_override_commands
    FOR SELECT USING (
        admin_user_id IN (
            SELECT id FROM sam_admin_users WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members WHERE user_id = 
                (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
            )
        )
    );

CREATE POLICY "System can insert override commands" ON sam_override_commands
    FOR INSERT WITH CHECK (true); -- Allow system inserts

-- Functions for override system

-- Function to create default InnovareAI admin user
CREATE OR REPLACE FUNCTION create_innovareai_admin_user()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_workspace_id UUID;
    v_admin_user_id UUID;
    v_salt TEXT;
BEGIN
    -- Get InnovareAI workspace ID
    SELECT id INTO v_workspace_id 
    FROM workspaces 
    WHERE name ILIKE '%InnovareAI%' OR name ILIKE '%Innovare%'
    LIMIT 1;
    
    IF v_workspace_id IS NULL THEN
        -- Create InnovareAI workspace if it doesn't exist
        INSERT INTO workspaces (name, domain, description)
        VALUES (
            'InnovareAI',
            'innovareai.com',
            'InnovareAI core workspace for system administration'
        )
        RETURNING id INTO v_workspace_id;
    END IF;
    
    -- Set up environment salt (in production, this should be from ENV)
    v_salt := COALESCE(current_setting('app.override_salt', true), 'innovareai_override_2024');
    
    -- Create admin user with custom credentials
    -- PIN: Will be set by user (4 digits), Password: InnovareAI!2025#
    INSERT INTO sam_admin_users (
        workspace_id,
        email,
        pin_hash,
        password_hash,
        full_access,
        is_active,
        notes
    ) VALUES (
        v_workspace_id,
        'admin@innovareai.com',
        encode(sha256(('0000' || v_salt)::bytea), 'hex'), -- Placeholder PIN - user will set actual PIN
        encode(sha256(('InnovareAI!2025#' || v_salt)::bytea), 'hex'),
        true,
        true,
        'InnovareAI admin user - PIN must be set by user'
    )
    ON CONFLICT (workspace_id, email) DO UPDATE SET
        updated_at = NOW(),
        is_active = true
    RETURNING id INTO v_admin_user_id;
    
    RETURN v_admin_user_id;
END;
$$;

-- Function to validate override credentials
CREATE OR REPLACE FUNCTION validate_sam_override_credentials(
    p_email TEXT,
    p_pin TEXT,
    p_password TEXT
)
RETURNS TABLE(
    is_valid BOOLEAN,
    admin_user_id UUID,
    workspace_id UUID,
    full_access BOOLEAN,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_user RECORD;
    v_salt TEXT;
    v_pin_hash TEXT;
    v_password_hash TEXT;
BEGIN
    -- Get salt from environment
    v_salt := COALESCE(current_setting('app.override_salt', true), 'innovareai_override_2024');
    
    -- Calculate hashes
    v_pin_hash := encode(sha256((p_pin || v_salt)::bytea), 'hex');
    v_password_hash := encode(sha256((p_password || v_salt)::bytea), 'hex');
    
    -- Find matching admin user
    SELECT * INTO v_admin_user
    FROM sam_admin_users
    WHERE email = lower(p_email)
      AND pin_hash = v_pin_hash
      AND password_hash = v_password_hash
      AND is_active = true;
    
    IF v_admin_user IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, false, 'Invalid credentials'::TEXT;
        RETURN;
    END IF;
    
    -- Update last used
    UPDATE sam_admin_users 
    SET 
        last_used = NOW(),
        usage_count = usage_count + 1
    WHERE id = v_admin_user.id;
    
    -- Return success
    RETURN QUERY SELECT 
        true, 
        v_admin_user.id, 
        v_admin_user.workspace_id, 
        v_admin_user.full_access,
        NULL::TEXT;
END;
$$;

-- Function to log override session
CREATE OR REPLACE FUNCTION log_sam_override_session(
    p_admin_user_id UUID,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
    v_workspace_id UUID;
BEGIN
    -- Get workspace ID
    SELECT workspace_id INTO v_workspace_id
    FROM sam_admin_users
    WHERE id = p_admin_user_id;
    
    -- Create session log
    INSERT INTO sam_override_sessions (
        admin_user_id,
        workspace_id,
        ip_address,
        user_agent
    ) VALUES (
        p_admin_user_id,
        v_workspace_id,
        p_ip_address,
        p_user_agent
    )
    RETURNING id INTO v_session_id;
    
    RETURN v_session_id;
END;
$$;

-- Function to log override command
CREATE OR REPLACE FUNCTION log_sam_override_command(
    p_session_id UUID,
    p_command_type TEXT,
    p_command_text TEXT,
    p_status TEXT DEFAULT 'success',
    p_execution_time_ms INTEGER DEFAULT NULL,
    p_result_summary TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_command_id UUID;
    v_admin_user_id UUID;
BEGIN
    -- Get admin user ID from session
    SELECT admin_user_id INTO v_admin_user_id
    FROM sam_override_sessions
    WHERE id = p_session_id;
    
    -- Log command
    INSERT INTO sam_override_commands (
        session_id,
        admin_user_id,
        command_type,
        command_text,
        execution_time_ms,
        status,
        result_summary,
        error_message
    ) VALUES (
        p_session_id,
        v_admin_user_id,
        p_command_type,
        p_command_text,
        p_execution_time_ms,
        p_status,
        p_result_summary,
        p_error_message
    )
    RETURNING id INTO v_command_id;
    
    -- Update session command count
    UPDATE sam_override_sessions
    SET commands_executed = commands_executed + 1
    WHERE id = p_session_id;
    
    RETURN v_command_id;
END;
$$;

-- Create default InnovareAI admin user
SELECT create_innovareai_admin_user();

-- Comments
COMMENT ON TABLE sam_admin_users IS 'Authorized users who can use #OverrideCode to bypass SAM onboarding';
COMMENT ON TABLE sam_override_sessions IS 'Audit log of all override sessions for security tracking';
COMMENT ON TABLE sam_override_commands IS 'Detailed log of commands executed during override sessions';
COMMENT ON FUNCTION validate_sam_override_credentials IS 'Validates override credentials and returns admin user info';
COMMENT ON FUNCTION log_sam_override_session IS 'Creates new override session for audit tracking';
COMMENT ON FUNCTION log_sam_override_command IS 'Logs individual commands executed during override session';