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
