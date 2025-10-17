-- Add workspace_id to campaign_performance_summary view
-- This allows filtering analytics by workspace

DROP VIEW IF EXISTS campaign_performance_summary;

CREATE OR REPLACE VIEW campaign_performance_summary AS
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
    -- Add meetings tracking (placeholder for now, can be enhanced later)
    0 as meetings_booked
FROM campaigns c
LEFT JOIN campaign_messages cm ON c.id = cm.campaign_id
LEFT JOIN campaign_replies cr ON cm.id = cr.campaign_message_id
GROUP BY c.id, c.workspace_id, c.name, c.status, c.campaign_type, c.ab_test_variant, c.launched_at, c.created_by;

COMMENT ON VIEW campaign_performance_summary IS 'Campaign performance metrics with workspace_id for filtering';
-- Fix campaigns table conflicts between different migrations
-- Standardize column names and types

-- First, check if we need to rename started_at to launched_at
DO $$
BEGIN
    -- If started_at exists but launched_at doesn't, rename it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns' AND column_name = 'started_at'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns' AND column_name = 'launched_at'
    ) THEN
        ALTER TABLE campaigns RENAME COLUMN started_at TO launched_at;
    END IF;

    -- If neither exists, add launched_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns' AND column_name = 'launched_at'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns' AND column_name = 'started_at'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN launched_at TIMESTAMPTZ;
    END IF;
END $$;

-- Ensure all required columns exist for campaign tracking
DO $$
BEGIN
    -- Add funnel_id if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns' AND column_name = 'funnel_id'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN funnel_id UUID;
    END IF;

    -- Add target_icp if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns' AND column_name = 'target_icp'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN target_icp JSONB;
    END IF;

    -- Add ab_test_variant if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns' AND column_name = 'ab_test_variant'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN ab_test_variant TEXT;
    END IF;

    -- Add message_templates if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns' AND column_name = 'message_templates'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN message_templates JSONB;
    END IF;

    -- Add created_by if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE campaigns ADD COLUMN created_by UUID REFERENCES users(id);
    END IF;
END $$;

-- Fix workspace_id type if needed (TEXT -> UUID)
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Check if workspace_id is TEXT and workspaces.id is UUID
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns'
        AND column_name = 'workspace_id'
        AND data_type = 'text'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workspaces'
        AND column_name = 'id'
        AND data_type = 'uuid'
    ) THEN
        -- Step 1: Drop ALL policies on campaigns table that might reference workspace_id
        FOR policy_record IN
            SELECT policyname FROM pg_policies WHERE tablename = 'campaigns'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON campaigns', policy_record.policyname);
        END LOOP;

        -- Step 2: Drop any existing foreign key constraint
        ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_workspace_id_fkey;

        -- Step 3: Convert the column type
        ALTER TABLE campaigns
        ALTER COLUMN workspace_id TYPE UUID USING workspace_id::uuid;

        -- Step 4: Re-add foreign key constraint
        ALTER TABLE campaigns
        ADD CONSTRAINT campaigns_workspace_id_fkey
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

        -- Step 5: Recreate basic RLS policies (will be replaced by later migration)
        -- These are temporary and will be replaced by migration 20251017000003
    END IF;
END $$;

-- Ensure proper constraints on campaign_type
DO $$
BEGIN
    -- Drop existing constraint if any
    ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_campaign_type_check;

    -- Add comprehensive campaign_type constraint
    ALTER TABLE campaigns
    ADD CONSTRAINT campaigns_campaign_type_check
    CHECK (campaign_type IN ('linkedin', 'email', 'multi_channel', 'linkedin_only', 'connector', 'messenger', 'builder', 'inbound'));
END $$;

-- Ensure proper constraints on status
DO $$
BEGIN
    -- Drop existing constraint if any
    ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;

    -- Add comprehensive status constraint
    ALTER TABLE campaigns
    ADD CONSTRAINT campaigns_status_check
    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived'));
END $$;

-- Create/recreate indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_id ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_status ON campaigns(workspace_id, status);

-- Only create launched_at index if the column exists now
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns' AND column_name = 'launched_at'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_campaigns_launched_at ON campaigns(launched_at) WHERE launched_at IS NOT NULL;
    END IF;
END $$;

-- Ensure unique constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'campaigns_workspace_id_name_key'
    ) THEN
        ALTER TABLE campaigns ADD CONSTRAINT campaigns_workspace_id_name_key UNIQUE(workspace_id, name);
    END IF;
END $$;

COMMENT ON TABLE campaigns IS 'Campaign tracking table - unified structure from multiple migrations';
COMMENT ON COLUMN campaigns.launched_at IS 'Renamed from started_at for consistency with campaign_tracking schema';
-- Fix campaign RLS policies to use Supabase auth instead of Clerk
-- Replace clerk_id lookups with direct auth.uid() usage

-- Drop old policies
DROP POLICY IF EXISTS "Users can access workspace campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can access workspace campaign messages" ON campaign_messages;
DROP POLICY IF EXISTS "Users can access workspace campaign replies" ON campaign_replies;
DROP POLICY IF EXISTS "Users can access workspace campaign reply actions" ON campaign_reply_actions;

-- Recreate policies with Supabase auth

-- Campaigns: Users can see campaigns in their workspace
CREATE POLICY "Users can access workspace campaigns" ON campaigns
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Campaign messages: Users can see messages from their workspace campaigns
CREATE POLICY "Users can access workspace campaign messages" ON campaign_messages
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Campaign replies: Users can see replies to their workspace campaign messages
CREATE POLICY "Users can access workspace campaign replies" ON campaign_replies
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Campaign reply actions: Users can see actions on their workspace campaign replies
CREATE POLICY "Users can access workspace campaign reply actions" ON campaign_reply_actions
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

COMMENT ON POLICY "Users can access workspace campaigns" ON campaigns IS 'RLS policy using Supabase auth.uid()';
-- Verify campaign_prospects table structure and fix any issues
-- Ensure it properly references campaigns table

-- Ensure campaign_prospects has all necessary columns
DO $$
BEGIN
    -- Add workspace_id if missing (for RLS and analytics)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaign_prospects' AND column_name = 'workspace_id'
    ) THEN
        ALTER TABLE campaign_prospects ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

        -- Populate workspace_id from campaigns table
        UPDATE campaign_prospects cp
        SET workspace_id = c.workspace_id
        FROM campaigns c
        WHERE cp.campaign_id = c.id;
    END IF;

    -- Add source column if missing (to track where prospect came from)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaign_prospects' AND column_name = 'source'
    ) THEN
        ALTER TABLE campaign_prospects ADD COLUMN source TEXT DEFAULT 'manual';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_campaign_id ON campaign_prospects(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_workspace_id ON campaign_prospects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_status ON campaign_prospects(status);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_linkedin_user_id ON campaign_prospects(linkedin_user_id) WHERE linkedin_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_email ON campaign_prospects(email) WHERE email IS NOT NULL;

-- Enable RLS if not already enabled
ALTER TABLE campaign_prospects ENABLE ROW LEVEL SECURITY;

-- Drop old RLS policies and create new ones with Supabase auth
DROP POLICY IF EXISTS "Enable all operations for service role" ON campaign_prospects;
DROP POLICY IF EXISTS "Users can access workspace campaign prospects" ON campaign_prospects;

-- Create comprehensive RLS policy for campaign_prospects
CREATE POLICY "Users can access workspace campaign prospects" ON campaign_prospects
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

COMMENT ON TABLE campaign_prospects IS 'Prospects associated with campaigns, includes workspace_id for RLS';
COMMENT ON COLUMN campaign_prospects.workspace_id IS 'Denormalized from campaigns for faster RLS queries';
-- Fix create_campaign function to work with Supabase auth (not Clerk)
-- Update to use auth.uid() directly instead of looking up clerk_id

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
    -- Get user ID directly from auth.uid() (Supabase auth)
    -- If p_created_by is provided, use that, otherwise use current auth user
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

COMMENT ON FUNCTION create_campaign IS 'Create a new campaign with Supabase auth support';
