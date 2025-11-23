-- Nuclear option: Drop ALL policies on linkedin_post_monitors regardless of name
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'linkedin_post_monitors'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON linkedin_post_monitors', pol.policyname);
    END LOOP;
END $$;

-- Verify all policies are gone
SELECT COUNT(*) as remaining_policies
FROM pg_policies 
WHERE tablename = 'linkedin_post_monitors';

-- Now create exactly 4 clean policies
CREATE POLICY "select_workspace_monitors"
ON linkedin_post_monitors
FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "insert_workspace_monitors"
ON linkedin_post_monitors
FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "update_workspace_monitors"
ON linkedin_post_monitors
FOR UPDATE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "delete_workspace_monitors"
ON linkedin_post_monitors
FOR DELETE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);

-- Final verification
SELECT COUNT(*) as final_policy_count
FROM pg_policies 
WHERE tablename = 'linkedin_post_monitors';

SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'linkedin_post_monitors'
ORDER BY cmd;
