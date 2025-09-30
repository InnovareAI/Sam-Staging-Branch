-- ============================================================================
-- AUTOMATIC WORKSPACE ASSIGNMENT FOR ALL USERS
-- This ensures NO user ever encounters "User is not associated with workspace"
-- ============================================================================

-- 1. Ensure the column exists
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS current_workspace_id UUID
REFERENCES workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_current_workspace_id 
ON users(current_workspace_id);

-- 2. Function to auto-assign workspace when membership is created
CREATE OR REPLACE FUNCTION auto_assign_user_workspace()
RETURNS TRIGGER AS $$
BEGIN
  -- When a workspace membership is created, automatically set current_workspace_id
  -- if the user doesn't have one yet
  UPDATE users
  SET current_workspace_id = NEW.workspace_id
  WHERE id = NEW.user_id
  AND current_workspace_id IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger on workspace_members insert
DROP TRIGGER IF EXISTS trigger_auto_assign_workspace ON workspace_members;
CREATE TRIGGER trigger_auto_assign_workspace
  AFTER INSERT ON workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_user_workspace();

-- 4. Function to ensure user has workspace when they authenticate
CREATE OR REPLACE FUNCTION ensure_user_has_workspace()
RETURNS TRIGGER AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  -- Only run if current_workspace_id is NULL
  IF NEW.current_workspace_id IS NULL THEN
    -- Try to get workspace from existing membership
    SELECT workspace_id INTO v_workspace_id
    FROM workspace_members
    WHERE user_id = NEW.id
    ORDER BY joined_at ASC
    LIMIT 1;
    
    -- If user has a membership, use that workspace
    IF v_workspace_id IS NOT NULL THEN
      NEW.current_workspace_id := v_workspace_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger on users table for updates
DROP TRIGGER IF EXISTS trigger_ensure_workspace ON users;
CREATE TRIGGER trigger_ensure_workspace
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_has_workspace();

-- 6. Backfill existing users who are missing current_workspace_id
UPDATE users u
SET current_workspace_id = (
  SELECT wm.workspace_id
  FROM workspace_members wm
  WHERE wm.user_id = u.id
  ORDER BY wm.joined_at ASC
  LIMIT 1
)
WHERE current_workspace_id IS NULL
AND EXISTS (
  SELECT 1 
  FROM workspace_members wm 
  WHERE wm.user_id = u.id
);

-- 7. Verification query
SELECT 
  COUNT(*) as total_users,
  COUNT(current_workspace_id) as users_with_workspace,
  COUNT(*) - COUNT(current_workspace_id) as users_without_workspace
FROM users;

-- 8. Show any users still without workspace
SELECT 
  u.id,
  u.email,
  u.current_workspace_id,
  COUNT(wm.id) as membership_count
FROM users u
LEFT JOIN workspace_members wm ON wm.user_id = u.id
WHERE u.current_workspace_id IS NULL
GROUP BY u.id, u.email, u.current_workspace_id;

COMMENT ON COLUMN users.current_workspace_id IS 'Users currently active workspace - auto-assigned via trigger';
COMMENT ON FUNCTION auto_assign_user_workspace() IS 'Automatically assigns workspace when membership is created';
COMMENT ON FUNCTION ensure_user_has_workspace() IS 'Ensures user always has a workspace if they have memberships';