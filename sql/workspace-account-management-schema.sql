-- Workspace Account Management & Prospect Deduplication Schema
-- Enables team collaboration with individual accounts while preventing duplicate prospect outreach

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Workspace accounts - Individual user accounts within team workspaces
CREATE TABLE IF NOT EXISTS workspace_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Account identification
    account_type TEXT NOT NULL CHECK (account_type IN ('linkedin', 'email', 'whatsapp', 'instagram')),
    account_identifier TEXT NOT NULL, -- Email address, LinkedIn profile URL, etc.
    account_name TEXT, -- Display name for the account
    
    -- Account connection details
    unipile_account_id TEXT, -- Connection to Unipile
    connection_status TEXT DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'error', 'suspended')),
    connection_details JSONB DEFAULT '{}', -- Platform-specific connection info
    
    -- Usage tracking
    daily_message_count INTEGER DEFAULT 0,
    daily_message_limit INTEGER DEFAULT 50, -- Per-account daily limit
    monthly_message_count INTEGER DEFAULT 0,
    last_message_sent_at TIMESTAMPTZ,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    
    -- Account status
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false, -- One primary account per type per user
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(workspace_id, user_id, account_type, account_identifier),
    UNIQUE(workspace_id, user_id, account_type, is_primary) WHERE is_primary = true
);

-- 2. Workspace prospects - Centralized prospect tracking at workspace level
CREATE TABLE IF NOT EXISTS workspace_prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Prospect identification (multiple identifiers for deduplication)
    email_address TEXT,
    linkedin_profile_url TEXT,
    phone_number TEXT,
    company_domain TEXT,
    
    -- Prospect information
    full_name TEXT,
    first_name TEXT,
    last_name TEXT,
    job_title TEXT,
    company_name TEXT,
    location TEXT,
    
    -- Deduplication and enrichment
    prospect_hash TEXT NOT NULL, -- Hash of key identifiers for fast deduplication
    enrichment_data JSONB DEFAULT '{}',
    data_sources TEXT[] DEFAULT '{}', -- Sources where this prospect was found
    
    -- Assignment and status
    assigned_to UUID REFERENCES auth.users(id), -- Which team member owns this prospect
    prospect_status TEXT DEFAULT 'new' CHECK (prospect_status IN ('new', 'assigned', 'contacted', 'replied', 'qualified', 'converted', 'closed')),
    
    -- Contact tracking
    first_contacted_at TIMESTAMPTZ,
    first_contacted_by UUID REFERENCES auth.users(id),
    last_contacted_at TIMESTAMPTZ,
    last_contacted_by UUID REFERENCES auth.users(id),
    contact_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints for deduplication
    UNIQUE(workspace_id, prospect_hash),
    
    -- At least one identifier must be provided
    CHECK (
        email_address IS NOT NULL OR 
        linkedin_profile_url IS NOT NULL OR 
        phone_number IS NOT NULL OR 
        company_domain IS NOT NULL
    )
);

-- 3. Prospect contact history - Track all contact attempts across team
CREATE TABLE IF NOT EXISTS prospect_contact_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    prospect_id UUID NOT NULL REFERENCES workspace_prospects(id) ON DELETE CASCADE,
    
    -- Contact details
    contacted_by UUID NOT NULL REFERENCES auth.users(id),
    account_used UUID NOT NULL REFERENCES workspace_accounts(id),
    contact_method TEXT NOT NULL, -- 'linkedin_message', 'email', 'connection_request', etc.
    
    -- Message details
    campaign_id UUID, -- References campaigns table if part of campaign
    message_content TEXT,
    subject_line TEXT,
    template_used TEXT,
    
    -- Platform tracking
    platform_message_id TEXT, -- Unipile message ID
    conversation_id TEXT, -- For reply tracking
    
    -- Contact outcome
    delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read', 'bounced', 'failed')),
    response_received BOOLEAN DEFAULT false,
    response_at TIMESTAMPTZ,
    response_content TEXT,
    
    -- Metadata
    contacted_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Index for fast lookups
    UNIQUE(platform_message_id, contacted_by) WHERE platform_message_id IS NOT NULL
);

-- 4. Workspace account switching sessions - Track which account user is currently using
CREATE TABLE IF NOT EXISTS workspace_account_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Current account selection
    current_linkedin_account UUID REFERENCES workspace_accounts(id),
    current_email_account UUID REFERENCES workspace_accounts(id),
    current_whatsapp_account UUID REFERENCES workspace_accounts(id),
    
    -- Session tracking
    last_switched_at TIMESTAMPTZ DEFAULT NOW(),
    session_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- One active session per user per workspace
    UNIQUE(workspace_id, user_id)
);

-- 5. Prospect assignment rules - Automatic assignment logic for workspaces
CREATE TABLE IF NOT EXISTS prospect_assignment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Rule configuration
    rule_name TEXT NOT NULL,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('round_robin', 'load_balance', 'territory', 'manual')),
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Higher priority rules apply first
    
    -- Assignment logic
    assignment_criteria JSONB DEFAULT '{}', -- JSON rules for automatic assignment
    eligible_users UUID[] DEFAULT '{}', -- Which users can be assigned prospects
    
    -- Territory-based rules
    territories JSONB DEFAULT '{}', -- Geographic or company-based territories
    
    -- Load balancing
    max_prospects_per_user INTEGER DEFAULT 100,
    rebalance_frequency TEXT DEFAULT 'daily' CHECK (rebalance_frequency IN ('hourly', 'daily', 'weekly')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_workspace_user ON workspace_accounts(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_type_active ON workspace_accounts(account_type, is_active);
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_unipile ON workspace_accounts(unipile_account_id) WHERE unipile_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_prospects_workspace ON workspace_prospects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_hash ON workspace_prospects(prospect_hash);
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_email ON workspace_prospects(email_address) WHERE email_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_linkedin ON workspace_prospects(linkedin_profile_url) WHERE linkedin_profile_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_assigned ON workspace_prospects(workspace_id, assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_status ON workspace_prospects(workspace_id, prospect_status);

CREATE INDEX IF NOT EXISTS idx_prospect_contact_history_prospect ON prospect_contact_history(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_contact_history_workspace_date ON prospect_contact_history(workspace_id, contacted_at);
CREATE INDEX IF NOT EXISTS idx_prospect_contact_history_user ON prospect_contact_history(contacted_by, contacted_at);

CREATE INDEX IF NOT EXISTS idx_workspace_account_sessions_user ON workspace_account_sessions(workspace_id, user_id);

-- Enable Row Level Security
ALTER TABLE workspace_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_contact_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_account_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_assignment_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Workspace accounts: Users can manage accounts in their workspaces
CREATE POLICY "Users can manage workspace accounts" ON workspace_accounts
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- Workspace prospects: Users can see prospects in their workspaces
CREATE POLICY "Users can access workspace prospects" ON workspace_prospects
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- Prospect contact history: Users can see contact history in their workspaces
CREATE POLICY "Users can access prospect contact history" ON prospect_contact_history
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- Account sessions: Users can manage their own sessions
CREATE POLICY "Users can manage own account sessions" ON workspace_account_sessions
    FOR ALL USING (user_id = auth.uid());

-- Assignment rules: Users can see rules in their workspaces
CREATE POLICY "Users can access workspace assignment rules" ON prospect_assignment_rules
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- Functions for workspace account management

-- Function to create prospect hash for deduplication
CREATE OR REPLACE FUNCTION generate_prospect_hash(
    p_email_address TEXT DEFAULT NULL,
    p_linkedin_profile_url TEXT DEFAULT NULL,
    p_phone_number TEXT DEFAULT NULL,
    p_company_domain TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Create a hash from normalized identifiers
    RETURN encode(
        digest(
            CONCAT_WS('|',
                LOWER(TRIM(COALESCE(p_email_address, ''))),
                LOWER(TRIM(COALESCE(p_linkedin_profile_url, ''))),
                REGEXP_REPLACE(COALESCE(p_phone_number, ''), '[^\d]', '', 'g'), -- Numbers only
                LOWER(TRIM(COALESCE(p_company_domain, '')))
            ),
            'sha256'
        ),
        'hex'
    );
END;
$$;

-- Function to add or get existing prospect (deduplication)
CREATE OR REPLACE FUNCTION add_or_get_workspace_prospect(
    p_workspace_id UUID,
    p_email_address TEXT DEFAULT NULL,
    p_linkedin_profile_url TEXT DEFAULT NULL,
    p_phone_number TEXT DEFAULT NULL,
    p_company_domain TEXT DEFAULT NULL,
    p_full_name TEXT DEFAULT NULL,
    p_first_name TEXT DEFAULT NULL,
    p_last_name TEXT DEFAULT NULL,
    p_job_title TEXT DEFAULT NULL,
    p_company_name TEXT DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_data_source TEXT DEFAULT 'manual'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prospect_hash TEXT;
    v_prospect_id UUID;
    v_existing_prospect_id UUID;
BEGIN
    -- Generate hash for deduplication
    v_prospect_hash := generate_prospect_hash(
        p_email_address, p_linkedin_profile_url, p_phone_number, p_company_domain
    );
    
    -- Check if prospect already exists
    SELECT id INTO v_existing_prospect_id
    FROM workspace_prospects 
    WHERE workspace_id = p_workspace_id 
      AND prospect_hash = v_prospect_hash;
    
    IF v_existing_prospect_id IS NOT NULL THEN
        -- Update existing prospect with any new information
        UPDATE workspace_prospects 
        SET 
            email_address = COALESCE(p_email_address, email_address),
            linkedin_profile_url = COALESCE(p_linkedin_profile_url, linkedin_profile_url),
            phone_number = COALESCE(p_phone_number, phone_number),
            company_domain = COALESCE(p_company_domain, company_domain),
            full_name = COALESCE(p_full_name, full_name),
            first_name = COALESCE(p_first_name, first_name),
            last_name = COALESCE(p_last_name, last_name),
            job_title = COALESCE(p_job_title, job_title),
            company_name = COALESCE(p_company_name, company_name),
            location = COALESCE(p_location, location),
            data_sources = array_append(data_sources, p_data_source),
            updated_at = NOW()
        WHERE id = v_existing_prospect_id;
        
        RETURN v_existing_prospect_id;
    ELSE
        -- Create new prospect
        INSERT INTO workspace_prospects (
            workspace_id, email_address, linkedin_profile_url, phone_number, 
            company_domain, full_name, first_name, last_name, job_title, 
            company_name, location, prospect_hash, data_sources
        ) VALUES (
            p_workspace_id, p_email_address, p_linkedin_profile_url, p_phone_number,
            p_company_domain, p_full_name, p_first_name, p_last_name, p_job_title,
            p_company_name, p_location, v_prospect_hash, ARRAY[p_data_source]
        ) RETURNING id INTO v_prospect_id;
        
        RETURN v_prospect_id;
    END IF;
END;
$$;

-- Function to check if prospect can be contacted (deduplication prevention)
CREATE OR REPLACE FUNCTION can_contact_prospect(
    p_workspace_id UUID,
    p_prospect_id UUID,
    p_user_id UUID,
    p_contact_method TEXT DEFAULT 'any'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prospect_record workspace_prospects%ROWTYPE;
    v_last_contact_date TIMESTAMPTZ;
    v_contact_count INTEGER;
    v_different_users INTEGER;
    v_cooldown_hours INTEGER := 72; -- 3 days cooldown between contacts
    v_max_contacts INTEGER := 3; -- Max contacts before marking as exhausted
BEGIN
    -- Get prospect details
    SELECT * INTO v_prospect_record
    FROM workspace_prospects 
    WHERE id = p_prospect_id AND workspace_id = p_workspace_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'can_contact', false,
            'reason', 'prospect_not_found'
        );
    END IF;
    
    -- Check recent contact history
    SELECT 
        MAX(contacted_at),
        COUNT(*),
        COUNT(DISTINCT contacted_by)
    INTO v_last_contact_date, v_contact_count, v_different_users
    FROM prospect_contact_history 
    WHERE prospect_id = p_prospect_id
      AND (p_contact_method = 'any' OR contact_method = p_contact_method);
    
    -- Check if prospect is already assigned to someone else
    IF v_prospect_record.assigned_to IS NOT NULL AND v_prospect_record.assigned_to != p_user_id THEN
        RETURN jsonb_build_object(
            'can_contact', false,
            'reason', 'assigned_to_other_user',
            'assigned_to', v_prospect_record.assigned_to
        );
    END IF;
    
    -- Check cooldown period
    IF v_last_contact_date IS NOT NULL AND 
       v_last_contact_date > (NOW() - INTERVAL '1 hour' * v_cooldown_hours) THEN
        RETURN jsonb_build_object(
            'can_contact', false,
            'reason', 'cooldown_period',
            'last_contacted_at', v_last_contact_date,
            'cooldown_expires_at', v_last_contact_date + INTERVAL '1 hour' * v_cooldown_hours
        );
    END IF;
    
    -- Check maximum contact attempts
    IF v_contact_count >= v_max_contacts THEN
        RETURN jsonb_build_object(
            'can_contact', false,
            'reason', 'max_contacts_reached',
            'contact_count', v_contact_count,
            'max_contacts', v_max_contacts
        );
    END IF;
    
    -- Check if prospect has replied (and thus should not be contacted again)
    IF EXISTS (
        SELECT 1 FROM prospect_contact_history 
        WHERE prospect_id = p_prospect_id AND response_received = true
    ) THEN
        RETURN jsonb_build_object(
            'can_contact', false,
            'reason', 'prospect_has_replied'
        );
    END IF;
    
    -- All checks passed
    RETURN jsonb_build_object(
        'can_contact', true,
        'reason', 'eligible',
        'contact_count', COALESCE(v_contact_count, 0),
        'last_contacted_at', v_last_contact_date
    );
END;
$$;

-- Function to record prospect contact
CREATE OR REPLACE FUNCTION record_prospect_contact(
    p_workspace_id UUID,
    p_prospect_id UUID,
    p_contacted_by UUID,
    p_account_used UUID,
    p_contact_method TEXT,
    p_message_content TEXT DEFAULT NULL,
    p_subject_line TEXT DEFAULT NULL,
    p_campaign_id UUID DEFAULT NULL,
    p_platform_message_id TEXT DEFAULT NULL,
    p_conversation_id TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_contact_id UUID;
BEGIN
    -- Record the contact
    INSERT INTO prospect_contact_history (
        workspace_id, prospect_id, contacted_by, account_used, contact_method,
        message_content, subject_line, campaign_id, platform_message_id, conversation_id
    ) VALUES (
        p_workspace_id, p_prospect_id, p_contacted_by, p_account_used, p_contact_method,
        p_message_content, p_subject_line, p_campaign_id, p_platform_message_id, p_conversation_id
    ) RETURNING id INTO v_contact_id;
    
    -- Update prospect status
    UPDATE workspace_prospects 
    SET 
        first_contacted_at = COALESCE(first_contacted_at, NOW()),
        first_contacted_by = COALESCE(first_contacted_by, p_contacted_by),
        last_contacted_at = NOW(),
        last_contacted_by = p_contacted_by,
        contact_count = contact_count + 1,
        prospect_status = CASE 
            WHEN prospect_status = 'new' THEN 'contacted'
            ELSE prospect_status
        END,
        assigned_to = COALESCE(assigned_to, p_contacted_by),
        updated_at = NOW()
    WHERE id = p_prospect_id;
    
    RETURN v_contact_id;
END;
$$;

-- Function to switch workspace account
CREATE OR REPLACE FUNCTION switch_workspace_account(
    p_workspace_id UUID,
    p_user_id UUID,
    p_account_type TEXT,
    p_account_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account_exists BOOLEAN;
BEGIN
    -- Verify account exists and belongs to user
    SELECT EXISTS(
        SELECT 1 FROM workspace_accounts 
        WHERE id = p_account_id 
          AND workspace_id = p_workspace_id 
          AND user_id = p_user_id 
          AND account_type = p_account_type
          AND is_active = true
    ) INTO v_account_exists;
    
    IF NOT v_account_exists THEN
        RETURN false;
    END IF;
    
    -- Update or create session
    INSERT INTO workspace_account_sessions (
        workspace_id, user_id,
        current_linkedin_account,
        current_email_account,
        current_whatsapp_account
    ) VALUES (
        p_workspace_id, p_user_id,
        CASE WHEN p_account_type = 'linkedin' THEN p_account_id ELSE NULL END,
        CASE WHEN p_account_type = 'email' THEN p_account_id ELSE NULL END,
        CASE WHEN p_account_type = 'whatsapp' THEN p_account_id ELSE NULL END
    )
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET
        current_linkedin_account = CASE 
            WHEN p_account_type = 'linkedin' THEN p_account_id 
            ELSE current_linkedin_account 
        END,
        current_email_account = CASE 
            WHEN p_account_type = 'email' THEN p_account_id 
            ELSE current_email_account 
        END,
        current_whatsapp_account = CASE 
            WHEN p_account_type = 'whatsapp' THEN p_account_id 
            ELSE current_whatsapp_account 
        END,
        last_switched_at = NOW(),
        session_expires_at = NOW() + INTERVAL '24 hours',
        updated_at = NOW();
    
    RETURN true;
END;
$$;

-- Views for easy querying

-- Active workspace accounts per user
CREATE OR REPLACE VIEW user_workspace_accounts AS
SELECT 
    wa.id,
    wa.workspace_id,
    wa.user_id,
    u.email as user_email,
    wa.account_type,
    wa.account_identifier,
    wa.account_name,
    wa.connection_status,
    wa.is_primary,
    wa.daily_message_count,
    wa.daily_message_limit,
    (wa.daily_message_count::float / wa.daily_message_limit) as usage_percentage,
    wa.last_message_sent_at,
    CASE 
        WHEN was.current_linkedin_account = wa.id AND wa.account_type = 'linkedin' THEN true
        WHEN was.current_email_account = wa.id AND wa.account_type = 'email' THEN true
        WHEN was.current_whatsapp_account = wa.id AND wa.account_type = 'whatsapp' THEN true
        ELSE false
    END as is_currently_selected
FROM workspace_accounts wa
JOIN auth.users u ON wa.user_id = u.id
LEFT JOIN workspace_account_sessions was ON wa.workspace_id = was.workspace_id AND wa.user_id = was.user_id
WHERE wa.is_active = true;

-- Workspace prospect contact summary
CREATE OR REPLACE VIEW workspace_prospect_summary AS
SELECT 
    wp.id,
    wp.workspace_id,
    wp.full_name,
    wp.company_name,
    wp.prospect_status,
    wp.assigned_to,
    au.email as assigned_to_email,
    wp.contact_count,
    wp.last_contacted_at,
    wp.last_contacted_by,
    lcu.email as last_contacted_by_email,
    COUNT(DISTINCT pch.contacted_by) as contacted_by_users_count,
    MAX(pch.contacted_at) as most_recent_contact,
    BOOL_OR(pch.response_received) as has_response
FROM workspace_prospects wp
LEFT JOIN auth.users au ON wp.assigned_to = au.id
LEFT JOIN auth.users lcu ON wp.last_contacted_by = lcu.id
LEFT JOIN prospect_contact_history pch ON wp.id = pch.prospect_id
GROUP BY wp.id, wp.workspace_id, wp.full_name, wp.company_name, wp.prospect_status, 
         wp.assigned_to, au.email, wp.contact_count, wp.last_contacted_at, 
         wp.last_contacted_by, lcu.email;

COMMENT ON TABLE workspace_accounts IS 'Individual user accounts within team workspaces for multi-platform outreach';
COMMENT ON TABLE workspace_prospects IS 'Centralized prospect tracking with deduplication to prevent duplicate messaging';
COMMENT ON TABLE prospect_contact_history IS 'Complete audit trail of all prospect contacts across team members';
COMMENT ON TABLE workspace_account_sessions IS 'Current account selections for each user in each workspace';

COMMENT ON COLUMN workspace_prospects.prospect_hash IS 'SHA256 hash of key identifiers for fast deduplication';
COMMENT ON COLUMN workspace_prospects.assigned_to IS 'Team member responsible for this prospect';
COMMENT ON FUNCTION can_contact_prospect IS 'Checks if prospect can be contacted, preventing duplicates and spam';
COMMENT ON FUNCTION record_prospect_contact IS 'Records contact attempt and updates prospect status';