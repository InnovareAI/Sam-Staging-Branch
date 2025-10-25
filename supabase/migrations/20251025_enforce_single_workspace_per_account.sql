-- ================================================================
-- ENFORCE: ONE ACCOUNT = ONE WORKSPACE (NO EXCEPTIONS)
-- Date: 2025-10-25
-- CRITICAL BUSINESS RULE
-- ================================================================

-- ================================================================
-- PART 1: Ensure UNIQUE constraints exist
-- ================================================================

-- workspace_accounts: unipile_account_id must be globally unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspace_accounts_unipile_account_id_key'
  ) THEN
    ALTER TABLE workspace_accounts
      ADD CONSTRAINT workspace_accounts_unipile_account_id_key
      UNIQUE (unipile_account_id);
    RAISE NOTICE 'Added unique constraint on workspace_accounts.unipile_account_id';
  ELSE
    RAISE NOTICE 'Unique constraint already exists on workspace_accounts.unipile_account_id';
  END IF;
END $$;

-- user_unipile_accounts: unipile_account_id must be globally unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_unipile_accounts_unipile_account_id_key'
  ) THEN
    ALTER TABLE user_unipile_accounts
      ADD CONSTRAINT user_unipile_accounts_unipile_account_id_key
      UNIQUE (unipile_account_id);
    RAISE NOTICE 'Added unique constraint on user_unipile_accounts.unipile_account_id';
  ELSE
    RAISE NOTICE 'Unique constraint already exists on user_unipile_accounts.unipile_account_id';
  END IF;
END $$;

-- ================================================================
-- PART 2: Prevent workspace_id changes after creation
-- ================================================================

CREATE OR REPLACE FUNCTION prevent_workspace_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow INSERT (first time)
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Prevent workspace_id change on UPDATE
  IF TG_OP = 'UPDATE' AND OLD.workspace_id IS NOT NULL AND NEW.workspace_id != OLD.workspace_id THEN
    RAISE EXCEPTION 'Cannot move account % to different workspace. Accounts can only belong to ONE workspace.', OLD.unipile_account_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to workspace_accounts
DROP TRIGGER IF EXISTS prevent_workspace_change_workspace_accounts ON workspace_accounts;
CREATE TRIGGER prevent_workspace_change_workspace_accounts
  BEFORE UPDATE ON workspace_accounts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_workspace_change();

-- Apply trigger to user_unipile_accounts
DROP TRIGGER IF EXISTS prevent_workspace_change_user_unipile ON user_unipile_accounts;
CREATE TRIGGER prevent_workspace_change_user_unipile
  BEFORE UPDATE ON user_unipile_accounts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_workspace_change();

-- ================================================================
-- PART 3: Add comments for documentation
-- ================================================================

COMMENT ON CONSTRAINT workspace_accounts_unipile_account_id_key ON workspace_accounts IS
'CRITICAL: One account can only belong to ONE workspace. No exceptions.';

COMMENT ON CONSTRAINT user_unipile_accounts_unipile_account_id_key ON user_unipile_accounts IS
'CRITICAL: One account can only belong to ONE workspace. No exceptions.';

COMMENT ON FUNCTION prevent_workspace_change() IS
'Enforces business rule: Accounts cannot be moved between workspaces after creation.';

-- ================================================================
-- END
-- ================================================================

SELECT 'Single workspace per account constraint enforced' as status;
