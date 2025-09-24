-- Sam Funnel Functions - Deploy LAST after tables and indexes
-- Execute this in Supabase Dashboard after all other SQL files

-- Function to update execution performance metrics
CREATE OR REPLACE FUNCTION update_sam_funnel_execution_metrics(p_execution_id UUID)
RETURNS VOID AS $$
DECLARE
  v_prospects_responded INTEGER;
  v_prospects_converted INTEGER;
  v_prospects_total INTEGER;
  v_response_rate DECIMAL(5,2);
  v_conversion_rate DECIMAL(5,2);
BEGIN
  SELECT 
    COUNT(DISTINCT CASE WHEN sfr.response_type IS NOT NULL THEN sfr.prospect_id END),
    COUNT(DISTINCT CASE WHEN sfr.response_type = 'positive' THEN sfr.prospect_id END),
    sfe.prospects_total
  INTO v_prospects_responded, v_prospects_converted, v_prospects_total
  FROM sam_funnel_executions sfe
  LEFT JOIN sam_funnel_responses sfr ON sfe.id = sfr.execution_id
  WHERE sfe.id = p_execution_id
  GROUP BY sfe.prospects_total;

  v_response_rate := CASE WHEN v_prospects_total > 0 
    THEN (v_prospects_responded::DECIMAL / v_prospects_total::DECIMAL) * 100 
    ELSE 0 END;
  
  v_conversion_rate := CASE WHEN v_prospects_responded > 0 
    THEN (v_prospects_converted::DECIMAL / v_prospects_responded::DECIMAL) * 100 
    ELSE 0 END;

  UPDATE sam_funnel_executions 
  SET 
    prospects_responded = v_prospects_responded,
    response_rate = v_response_rate,
    conversion_rate = v_conversion_rate,
    updated_at = NOW()
  WHERE id = p_execution_id;
END;
$$ LANGUAGE plpgsql;

-- Function to handle qualification responses
CREATE OR REPLACE FUNCTION process_qualification_response(
  p_execution_id UUID,
  p_message_id UUID,
  p_prospect_id UUID,
  p_qualification_option TEXT,
  p_response_content TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_action TEXT;
  v_follow_up_date TIMESTAMP WITH TIME ZONE;
  result JSONB;
BEGIN
  CASE p_qualification_option
    WHEN 'a' THEN 
      v_action := 'schedule_follow_up';
      v_follow_up_date := NOW() + INTERVAL '3 weeks';
    WHEN 'b' THEN 
      v_action := 'mark_dnc';
    WHEN 'c' THEN 
      v_action := 'send_calendar_link';
    WHEN 'd' THEN 
      v_action := 'mark_dnc_and_unsubscribe';
    ELSE
      v_action := 'requires_manual_review';
  END CASE;

  INSERT INTO sam_funnel_responses (
    execution_id,
    message_id,
    prospect_id,
    response_type,
    response_content,
    qualification_option,
    qualification_meaning,
    action_taken,
    follow_up_scheduled_date,
    requires_approval
  ) VALUES (
    p_execution_id,
    p_message_id,
    p_prospect_id,
    'qualification',
    p_response_content,
    p_qualification_option,
    CASE p_qualification_option
      WHEN 'a' THEN 'Not right time - follow up later'
      WHEN 'b' THEN 'Has solution - remove from list'
      WHEN 'c' THEN 'Interested - schedule meeting'
      WHEN 'd' THEN 'Not interested - opt out'
    END,
    v_action,
    v_follow_up_date,
    p_qualification_option = 'c'
  );

  UPDATE campaign_prospects 
  SET 
    status = CASE 
      WHEN p_qualification_option = 'a' THEN 'follow_up_scheduled'
      WHEN p_qualification_option = 'b' THEN 'dnc'
      WHEN p_qualification_option = 'c' THEN 'meeting_requested'
      WHEN p_qualification_option = 'd' THEN 'opted_out'
    END,
    follow_up_date = v_follow_up_date,
    updated_at = NOW()
  WHERE id = p_prospect_id;

  result := jsonb_build_object(
    'action', v_action,
    'follow_up_date', v_follow_up_date,
    'requires_approval', p_qualification_option = 'c'
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update execution metrics when responses are added
CREATE OR REPLACE FUNCTION trigger_update_execution_metrics()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_sam_funnel_execution_metrics(NEW.execution_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update timestamps
CREATE OR REPLACE FUNCTION update_sam_funnel_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_sam_funnel_response_metrics
  AFTER INSERT OR UPDATE ON sam_funnel_responses
  FOR EACH ROW 
  EXECUTE FUNCTION trigger_update_execution_metrics();

CREATE TRIGGER trigger_sam_funnel_executions_updated_at 
  BEFORE UPDATE ON sam_funnel_executions 
  FOR EACH ROW EXECUTE FUNCTION update_sam_funnel_updated_at();

CREATE TRIGGER trigger_sam_funnel_messages_updated_at 
  BEFORE UPDATE ON sam_funnel_messages 
  FOR EACH ROW EXECUTE FUNCTION update_sam_funnel_updated_at();

CREATE TRIGGER trigger_sam_funnel_responses_updated_at 
  BEFORE UPDATE ON sam_funnel_responses 
  FOR EACH ROW EXECUTE FUNCTION update_sam_funnel_updated_at();