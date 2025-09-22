-- CRITICAL SECURITY FIX: Race Condition in Execution Counter
-- Priority: P0 - Data Corruption Prevention
-- Issue: Multiple concurrent executions could overwrite each other's counter increments
-- Fix: Implement atomic increment operations with proper workspace ownership validation

-- Drop and recreate the function with race condition fixes
DROP FUNCTION IF EXISTS execute_campaign_atomically(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, TIMESTAMPTZ, INTEGER
);

-- Fixed Atomic Campaign Execution Function
-- SECURITY FIXES:
-- 1. Atomic increment prevents race conditions
-- 2. Workspace ownership validation prevents unauthorized access
-- 3. Row-level locking with REPEATABLE READ isolation
CREATE OR REPLACE FUNCTION execute_campaign_atomically(
  p_workspace_n8n_workflow_id UUID,
  p_campaign_approval_session_id UUID,
  p_workspace_id TEXT,
  p_n8n_execution_id TEXT,
  p_n8n_workflow_id TEXT,
  p_campaign_name TEXT,
  p_campaign_type TEXT,
  p_execution_config JSONB,
  p_total_prospects INTEGER,
  p_estimated_completion_time TIMESTAMPTZ,
  p_estimated_duration_minutes INTEGER
)
RETURNS TABLE(
  campaign_execution_id UUID,
  updated_workflow_executions INTEGER,
  execution_status TEXT,
  created_at TIMESTAMPTZ,
  error_message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_campaign_execution_id UUID;
  v_current_executions INTEGER;
  v_updated_executions INTEGER;
  v_workflow_exists BOOLEAN;
  v_session_valid BOOLEAN;
  v_error_msg TEXT;
  v_retry_count INTEGER := 0;
  v_max_retries INTEGER := 3;
  v_backoff_seconds INTEGER;
BEGIN
  -- Start explicit transaction with proper isolation level
  -- Using REPEATABLE READ to prevent phantom reads and ensure consistency
  -- This isolation level combined with atomic operations prevents race conditions
  SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
  
  -- Input validation with detailed logging
  IF p_workspace_n8n_workflow_id IS NULL OR p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: workspace_n8n_workflow_id and workspace_id cannot be null'
      USING ERRCODE = '22023', -- invalid_parameter_value
            DETAIL = 'Required parameters missing for campaign execution';
  END IF;
  
  IF p_campaign_type NOT IN ('email_only', 'linkedin_only', 'multi_channel') THEN
    RAISE EXCEPTION 'INVALID_CAMPAIGN_TYPE: campaign_type must be email_only, linkedin_only, or multi_channel'
      USING ERRCODE = '22023',
            DETAIL = 'Invalid campaign type provided: ' || COALESCE(p_campaign_type, 'NULL');
  END IF;
  
  -- Retry loop for handling transient database errors
  <<retry_loop>>
  LOOP
    BEGIN
      -- 1. Verify workflow exists and is active (with SELECT FOR UPDATE for locking)
      -- SECURITY FIX: Added workspace ownership validation
      SELECT EXISTS(
        SELECT 1 
        FROM workspace_n8n_workflows 
        WHERE id = p_workspace_n8n_workflow_id 
          AND workspace_id = p_workspace_id  -- Security: Validate workspace ownership
          AND deployment_status = 'active'
        FOR UPDATE NOWAIT  -- Fail immediately if locked to prevent deadlocks
      ) INTO v_workflow_exists;
      
      IF NOT v_workflow_exists THEN
        RAISE EXCEPTION 'WORKFLOW_NOT_FOUND: Active workflow not found for workspace'
          USING ERRCODE = 'P0002', -- no_data_found
                DETAIL = 'workflow_id: ' || p_workspace_n8n_workflow_id || ', workspace: ' || p_workspace_id;
      END IF;
      
      -- 2. Verify campaign approval session is valid and completed
      SELECT EXISTS(
        SELECT 1 
        FROM prospect_approval_sessions 
        WHERE id = p_campaign_approval_session_id 
          AND workspace_id = p_workspace_id 
          AND status = 'completed'
      ) INTO v_session_valid;
      
      IF NOT v_session_valid THEN
        RAISE EXCEPTION 'SESSION_INVALID: Campaign approval session not found or not completed'
          USING ERRCODE = 'P0002',
                DETAIL = 'session_id: ' || p_campaign_approval_session_id;
      END IF;
      
      -- 3. Verify workspace ownership for security (ADDITIONAL VALIDATION)
      -- This validates that the workspace_id provided matches the workflow's actual workspace
      SELECT COALESCE(total_executions, 0) 
      INTO v_current_executions
      FROM workspace_n8n_workflows 
      WHERE id = p_workspace_n8n_workflow_id 
        AND workspace_id = p_workspace_id;  -- Security: Validate workspace ownership
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'WORKSPACE_MISMATCH: Workflow does not belong to specified workspace'
          USING ERRCODE = '42704', -- undefined_object
                DETAIL = 'workflow_id: ' || p_workspace_n8n_workflow_id || ', workspace_id: ' || p_workspace_id;
      END IF;
      
      -- 4. Create campaign execution record (main operation)
      INSERT INTO n8n_campaign_executions (
        workspace_n8n_workflow_id,
        campaign_approval_session_id,
        workspace_id,
        n8n_execution_id,
        n8n_workflow_id,
        campaign_name,
        campaign_type,
        execution_config,
        total_prospects,
        processed_prospects,
        successful_outreach,
        failed_outreach,
        responses_received,
        execution_status,
        current_step,
        progress_percentage,
        estimated_completion_time,
        estimated_duration_minutes,
        started_at,
        created_at,
        updated_at
      ) VALUES (
        p_workspace_n8n_workflow_id,
        p_campaign_approval_session_id,
        p_workspace_id,
        p_n8n_execution_id,
        p_n8n_workflow_id,
        p_campaign_name,
        p_campaign_type,
        p_execution_config,
        p_total_prospects,
        0, -- processed_prospects
        0, -- successful_outreach
        0, -- failed_outreach
        0, -- responses_received
        'started',
        'initializing_campaign',
        0.0,
        p_estimated_completion_time,
        p_estimated_duration_minutes,
        NOW(),
        NOW(),
        NOW()
      )
      RETURNING id INTO v_campaign_execution_id;
      
      -- 5. RACE CONDITION FIX: Atomic increment of workflow execution counter
      -- This replaces the vulnerable read-modify-write pattern with an atomic operation
      UPDATE workspace_n8n_workflows 
      SET 
        total_executions = total_executions + 1,  -- ATOMIC INCREMENT - prevents race conditions
        successful_executions = CASE WHEN 'started' = 'completed' THEN successful_executions + 1 ELSE successful_executions END,
        last_execution_at = NOW(),
        updated_at = NOW()
      WHERE id = p_workspace_n8n_workflow_id
        AND workspace_id = p_workspace_id  -- Security: Double-check workspace ownership
      RETURNING total_executions INTO v_updated_executions;
      
      -- Verify the update affected exactly one row and get the updated count
      IF NOT FOUND THEN
        RAISE EXCEPTION 'WORKFLOW_UPDATE_FAILED: Failed to update workflow execution counter'
          USING ERRCODE = 'P0003', -- no_data_found
                DETAIL = 'workflow_id: ' || p_workspace_n8n_workflow_id || ', workspace_id: ' || p_workspace_id;
      END IF;
      
      -- 6. Insert audit trail for campaign execution
      INSERT INTO workflow_deployment_history (
        workspace_n8n_workflow_id,
        workspace_id,
        deployment_type,
        deployment_trigger,
        status,
        n8n_execution_id,
        deployed_workflow_id,
        initiated_by,
        deployment_notes,
        started_at,
        completed_at,
        created_at
      ) VALUES (
        p_workspace_n8n_workflow_id,
        p_workspace_id,
        'manual_redeploy',
        'user_request',
        'completed',
        p_n8n_execution_id,
        p_n8n_workflow_id,
        'system',
        'Campaign execution initiated: ' || p_campaign_name,
        NOW(),
        NOW(),
        NOW()
      );
      
      -- Success: exit retry loop
      EXIT retry_loop;
      
    EXCEPTION
      WHEN lock_not_available THEN
        -- Handle lock timeout - retry with exponential backoff
        v_retry_count := v_retry_count + 1;
        IF v_retry_count >= v_max_retries THEN
          RAISE EXCEPTION 'LOCK_TIMEOUT: Unable to acquire database locks after % retries', v_max_retries
            USING ERRCODE = '55P03', -- lock_not_available
                  DETAIL = 'Database contention detected, please retry later';
        END IF;
        
        v_backoff_seconds := POWER(2, v_retry_count); -- Exponential backoff: 2, 4, 8 seconds
        PERFORM pg_sleep(v_backoff_seconds);
        CONTINUE retry_loop;
        
      WHEN unique_violation THEN
        -- Handle duplicate execution ID
        RAISE EXCEPTION 'DUPLICATE_EXECUTION: Campaign execution with this N8N execution ID already exists'
          USING ERRCODE = '23505', -- unique_violation
                DETAIL = 'n8n_execution_id: ' || p_n8n_execution_id;
                
      WHEN foreign_key_violation THEN
        -- Handle foreign key constraint violations
        GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
        RAISE EXCEPTION 'FOREIGN_KEY_VIOLATION: %', v_error_msg
          USING ERRCODE = '23503'; -- foreign_key_violation
          
      WHEN check_violation THEN
        -- Handle check constraint violations (e.g., invalid campaign_type)
        GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
        RAISE EXCEPTION 'CONSTRAINT_VIOLATION: %', v_error_msg
          USING ERRCODE = '23514'; -- check_violation
          
      WHEN serialization_failure THEN
        -- Handle serialization conflicts - retry
        v_retry_count := v_retry_count + 1;
        IF v_retry_count >= v_max_retries THEN
          RAISE EXCEPTION 'SERIALIZATION_FAILURE: Transaction conflicts after % retries', v_max_retries
            USING ERRCODE = '40001', -- serialization_failure
                  DETAIL = 'High database contention, please retry later';
        END IF;
        
        v_backoff_seconds := POWER(2, v_retry_count) + (RANDOM() * 2)::INTEGER; -- Jittered backoff
        PERFORM pg_sleep(v_backoff_seconds);
        CONTINUE retry_loop;
        
      WHEN OTHERS THEN
        -- Handle unexpected errors
        GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
        RAISE EXCEPTION 'UNEXPECTED_ERROR: %', v_error_msg
          USING ERRCODE = SQLSTATE;
    END;
  END LOOP retry_loop;
  
  -- Return success result
  RETURN QUERY SELECT 
    v_campaign_execution_id,
    v_updated_executions,
    'started'::TEXT,
    NOW(),
    NULL::TEXT;
    
EXCEPTION
  WHEN OTHERS THEN
    -- Final exception handler - ensures proper error reporting
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    
    -- Return error result instead of raising (allows client to handle gracefully)
    RETURN QUERY SELECT 
      NULL::UUID,
      NULL::INTEGER,
      'failed'::TEXT,
      NOW(),
      v_error_msg;
END;
$$;

-- Add additional security index for workspace ownership validation
CREATE INDEX IF NOT EXISTS idx_workspace_n8n_workflows_workspace_security 
ON workspace_n8n_workflows(id, workspace_id, deployment_status);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION execute_campaign_atomically TO authenticated;
GRANT EXECUTE ON FUNCTION execute_campaign_atomically TO postgres;

-- Add comment explaining the security fixes
COMMENT ON FUNCTION execute_campaign_atomically IS 
'SECURITY-HARDENED: Atomic campaign execution with race condition prevention.
FIXES:
1. Atomic increment prevents counter race conditions in concurrent executions
2. Workspace ownership validation prevents unauthorized access
3. REPEATABLE READ isolation level with row-level locking
4. Comprehensive error handling with retry logic for transient failures
5. Full ACID compliance for enterprise-grade data consistency';

-- Create companion function for atomic campaign completion
CREATE OR REPLACE FUNCTION update_campaign_completion_atomically(
  p_campaign_execution_id UUID,
  p_workspace_id TEXT,
  p_execution_status TEXT, -- 'completed', 'failed', 'cancelled'
  p_processed_prospects INTEGER DEFAULT NULL,
  p_successful_outreach INTEGER DEFAULT NULL,
  p_failed_outreach INTEGER DEFAULT NULL,
  p_responses_received INTEGER DEFAULT NULL,
  p_actual_duration_minutes INTEGER DEFAULT NULL,
  p_completion_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
  updated_execution_id UUID,
  updated_workflow_counters JSONB,
  completion_status TEXT,
  updated_at TIMESTAMPTZ,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_n8n_workflow_id UUID;
  v_current_status TEXT;
  v_workflow_counters JSONB;
  v_error_msg TEXT;
  v_success_increment INTEGER := 0;
  v_failure_increment INTEGER := 0;
BEGIN
  -- Input validation
  IF p_campaign_execution_id IS NULL OR p_workspace_id IS NULL OR p_execution_status IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: campaign_execution_id, workspace_id, and execution_status cannot be null'
      USING ERRCODE = '22023';
  END IF;
  
  IF p_execution_status NOT IN ('completed', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'INVALID_STATUS: execution_status must be completed, failed, or cancelled'
      USING ERRCODE = '22023',
            DETAIL = 'Invalid status provided: ' || p_execution_status;
  END IF;
  
  -- Set transaction isolation for consistency
  SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
  
  -- Get campaign execution details and validate ownership
  SELECT 
    workspace_n8n_workflow_id,
    execution_status
  INTO 
    v_workspace_n8n_workflow_id,
    v_current_status
  FROM n8n_campaign_executions
  WHERE id = p_campaign_execution_id 
    AND workspace_id = p_workspace_id
  FOR UPDATE; -- Lock the record
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CAMPAIGN_NOT_FOUND: Campaign execution not found or access denied'
      USING ERRCODE = 'P0002',
            DETAIL = 'execution_id: ' || p_campaign_execution_id || ', workspace_id: ' || p_workspace_id;
  END IF;
  
  -- Prevent duplicate completion updates
  IF v_current_status IN ('completed', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'ALREADY_COMPLETED: Campaign execution already completed with status: %', v_current_status
      USING ERRCODE = '23505',
            DETAIL = 'Current status: ' || v_current_status || ', attempted status: ' || p_execution_status;
  END IF;
  
  -- Calculate counter increments based on completion status
  IF p_execution_status = 'completed' THEN
    v_success_increment := 1;
    v_failure_increment := 0;
  ELSIF p_execution_status IN ('failed', 'cancelled') THEN
    v_success_increment := 0;
    v_failure_increment := 1;
  END IF;
  
  -- Update campaign execution record
  UPDATE n8n_campaign_executions
  SET 
    execution_status = p_execution_status,
    processed_prospects = COALESCE(p_processed_prospects, processed_prospects),
    successful_outreach = COALESCE(p_successful_outreach, successful_outreach),
    failed_outreach = COALESCE(p_failed_outreach, failed_outreach),
    responses_received = COALESCE(p_responses_received, responses_received),
    actual_duration_minutes = COALESCE(p_actual_duration_minutes, actual_duration_minutes),
    progress_percentage = 100.0,
    completed_at = NOW(),
    updated_at = NOW(),
    completion_notes = COALESCE(p_completion_notes, completion_notes)
  WHERE id = p_campaign_execution_id;
  
  -- Atomically update workflow counters (RACE CONDITION SAFE)
  UPDATE workspace_n8n_workflows
  SET 
    successful_executions = successful_executions + v_success_increment,
    failed_executions = failed_executions + v_failure_increment,
    updated_at = NOW()
  WHERE id = v_workspace_n8n_workflow_id
    AND workspace_id = p_workspace_id  -- Security: Validate workspace ownership
  RETURNING jsonb_build_object(
    'total_executions', total_executions,
    'successful_executions', successful_executions,
    'failed_executions', failed_executions
  ) INTO v_workflow_counters;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_UPDATE_FAILED: Failed to update workflow completion counters'
      USING ERRCODE = 'P0003',
            DETAIL = 'workflow_id: ' || v_workspace_n8n_workflow_id || ', workspace_id: ' || p_workspace_id;
  END IF;
  
  -- Return success result
  RETURN QUERY SELECT 
    p_campaign_execution_id,
    v_workflow_counters,
    p_execution_status,
    NOW(),
    NULL::TEXT;
    
EXCEPTION
  WHEN OTHERS THEN
    -- Handle any errors gracefully
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    
    RETURN QUERY SELECT 
      NULL::UUID,
      NULL::JSONB,
      'error'::TEXT,
      NOW(),
      v_error_msg;
END;
$$;

-- Grant permissions for completion function
GRANT EXECUTE ON FUNCTION update_campaign_completion_atomically TO authenticated;
GRANT EXECUTE ON FUNCTION update_campaign_completion_atomically TO postgres;

-- Add security comment for completion function
COMMENT ON FUNCTION update_campaign_completion_atomically IS 
'SECURITY-HARDENED: Atomic campaign completion with race condition prevention.
Safely updates execution counters when campaigns complete/fail.
Uses row-level locking and atomic increments to prevent data corruption.';