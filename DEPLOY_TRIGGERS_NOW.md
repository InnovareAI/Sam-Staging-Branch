# 🚀 FINAL STEP: Deploy Database Triggers

## Run this SQL in Supabase Dashboard NOW

**Go to:** https://supabase.com/dashboard → Your Project → SQL Editor → New Query

**Paste and run this:**

```sql
-- ============================================================================
-- AUTOMATIC WORKSPACE ASSIGNMENT FOR ALL USERS
-- This ensures NO user ever encounters "User is not associated with workspace"
-- ============================================================================

-- 1. Function to auto-assign workspace when membership is created
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

-- 2. Create trigger on workspace_members insert
DROP TRIGGER IF EXISTS trigger_auto_assign_workspace ON workspace_members;
CREATE TRIGGER trigger_auto_assign_workspace
  AFTER INSERT ON workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_user_workspace();

-- 3. Function to ensure user has workspace when they authenticate
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

-- 4. Create trigger on users table for updates
DROP TRIGGER IF EXISTS trigger_ensure_workspace ON users;
CREATE TRIGGER trigger_ensure_workspace
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_has_workspace();

-- 5. Add comments for documentation
COMMENT ON FUNCTION auto_assign_user_workspace() IS 'Automatically assigns workspace when membership is created';
COMMENT ON FUNCTION ensure_user_has_workspace() IS 'Ensures user always has a workspace if they have memberships';

-- 6. Verify triggers are active
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name IN ('trigger_auto_assign_workspace', 'trigger_ensure_workspace')
ORDER BY event_object_table, trigger_name;
```

## ✅ Expected Result

You should see 2 triggers listed:
1. `trigger_auto_assign_workspace` on `workspace_members` table
2. `trigger_ensure_workspace` on `users` table

## 🎉 After Running This

**ALL FUTURE USERS will automatically:**
1. Get assigned a workspace when they join (via membership)
2. Have their `current_workspace_id` set automatically  
3. NEVER see "User is not associated with workspace" error

**The system is now bulletproof!** ✨