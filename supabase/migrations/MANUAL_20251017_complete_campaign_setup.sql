-- ============================================================================
-- COMPLETE CAMPAIGN ANALYTICS SETUP
-- This migration creates all necessary tables and fixes for campaign analytics
-- Safe to run multiple times (idempotent)
-- ============================================================================

-- ============================================================================
-- STEP 1: Ensure base campaign tracking tables exist
-- ============================================================================

-- Create campaign_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS campaign_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    -- Message identification
    platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'email', 'whatsapp', 'instagram')),
    platform_message_id TEXT NOT NULL,
    conversation_id TEXT,
    thread_id TEXT,

    -- Recipient information
    recipient_email TEXT,
    recipient_linkedin_profile TEXT,
    recipient_name TEXT,
    prospect_id UUID,

    -- Message content
    subject_line TEXT,
    message_content TEXT NOT NULL,
    message_template_variant TEXT,

    -- Sending details
    sent_at TIMESTAMPTZ NOT NULL,
    sent_via TEXT,
    sender_account TEXT,

    -- Reply tracking
    expects_reply BOOLEAN DEFAULT true,
    reply_received_at TIMESTAMPTZ,
    reply_count INTEGER DEFAULT 0,
    last_reply_at TIMESTAMPTZ,

    -- Status
    delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read', 'bounced', 'failed')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(platform, platform_message_id)
);

-- Add missing columns to campaign_messages if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'conversation_id') THEN
        ALTER TABLE campaign_messages ADD COLUMN conversation_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'thread_id') THEN
        ALTER TABLE campaign_messages ADD COLUMN thread_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'prospect_id') THEN
        ALTER TABLE campaign_messages ADD COLUMN prospect_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'subject_line') THEN
        ALTER TABLE campaign_messages ADD COLUMN subject_line TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'message_template_variant') THEN
        ALTER TABLE campaign_messages ADD COLUMN message_template_variant TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'sent_via') THEN
        ALTER TABLE campaign_messages ADD COLUMN sent_via TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'sender_account') THEN
        ALTER TABLE campaign_messages ADD COLUMN sender_account TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'expects_reply') THEN
        ALTER TABLE campaign_messages ADD COLUMN expects_reply BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'reply_received_at') THEN
        ALTER TABLE campaign_messages ADD COLUMN reply_received_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'reply_count') THEN
        ALTER TABLE campaign_messages ADD COLUMN reply_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'last_reply_at') THEN
        ALTER TABLE campaign_messages ADD COLUMN last_reply_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'delivery_status') THEN
        ALTER TABLE campaign_messages ADD COLUMN delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read', 'bounced', 'failed'));
    END IF;
END $$;

-- Create campaign_replies table if it doesn't exist
CREATE TABLE IF NOT EXISTS campaign_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL,
    workspace_id UUID NOT NULL,

    -- Reply identification
    platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'email', 'whatsapp', 'instagram')),
    platform_reply_id TEXT NOT NULL,
    conversation_id TEXT,

    -- Reply content
    reply_content TEXT NOT NULL,

    -- Sender information
    sender_email TEXT,
    sender_name TEXT,

    -- Reply classification
    reply_sentiment TEXT CHECK (reply_sentiment IN ('positive', 'neutral', 'negative', 'interested', 'not_interested')),
    requires_action BOOLEAN DEFAULT true,

    -- Timing
    received_at TIMESTAMPTZ NOT NULL,

    -- Processing status
    is_processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(platform, platform_reply_id)
);

-- Add missing columns to campaign_replies if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_replies' AND column_name = 'campaign_message_id') THEN
        ALTER TABLE campaign_replies ADD COLUMN campaign_message_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_replies' AND column_name = 'conversation_id') THEN
        ALTER TABLE campaign_replies ADD COLUMN conversation_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_replies' AND column_name = 'thread_id') THEN
        ALTER TABLE campaign_replies ADD COLUMN thread_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_replies' AND column_name = 'reply_type') THEN
        ALTER TABLE campaign_replies ADD COLUMN reply_type TEXT DEFAULT 'text' CHECK (reply_type IN ('text', 'attachment', 'emoji', 'link'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_replies' AND column_name = 'has_attachments') THEN
        ALTER TABLE campaign_replies ADD COLUMN has_attachments BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_replies' AND column_name = 'sender_linkedin_profile') THEN
        ALTER TABLE campaign_replies ADD COLUMN sender_linkedin_profile TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_replies' AND column_name = 'reply_sentiment') THEN
        ALTER TABLE campaign_replies ADD COLUMN reply_sentiment TEXT CHECK (reply_sentiment IN ('positive', 'neutral', 'negative', 'interested', 'not_interested'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_replies' AND column_name = 'requires_action') THEN
        ALTER TABLE campaign_replies ADD COLUMN requires_action BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_replies' AND column_name = 'reply_priority') THEN
        ALTER TABLE campaign_replies ADD COLUMN reply_priority TEXT DEFAULT 'medium' CHECK (reply_priority IN ('high', 'medium', 'low'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_replies' AND column_name = 'action_taken') THEN
        ALTER TABLE campaign_replies ADD COLUMN action_taken BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_replies' AND column_name = 'response_time_hours') THEN
        ALTER TABLE campaign_replies ADD COLUMN response_time_hours DECIMAL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_replies' AND column_name = 'is_processed') THEN
        ALTER TABLE campaign_replies ADD COLUMN is_processed BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_replies' AND column_name = 'processed_by') THEN
        ALTER TABLE campaign_replies ADD COLUMN processed_by UUID;
    END IF;
END $$;

-- Add foreign keys if they don't exist
DO $$
BEGIN
    -- campaign_messages foreign keys
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'campaign_messages_campaign_id_fkey'
    ) THEN
        ALTER TABLE campaign_messages
        ADD CONSTRAINT campaign_messages_campaign_id_fkey
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'campaign_messages_workspace_id_fkey'
    ) THEN
        ALTER TABLE campaign_messages
        ADD CONSTRAINT campaign_messages_workspace_id_fkey
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
    END IF;

    -- campaign_replies foreign keys (only if columns exist)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_replies' AND column_name = 'campaign_message_id')
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_replies_campaign_message_id_fkey')
    THEN
        ALTER TABLE campaign_replies
        ADD CONSTRAINT campaign_replies_campaign_message_id_fkey
        FOREIGN KEY (campaign_message_id) REFERENCES campaign_messages(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'campaign_replies_campaign_id_fkey'
    ) THEN
        ALTER TABLE campaign_replies
        ADD CONSTRAINT campaign_replies_campaign_id_fkey
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'campaign_replies_workspace_id_fkey'
    ) THEN
        ALTER TABLE campaign_replies
        ADD CONSTRAINT campaign_replies_workspace_id_fkey
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign ON campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_workspace ON campaign_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_conversation ON campaign_messages(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_messages_sent_at ON campaign_messages(sent_at);

CREATE INDEX IF NOT EXISTS idx_campaign_replies_campaign ON campaign_replies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_workspace ON campaign_replies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_conversation ON campaign_replies(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_replies_received_at ON campaign_replies(received_at);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_unprocessed ON campaign_replies(workspace_id, is_processed) WHERE is_processed = false;

-- Enable RLS
ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_replies ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Fix campaigns table structure
-- ============================================================================

-- Rename started_at to launched_at if needed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns' AND column_name = 'started_at'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns' AND column_name = 'launched_at'
    ) THEN
        ALTER TABLE campaigns RENAME COLUMN started_at TO launched_at;
    END IF;
END $$;

-- Add missing columns to campaigns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'launched_at') THEN
        ALTER TABLE campaigns ADD COLUMN launched_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'funnel_id') THEN
        ALTER TABLE campaigns ADD COLUMN funnel_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'target_icp') THEN
        ALTER TABLE campaigns ADD COLUMN target_icp JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'ab_test_variant') THEN
        ALTER TABLE campaigns ADD COLUMN ab_test_variant TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'message_templates') THEN
        ALTER TABLE campaigns ADD COLUMN message_templates JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'created_by') THEN
        ALTER TABLE campaigns ADD COLUMN created_by UUID;
    END IF;
END $$;

-- Convert campaigns.workspace_id from TEXT to UUID if needed
DO $$
DECLARE
    policy_record RECORD;
    view_def TEXT;
    deleted_count INT;
BEGIN
    -- Check if workspace_id is TEXT
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns'
        AND column_name = 'workspace_id'
        AND data_type = 'text'
    ) THEN
        -- Step 0a: Clean up orphaned campaigns with invalid workspace_id values
        -- Delete campaigns where workspace_id is not a valid UUID format
        DELETE FROM campaigns
        WHERE workspace_id IS NOT NULL
        AND workspace_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % orphaned campaigns with invalid workspace_id', deleted_count;

        -- Delete campaigns where workspace_id doesn't exist in workspaces table
        DELETE FROM campaigns c
        WHERE c.workspace_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM workspaces w WHERE w.id::text = c.workspace_id
        );

        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % campaigns with non-existent workspace_id', deleted_count;

        -- Step 0b: Save and drop any views that depend on campaigns.workspace_id
        -- Note: We'll recreate workspace_subscription_status later if needed
        DROP VIEW IF EXISTS workspace_subscription_status CASCADE;

        -- Step 1: Drop ALL policies on campaigns table
        FOR policy_record IN
            SELECT policyname FROM pg_policies WHERE tablename = 'campaigns'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON campaigns', policy_record.policyname);
        END LOOP;

        -- Step 2: Drop ALL policies on campaign_prospects (they may reference campaigns.workspace_id)
        FOR policy_record IN
            SELECT policyname FROM pg_policies WHERE tablename = 'campaign_prospects'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON campaign_prospects', policy_record.policyname);
        END LOOP;

        -- Step 3: Drop ALL policies on campaign_messages
        FOR policy_record IN
            SELECT policyname FROM pg_policies WHERE tablename = 'campaign_messages'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON campaign_messages', policy_record.policyname);
        END LOOP;

        -- Step 4: Drop ALL policies on campaign_replies
        FOR policy_record IN
            SELECT policyname FROM pg_policies WHERE tablename = 'campaign_replies'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON campaign_replies', policy_record.policyname);
        END LOOP;

        -- Step 5: Drop foreign key constraint if exists
        ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_workspace_id_fkey;

        -- Step 6: Convert TEXT to UUID
        ALTER TABLE campaigns
        ALTER COLUMN workspace_id TYPE UUID USING workspace_id::uuid;

        -- Step 7: Re-add foreign key
        ALTER TABLE campaigns
        ADD CONSTRAINT campaigns_workspace_id_fkey
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add workspace_id to campaign_prospects if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_prospects' AND column_name = 'workspace_id') THEN
        ALTER TABLE campaign_prospects ADD COLUMN workspace_id UUID;

        -- Populate from campaigns table
        UPDATE campaign_prospects cp
        SET workspace_id = c.workspace_id
        FROM campaigns c
        WHERE cp.campaign_id = c.id;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_id ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_launched_at ON campaigns(launched_at) WHERE launched_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_workspace_id ON campaign_prospects(workspace_id);

-- ============================================================================
-- STEP 3: Create/Update campaign_performance_summary view
-- ============================================================================

DROP VIEW IF EXISTS campaign_performance_summary;

CREATE VIEW campaign_performance_summary AS
SELECT
    c.id as campaign_id,
    c.workspace_id,
    c.name as campaign_name,
    c.status,
    c.campaign_type,
    c.ab_test_variant,
    c.launched_at,
    c.created_by,
    COUNT(DISTINCT cm.id) as messages_sent,
    COUNT(DISTINCT cr.id) as replies_received,
    CASE
        WHEN COUNT(DISTINCT cm.id) > 0
        THEN ROUND((COUNT(DISTINCT cr.id)::decimal / COUNT(DISTINCT cm.id) * 100), 2)
        ELSE 0
    END as reply_rate_percent,
    AVG(cr.response_time_hours) as avg_response_time_hours,
    COUNT(DISTINCT CASE WHEN cr.reply_sentiment = 'positive' THEN cr.id END) as positive_replies,
    COUNT(DISTINCT CASE WHEN cr.reply_sentiment = 'interested' THEN cr.id END) as interested_replies,
    COUNT(DISTINCT CASE WHEN cr.requires_action = true AND cr.is_processed = false THEN cr.id END) as pending_replies,
    0 as meetings_booked
FROM campaigns c
LEFT JOIN campaign_messages cm ON c.id = cm.campaign_id
LEFT JOIN campaign_replies cr ON cm.id = cr.campaign_message_id
GROUP BY c.id, c.workspace_id, c.name, c.status, c.campaign_type, c.ab_test_variant, c.launched_at, c.created_by;

-- ============================================================================
-- STEP 4: Fix create_campaign function
-- ============================================================================

CREATE OR REPLACE FUNCTION create_campaign(
    p_workspace_id UUID,
    p_name TEXT,
    p_description TEXT DEFAULT NULL,
    p_campaign_type TEXT DEFAULT 'multi_channel',
    p_target_icp JSONB DEFAULT '{}',
    p_ab_test_variant TEXT DEFAULT NULL,
    p_message_templates JSONB DEFAULT '{}',
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_campaign_id UUID;
    v_user_id UUID;
BEGIN
    -- Get user ID directly from auth.uid()
    v_user_id := COALESCE(p_created_by, auth.uid());

    INSERT INTO campaigns (
        workspace_id, name, description, campaign_type,
        target_icp, ab_test_variant, message_templates, created_by
    ) VALUES (
        p_workspace_id, p_name, p_description, p_campaign_type,
        p_target_icp, p_ab_test_variant, p_message_templates, v_user_id
    ) RETURNING id INTO v_campaign_id;

    RETURN v_campaign_id;
END;
$$;

-- ============================================================================
-- STEP 5: Fix RLS policies
-- ============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can access workspace campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can access workspace campaign messages" ON campaign_messages;
DROP POLICY IF EXISTS "Users can access workspace campaign replies" ON campaign_replies;
DROP POLICY IF EXISTS "Users can access workspace campaign prospects" ON campaign_prospects;

-- Recreate policies with Supabase auth
CREATE POLICY "Users can access workspace campaigns" ON campaigns
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can access workspace campaign messages" ON campaign_messages
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can access workspace campaign replies" ON campaign_replies
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can access workspace campaign prospects" ON campaign_prospects
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON VIEW campaign_performance_summary IS 'Campaign analytics with workspace_id for multi-tenant filtering';
COMMENT ON FUNCTION create_campaign IS 'Create campaign using Supabase auth';
COMMENT ON TABLE campaign_messages IS 'All outbound messages sent as part of campaigns';
COMMENT ON TABLE campaign_replies IS 'All replies received to campaign messages';

-- ============================================================================
-- NOTES
-- ============================================================================

-- Note: The view 'workspace_subscription_status' was dropped during this migration
-- because it depended on campaigns.workspace_id before the type conversion.
-- If this view is needed, it should be recreated in a separate migration
-- after this one completes successfully.

-- ============================================================================
-- DONE
-- ============================================================================
