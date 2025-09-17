-- Supabase Function: Reassign User to Different Workspace with History Loss
-- WARNING: This function will DELETE all user history when reassigning workspaces
-- History includes: conversations, threads, messages, knowledge base entries, etc.

CREATE OR REPLACE FUNCTION reassign_user_workspace(
  target_user_id UUID,
  target_workspace_id UUID,
  new_role TEXT DEFAULT 'member',
  admin_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_workspace_id UUID;
  user_email TEXT;
  workspace_name TEXT;
  deleted_records JSON;
  result JSON;
BEGIN
  -- Validate inputs
  IF target_user_id IS NULL OR target_workspace_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User ID and Workspace ID are required'
    );
  END IF;

  -- Validate role
  IF new_role NOT IN ('owner', 'admin', 'member', 'viewer') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid role. Must be: owner, admin, member, or viewer'
    );
  END IF;

  -- Get user information
  SELECT email INTO user_email 
  FROM auth.users 
  WHERE id = target_user_id;
  
  IF user_email IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Get target workspace information
  SELECT name INTO workspace_name 
  FROM workspaces 
  WHERE id = target_workspace_id;
  
  IF workspace_name IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Target workspace not found'
    );
  END IF;

  -- Get current workspace from workspace_members
  SELECT workspace_id INTO current_workspace_id 
  FROM workspace_members 
  WHERE user_id = target_user_id 
  LIMIT 1;

  -- If user is already in the target workspace, just update role
  IF EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE user_id = target_user_id AND workspace_id = target_workspace_id
  ) THEN
    UPDATE workspace_members 
    SET role = new_role, 
        joined_at = NOW()
    WHERE user_id = target_user_id AND workspace_id = target_workspace_id;
    
    RETURN json_build_object(
      'success', true,
      'message', 'User role updated in current workspace',
      'action', 'role_updated',
      'user_email', user_email,
      'workspace_name', workspace_name,
      'new_role', new_role
    );
  END IF;

  -- Start transaction for workspace reassignment with history deletion
  BEGIN
    -- Step 1: Delete user's conversation history
    DELETE FROM sam_thread_messages 
    WHERE thread_id IN (
      SELECT id FROM sam_conversation_threads WHERE user_id::UUID = target_user_id
    );
    
    DELETE FROM sam_conversation_threads WHERE user_id::UUID = target_user_id;
    
    -- Step 2: Delete user's knowledge base entries
    DELETE FROM knowledge_base_entries WHERE user_id = target_user_id;
    DELETE FROM knowledge_classifications WHERE user_id = target_user_id;
    
    -- Step 3: Delete user's prospect approvals and campaign data
    DELETE FROM prospect_approval_decisions WHERE user_id = target_user_id;
    DELETE FROM prospect_approval_sessions WHERE user_id = target_user_id;
    
    -- Step 4: Delete user's campaign tracking data
    DELETE FROM campaign_message_tracking WHERE user_id = target_user_id;
    DELETE FROM campaign_executions WHERE user_id = target_user_id;
    
    -- Step 5: Delete user's integration data
    DELETE FROM user_unipile_accounts WHERE user_id = target_user_id;
    DELETE FROM user_integration_status WHERE user_id = target_user_id;
    
    -- Step 6: Delete user's N8N workflow data
    DELETE FROM n8n_campaign_executions WHERE user_id = target_user_id;
    DELETE FROM workspace_n8n_workflows WHERE workspace_id = current_workspace_id AND created_by = target_user_id;
    
    -- Step 7: Delete user's email and proxy preferences
    DELETE FROM user_proxy_preferences WHERE user_id = target_user_id;
    DELETE FROM user_email_providers WHERE user_id = target_user_id;
    
    -- Step 8: Remove user from current workspace memberships
    DELETE FROM workspace_members WHERE user_id = target_user_id;
    
    -- Step 9: Clear user's workspace references
    UPDATE auth.users 
    SET 
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'current_workspace_id', NULL,
        'default_workspace_id', NULL,
        'workspace_reassigned_at', NOW()::text,
        'reassigned_by_admin', COALESCE(admin_user_id::text, 'system')
      )
    WHERE id = target_user_id;
    
    -- Step 10: Add user to new workspace
    INSERT INTO workspace_members (
      workspace_id,
      user_id,
      role,
      joined_at,
      invited_by
    ) VALUES (
      target_workspace_id,
      target_user_id,
      new_role,
      NOW(),
      admin_user_id
    );
    
    -- Step 11: Update user's current workspace reference
    UPDATE auth.users 
    SET 
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'current_workspace_id', target_workspace_id::text,
        'default_workspace_id', target_workspace_id::text
      )
    WHERE id = target_user_id;

    -- Create audit log entry
    INSERT INTO audit_logs (
      user_id,
      action_type,
      resource_type,
      resource_id,
      details,
      metadata,
      performed_by,
      created_at
    ) VALUES (
      target_user_id,
      'workspace_reassignment',
      'user',
      target_user_id,
      format('User %s reassigned from workspace %s to workspace %s with history deletion', 
             user_email, current_workspace_id, target_workspace_id),
      json_build_object(
        'previous_workspace_id', current_workspace_id,
        'new_workspace_id', target_workspace_id,
        'new_role', new_role,
        'history_deleted', true,
        'admin_initiated', admin_user_id IS NOT NULL
      ),
      COALESCE(admin_user_id, target_user_id),
      NOW()
    );

    -- Build success result
    result := json_build_object(
      'success', true,
      'message', format('User %s successfully reassigned to workspace %s with %s role. All previous history has been deleted.', 
                       user_email, workspace_name, new_role),
      'action', 'reassigned_with_history_loss',
      'user_id', target_user_id,
      'user_email', user_email,
      'previous_workspace_id', current_workspace_id,
      'new_workspace_id', target_workspace_id,
      'workspace_name', workspace_name,
      'new_role', new_role,
      'history_deleted', true,
      'reassigned_at', NOW(),
      'reassigned_by', admin_user_id
    );

    RETURN result;

  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback transaction on error
      RAISE;
      RETURN json_build_object(
        'success', false,
        'error', 'Failed to reassign user workspace: ' || SQLERRM,
        'sqlstate', SQLSTATE
      );
  END;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION reassign_user_workspace TO authenticated;

-- Comment explaining the function
COMMENT ON FUNCTION reassign_user_workspace IS 
'Reassigns a user to a different workspace and DELETES ALL their history including conversations, knowledge base entries, campaigns, and integrations. Use with caution as this action is irreversible.';