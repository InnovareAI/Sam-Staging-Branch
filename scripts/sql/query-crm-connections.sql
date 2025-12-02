-- Query CRM Connections
-- Use: psql $SUPABASE_DATABASE_URL -f scripts/sql/query-crm-connections.sql

\echo '🔍 Active CRM Connections'
SELECT
  workspace_id,
  crm_type,
  crm_account_name,
  status,
  connected_at,
  last_synced_at
FROM crm_connections
WHERE status = 'active'
ORDER BY connected_at DESC;

\echo ''
\echo '📊 CRM Connection Summary'
SELECT
  crm_type,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
  COUNT(CASE WHEN last_synced_at > NOW() - INTERVAL '1 hour' THEN 1 END) as synced_recently
FROM crm_connections
GROUP BY crm_type
ORDER BY total DESC;

\echo ''
\echo '🔄 Recent Sync Logs (Last 10)'
SELECT
  workspace_id,
  sync_type,
  entity_type,
  status,
  records_processed,
  records_succeeded,
  records_failed,
  created_at
FROM crm_sync_logs
ORDER BY created_at DESC
LIMIT 10;
