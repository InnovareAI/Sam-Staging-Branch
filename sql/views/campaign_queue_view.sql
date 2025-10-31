-- Campaign Queue View
-- Shows all prospects currently in n8n queue with their timing data

CREATE OR REPLACE VIEW campaign_queue_view AS
SELECT
  cp.id,
  cp.campaign_id,
  c.name as campaign_name,
  c.workspace_id,
  cp.first_name,
  cp.last_name,
  cp.linkedin_url,
  cp.status,
  cp.personalization_data->>'queued_at' as queued_at,
  cp.personalization_data->>'n8n_execution_id' as n8n_execution_id,
  cp.personalization_data->>'send_delay_minutes' as send_delay_minutes,
  cp.personalization_data->>'pattern_index' as pattern_index,
  cp.personalization_data->>'daily_pattern_seed' as daily_pattern_seed,

  -- Calculate estimated send time
  (cp.personalization_data->>'queued_at')::timestamp +
  ((cp.personalization_data->>'send_delay_minutes')::integer * INTERVAL '1 minute') as estimated_send_time,

  -- Time until send
  ((cp.personalization_data->>'queued_at')::timestamp +
   ((cp.personalization_data->>'send_delay_minutes')::integer * INTERVAL '1 minute')) - NOW() as time_until_send,

  cp.created_at,
  c.campaign_type,
  c.status as campaign_status

FROM campaign_prospects cp
JOIN campaigns c ON c.id = cp.campaign_id
WHERE cp.status = 'queued_in_n8n'
ORDER BY
  cp.personalization_data->>'queued_at' DESC,
  (cp.personalization_data->>'send_delay_minutes')::integer ASC;

-- Grant access to authenticated users
GRANT SELECT ON campaign_queue_view TO authenticated;

COMMENT ON VIEW campaign_queue_view IS 'Shows all prospects currently queued in n8n with estimated send times';
