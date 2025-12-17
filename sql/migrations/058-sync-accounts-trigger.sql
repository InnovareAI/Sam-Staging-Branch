-- Migration: 058-sync-accounts-trigger.sql
-- Purpose: Automatically sync user_unipile_accounts → workspace_accounts
-- This eliminates "LinkedIn account not found" errors caused by dual-table architecture
-- Date: December 17, 2025

-- ============================================================================
-- STEP 1: Create the sync function
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_unipile_to_workspace_accounts()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT or UPDATE to user_unipile_accounts, sync to workspace_accounts

  -- Check if record already exists in workspace_accounts (by unipile_account_id)
  IF EXISTS (
    SELECT 1 FROM workspace_accounts
    WHERE unipile_account_id = NEW.unipile_account_id
  ) THEN
    -- UPDATE existing record
    UPDATE workspace_accounts
    SET
      account_name = NEW.account_name,
      -- Normalize status: 'active' → 'connected' for consistency
      connection_status = CASE
        WHEN NEW.connection_status = 'active' THEN 'connected'
        ELSE COALESCE(NEW.connection_status, 'connected')
      END,
      is_active = CASE
        WHEN NEW.connection_status IN ('active', 'connected') THEN true
        ELSE false
      END,
      updated_at = NOW()
    WHERE unipile_account_id = NEW.unipile_account_id;

    RAISE NOTICE 'Updated workspace_accounts for unipile_account_id: %', NEW.unipile_account_id;

  ELSE
    -- INSERT new record
    INSERT INTO workspace_accounts (
      id,
      workspace_id,
      user_id,
      account_type,
      account_identifier,
      account_name,
      unipile_account_id,
      platform_account_id,
      connection_status,
      connected_at,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,  -- Use same ID for FK consistency
      NEW.workspace_id,
      NEW.user_id,
      -- Map platform types to valid account_type values
      CASE
        WHEN NEW.platform = 'LINKEDIN' THEN 'linkedin'
        WHEN NEW.platform = 'GOOGLE_OAUTH' THEN 'email'
        WHEN NEW.platform = 'MAIL' THEN 'email'
        WHEN NEW.platform IS NULL THEN 'linkedin'
        ELSE LOWER(NEW.platform)
      END,
      COALESCE(NEW.account_email, NEW.linkedin_public_identifier, NEW.unipile_account_id),
      NEW.account_name,
      NEW.unipile_account_id,
      NEW.linkedin_public_identifier,
      -- Normalize status
      CASE
        WHEN NEW.connection_status = 'active' THEN 'connected'
        ELSE COALESCE(NEW.connection_status, 'connected')
      END,
      NOW(),
      CASE
        WHEN NEW.connection_status IN ('active', 'connected') THEN true
        ELSE false
      END,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      account_name = EXCLUDED.account_name,
      connection_status = EXCLUDED.connection_status,
      is_active = EXCLUDED.is_active,
      updated_at = NOW();

    RAISE NOTICE 'Inserted workspace_accounts for unipile_account_id: %', NEW.unipile_account_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Create the trigger
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_sync_unipile_to_workspace ON user_unipile_accounts;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER trigger_sync_unipile_to_workspace
  AFTER INSERT OR UPDATE ON user_unipile_accounts
  FOR EACH ROW
  EXECUTE FUNCTION sync_unipile_to_workspace_accounts();

-- ============================================================================
-- STEP 3: Sync existing records that are missing
-- ============================================================================

-- Insert any user_unipile_accounts records missing from workspace_accounts
INSERT INTO workspace_accounts (
  id,
  workspace_id,
  user_id,
  account_type,
  account_identifier,
  account_name,
  unipile_account_id,
  platform_account_id,
  connection_status,
  connected_at,
  is_active,
  created_at,
  updated_at
)
SELECT
  uua.id,
  uua.workspace_id,
  uua.user_id,
  -- Map platform types to valid account_type values
  CASE
    WHEN uua.platform = 'LINKEDIN' THEN 'linkedin'
    WHEN uua.platform = 'GOOGLE_OAUTH' THEN 'email'
    WHEN uua.platform = 'MAIL' THEN 'email'
    WHEN uua.platform IS NULL THEN 'linkedin'
    ELSE LOWER(uua.platform)
  END,
  COALESCE(uua.account_email, uua.linkedin_public_identifier, uua.unipile_account_id),
  uua.account_name,
  uua.unipile_account_id,
  uua.linkedin_public_identifier,
  CASE
    WHEN uua.connection_status = 'active' THEN 'connected'
    ELSE COALESCE(uua.connection_status, 'connected')
  END,
  uua.created_at,
  CASE
    WHEN uua.connection_status IN ('active', 'connected') THEN true
    ELSE false
  END,
  uua.created_at,
  NOW()
FROM user_unipile_accounts uua
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_accounts wa
  WHERE wa.unipile_account_id = uua.unipile_account_id
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 4: Verify sync
-- ============================================================================

-- This should return 0 rows if sync is complete
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM user_unipile_accounts uua
  WHERE NOT EXISTS (
    SELECT 1 FROM workspace_accounts wa
    WHERE wa.unipile_account_id = uua.unipile_account_id
  );

  IF missing_count > 0 THEN
    RAISE WARNING 'Still % accounts missing from workspace_accounts after sync', missing_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All user_unipile_accounts synced to workspace_accounts';
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK (if needed):
-- DROP TRIGGER IF EXISTS trigger_sync_unipile_to_workspace ON user_unipile_accounts;
-- DROP FUNCTION IF EXISTS sync_unipile_to_workspace_accounts();
-- ============================================================================
