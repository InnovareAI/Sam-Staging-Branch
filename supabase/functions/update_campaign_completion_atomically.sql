-- Atomic Campaign Completion Function
-- Safely updates execution counters when campaigns complete
-- Prevents race conditions in success/failure counter updates

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

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_campaign_completion_atomically TO authenticated;
GRANT EXECUTE ON FUNCTION update_campaign_completion_atomically TO postgres;

-- Add security comment
COMMENT ON FUNCTION update_campaign_completion_atomically IS 
'SECURITY-HARDENED: Atomic campaign completion with race condition prevention.
Safely updates execution counters when campaigns complete/fail.
Uses row-level locking and atomic increments to prevent data corruption.';