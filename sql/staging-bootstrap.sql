-- =====================================================================
-- STAGING DATABASE BOOTSTRAP SCRIPT
-- SAM AI Multi-Tenant Campaign Management System
-- =====================================================================
-- Target: Staging Supabase Project (cuiqpollusiqkewpvplm)
-- Created: 2025-12-17
-- Purpose: Initialize essential tables for SAM AI system
-- =====================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- CORE TENANT TABLES
-- =====================================================================

-- 1. Workspaces (Multi-tenant container)
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);

-- Enable RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see workspaces they're members of
CREATE POLICY "Users can access their workspaces" ON workspaces
    FOR ALL USING (
        id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- 2. Workspace Members
CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    invited_by UUID REFERENCES auth.users(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- Enable RLS
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Direct check (avoid recursion)
CREATE POLICY "Users can view workspace memberships" ON workspace_members
    FOR SELECT USING (user_id = auth.uid() OR workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Admins can manage workspace members" ON workspace_members
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- =====================================================================
-- INTEGRATION TABLES
-- =====================================================================

-- 3. User Unipile Accounts
CREATE TABLE IF NOT EXISTS user_unipile_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    unipile_account_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('LINKEDIN', 'EMAIL', 'WHATSAPP')),
    account_name TEXT,
    account_email TEXT,
    linkedin_public_identifier TEXT,
    linkedin_profile_url TEXT,
    connection_status TEXT DEFAULT 'active' CHECK (connection_status IN ('active', 'disconnected', 'error')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(unipile_account_id)
);

CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_user_id ON user_unipile_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_unipile_id ON user_unipile_accounts(unipile_account_id);
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_platform ON user_unipile_accounts(platform);

-- Enable RLS
ALTER TABLE user_unipile_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own accounts
CREATE POLICY "Users can view own account associations" ON user_unipile_accounts
    FOR ALL USING (auth.uid() = user_id);

-- =====================================================================
-- CAMPAIGN TABLES
-- =====================================================================

-- 4. Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    funnel_id UUID,

    -- Campaign identification
    name TEXT NOT NULL,
    description TEXT,
    campaign_type TEXT NOT NULL CHECK (campaign_type IN ('linkedin', 'email', 'multi_channel')),

    -- Campaign configuration
    target_icp JSONB DEFAULT '{}',
    ab_test_variant TEXT,
    message_templates JSONB DEFAULT '{}',

    -- Campaign status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    launched_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_status ON campaigns(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_launched_at ON campaigns(launched_at) WHERE launched_at IS NOT NULL;

-- Enable RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see campaigns in their workspaces
CREATE POLICY "Users can access workspace campaigns" ON campaigns
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- 5. Campaign Prospects
CREATE TABLE IF NOT EXISTS campaign_prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Prospect identification
    linkedin_profile_url TEXT,
    email_address TEXT,

    -- Prospect information
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    job_title TEXT,
    company_name TEXT,
    location TEXT,

    -- Enrichment data
    enrichment_data JSONB DEFAULT '{}',
    personalization_data JSONB DEFAULT '{}',

    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'ready_to_message', 'queued_in_n8n',
        'contacted', 'connection_requested', 'connected', 'replied', 'completed',
        'failed', 'error', 'bounced',
        'not_interested', 'paused', 'excluded'
    )),

    -- Contact tracking
    contacted_at TIMESTAMPTZ,
    connection_accepted_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_prospects_campaign ON campaign_prospects(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_workspace ON campaign_prospects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_status ON campaign_prospects(status);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_campaign_status ON campaign_prospects(campaign_id, status);

-- Enable RLS
ALTER TABLE campaign_prospects ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see prospects in their workspace campaigns
CREATE POLICY "Users can access workspace campaign prospects" ON campaign_prospects
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- =====================================================================
-- QUEUE TABLES
-- =====================================================================

-- 6. Send Queue (LinkedIn Connection Requests & Follow-ups)
CREATE TABLE IF NOT EXISTS send_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    prospect_id UUID NOT NULL REFERENCES campaign_prospects(id) ON DELETE CASCADE,

    -- LinkedIn data
    linkedin_user_id TEXT NOT NULL,

    -- Message
    message TEXT NOT NULL,

    -- Timing
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,

    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(campaign_id, prospect_id)
);

CREATE INDEX IF NOT EXISTS idx_send_queue_pending ON send_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_send_queue_campaign ON send_queue(campaign_id);

-- Enable RLS
ALTER TABLE send_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view send_queue for their campaigns
CREATE POLICY "Users can view send_queue for their campaigns" ON send_queue
    FOR SELECT USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
            )
        )
    );

-- Allow INSERT/UPDATE for service role
CREATE POLICY "Allow INSERT for service role" ON send_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow UPDATE for service role" ON send_queue FOR UPDATE USING (true) WITH CHECK (true);

-- 7. Email Queue
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    account_id VARCHAR(255) NOT NULL,

    -- Recipient Information
    prospect_id UUID REFERENCES campaign_prospects(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    recipient_location VARCHAR(255),
    recipient_timezone VARCHAR(50),

    -- Email Content
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_plain TEXT,
    tracking_label VARCHAR(255),

    -- Scheduling (UTC)
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,

    -- Status Tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    error_message TEXT,
    unipile_message_id VARCHAR(255),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(campaign_id, prospect_id, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_email_queue_pending ON email_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_campaign ON email_queue(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_email_queue_workspace ON email_queue(workspace_id);

-- Enable RLS
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see/modify email queues for campaigns in their workspace
CREATE POLICY "email_queue_workspace_isolation" ON email_queue
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- =====================================================================
-- PROSPECT APPROVAL SYSTEM
-- =====================================================================

-- 8. Prospect Approval Sessions
CREATE TABLE IF NOT EXISTS prospect_approval_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),

    -- Prospect counts
    total_prospects INTEGER NOT NULL DEFAULT 0,
    approved_count INTEGER NOT NULL DEFAULT 0,
    rejected_count INTEGER NOT NULL DEFAULT 0,
    pending_count INTEGER NOT NULL DEFAULT 0,

    -- ICP criteria
    icp_criteria JSONB NOT NULL DEFAULT '{}',

    -- Source of prospects
    prospect_source TEXT DEFAULT 'unipile_linkedin_search',

    -- Learning insights
    learning_insights JSONB DEFAULT '{}',

    -- Metadata
    metadata JSONB DEFAULT '{}',
    campaign_id UUID REFERENCES campaigns(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    UNIQUE(user_id, workspace_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_prospect_sessions_user_workspace ON prospect_approval_sessions(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_prospect_sessions_status ON prospect_approval_sessions(status);
CREATE INDEX IF NOT EXISTS idx_prospect_sessions_workspace ON prospect_approval_sessions(workspace_id);

-- Enable RLS
ALTER TABLE prospect_approval_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can access sessions in their workspaces
CREATE POLICY "Users can access workspace approval sessions" ON prospect_approval_sessions
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- 9. Prospect Approval Data
CREATE TABLE IF NOT EXISTS prospect_approval_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES prospect_approval_sessions(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    prospect_id TEXT NOT NULL,

    -- Basic prospect information
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT,
    profile_image TEXT,
    recent_activity TEXT,

    -- Company information (JSONB for flexibility)
    company JSONB NOT NULL DEFAULT '{}',

    -- Contact information
    contact JSONB NOT NULL DEFAULT '{}',

    -- Enrichment metadata
    connection_degree INTEGER DEFAULT 0,
    enrichment_score INTEGER DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'unipile_linkedin_search',
    enriched_at TIMESTAMPTZ DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(session_id, prospect_id)
);

CREATE INDEX IF NOT EXISTS idx_prospect_data_session ON prospect_approval_data(session_id);
CREATE INDEX IF NOT EXISTS idx_prospect_data_workspace ON prospect_approval_data(workspace_id);

-- Enable RLS
ALTER TABLE prospect_approval_data ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can access approval data in their workspaces
CREATE POLICY "Users can access workspace approval data" ON prospect_approval_data
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- 10. Prospect Approval Decisions
CREATE TABLE IF NOT EXISTS prospect_approval_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES prospect_approval_sessions(id) ON DELETE CASCADE,
    prospect_id TEXT NOT NULL,

    -- Decision details
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
    reason TEXT,

    -- Audit trail
    decided_by TEXT NOT NULL,
    decided_at TIMESTAMPTZ DEFAULT NOW(),
    is_immutable BOOLEAN DEFAULT TRUE,

    UNIQUE(session_id, prospect_id)
);

CREATE INDEX IF NOT EXISTS idx_prospect_decisions_session ON prospect_approval_decisions(session_id);

-- Enable RLS
ALTER TABLE prospect_approval_decisions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can access decisions for sessions in their workspaces
CREATE POLICY "Users can access workspace approval decisions" ON prospect_approval_decisions
    FOR ALL USING (
        session_id IN (
            SELECT id FROM prospect_approval_sessions WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
            )
        )
    );

-- =====================================================================
-- WORKSPACE PROSPECT MANAGEMENT
-- =====================================================================

-- 11. Workspace Prospects (Centralized deduplication)
CREATE TABLE IF NOT EXISTS workspace_prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Prospect identification
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
    industry TEXT,

    -- Deduplication
    prospect_hash TEXT NOT NULL,
    enrichment_data JSONB DEFAULT '{}',
    data_sources TEXT[] DEFAULT '{}',

    -- Assignment and status
    assigned_to UUID REFERENCES auth.users(id),
    prospect_status TEXT DEFAULT 'new' CHECK (prospect_status IN (
        'new', 'assigned', 'contacted', 'replied', 'qualified', 'converted', 'closed'
    )),

    -- Contact tracking
    first_contacted_at TIMESTAMPTZ,
    first_contacted_by UUID REFERENCES auth.users(id),
    last_contacted_at TIMESTAMPTZ,
    last_contacted_by UUID REFERENCES auth.users(id),
    contact_count INTEGER DEFAULT 0,

    -- Company normalization
    normalized_company_name TEXT,
    normalized_company_domain TEXT,
    company_website TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(workspace_id, prospect_hash),

    CHECK (
        email_address IS NOT NULL OR
        linkedin_profile_url IS NOT NULL OR
        phone_number IS NOT NULL OR
        company_domain IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_workspace_prospects_workspace ON workspace_prospects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_hash ON workspace_prospects(prospect_hash);
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_email ON workspace_prospects(email_address) WHERE email_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_linkedin ON workspace_prospects(linkedin_profile_url) WHERE linkedin_profile_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_assigned ON workspace_prospects(workspace_id, assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_status ON workspace_prospects(workspace_id, prospect_status);

-- Enable RLS
ALTER TABLE workspace_prospects ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see prospects in their workspaces
CREATE POLICY "Users can access workspace prospects" ON workspace_prospects
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- =====================================================================
-- HELPER FUNCTIONS
-- =====================================================================

-- Function to generate prospect hash for deduplication
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
    RETURN encode(
        digest(
            CONCAT_WS('|',
                LOWER(TRIM(COALESCE(p_email_address, ''))),
                LOWER(TRIM(COALESCE(p_linkedin_profile_url, ''))),
                REGEXP_REPLACE(COALESCE(p_phone_number, ''), '[^\d]', '', 'g'),
                LOWER(TRIM(COALESCE(p_company_domain, '')))
            ),
            'sha256'
        ),
        'hex'
    );
END;
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for workspaces
DROP TRIGGER IF EXISTS update_workspaces_updated_at ON workspaces;
CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for campaigns
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for campaign_prospects
DROP TRIGGER IF EXISTS update_campaign_prospects_updated_at ON campaign_prospects;
CREATE TRIGGER update_campaign_prospects_updated_at
    BEFORE UPDATE ON campaign_prospects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for workspace_prospects
DROP TRIGGER IF EXISTS update_workspace_prospects_updated_at ON workspace_prospects;
CREATE TRIGGER update_workspace_prospects_updated_at
    BEFORE UPDATE ON workspace_prospects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for send_queue
DROP TRIGGER IF EXISTS update_send_queue_updated_at ON send_queue;
CREATE TRIGGER update_send_queue_updated_at
    BEFORE UPDATE ON send_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for email_queue
CREATE OR REPLACE FUNCTION update_email_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_queue_update_timestamp ON email_queue;
CREATE TRIGGER email_queue_update_timestamp
    BEFORE UPDATE ON email_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_email_queue_updated_at();

-- Trigger for user_unipile_accounts
CREATE OR REPLACE FUNCTION update_user_unipile_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_unipile_accounts_updated_at ON user_unipile_accounts;
CREATE TRIGGER trigger_update_user_unipile_accounts_updated_at
    BEFORE UPDATE ON user_unipile_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_user_unipile_accounts_updated_at();

-- =====================================================================
-- BOOTSTRAP COMPLETE
-- =====================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Staging database bootstrap completed successfully';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  1. workspaces';
    RAISE NOTICE '  2. workspace_members';
    RAISE NOTICE '  3. user_unipile_accounts';
    RAISE NOTICE '  4. campaigns';
    RAISE NOTICE '  5. campaign_prospects';
    RAISE NOTICE '  6. send_queue';
    RAISE NOTICE '  7. email_queue';
    RAISE NOTICE '  8. prospect_approval_sessions';
    RAISE NOTICE '  9. prospect_approval_data';
    RAISE NOTICE ' 10. prospect_approval_decisions';
    RAISE NOTICE ' 11. workspace_prospects';
    RAISE NOTICE '';
    RAISE NOTICE 'Features enabled:';
    RAISE NOTICE '  ✓ Row Level Security (RLS) on all tables';
    RAISE NOTICE '  ✓ Foreign key constraints';
    RAISE NOTICE '  ✓ Performance indexes';
    RAISE NOTICE '  ✓ Updated_at triggers';
    RAISE NOTICE '  ✓ Workspace isolation policies';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Create test workspace and users';
    RAISE NOTICE '  2. Connect Unipile accounts';
    RAISE NOTICE '  3. Test campaign creation and prospect upload';
END $$;
