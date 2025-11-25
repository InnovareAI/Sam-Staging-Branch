-- ============================================
-- SAM AI DATABASE ANALYSIS QUERIES
-- ============================================

-- 1. DATA INTEGRITY CHECKS
-- ============================================

-- 1.1 Orphaned campaign_prospects (no parent campaign)
SELECT 'Orphaned campaign_prospects' AS issue,
       COUNT(*) AS affected_records
FROM campaign_prospects cp
WHERE NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.id = cp.campaign_id);

-- 1.2 Orphaned campaign_messages (no parent campaign)
SELECT 'Orphaned campaign_messages' AS issue,
       COUNT(*) AS affected_records
FROM campaign_messages cm
WHERE NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.id = cm.campaign_id);

-- 1.3 Orphaned send_queue entries (no parent campaign or prospect)
SELECT 'Orphaned send_queue (no campaign)' AS issue,
       COUNT(*) AS affected_records
FROM send_queue sq
WHERE NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.id = sq.campaign_id);

SELECT 'Orphaned send_queue (no prospect)' AS issue,
       COUNT(*) AS affected_records
FROM send_queue sq
WHERE NOT EXISTS (SELECT 1 FROM campaign_prospects cp WHERE cp.id = sq.prospect_id);

-- 1.4 Campaigns with NULL workspace_id
SELECT 'Campaigns with NULL workspace_id' AS issue,
       COUNT(*) AS affected_records
FROM campaigns
WHERE workspace_id IS NULL;

-- 1.5 Campaign prospects with NULL required fields
SELECT 'Campaign prospects with NULL linkedin_user_id' AS issue,
       COUNT(*) AS affected_records
FROM campaign_prospects
WHERE linkedin_user_id IS NULL;

SELECT 'Campaign prospects with NULL campaign_id' AS issue,
       COUNT(*) AS affected_records
FROM campaign_prospects
WHERE campaign_id IS NULL;

-- 1.6 Duplicate campaign prospects (same prospect in same campaign)
SELECT 'Duplicate prospects in campaigns' AS issue,
       COUNT(*) AS affected_records
FROM (
  SELECT campaign_id, linkedin_user_id, COUNT(*) as cnt
  FROM campaign_prospects
  GROUP BY campaign_id, linkedin_user_id
  HAVING COUNT(*) > 1
) AS duplicates;

-- 2. CAMPAIGN STATE CONSISTENCY
-- ============================================

-- 2.1 Active campaigns with no pending queue entries
SELECT 'Active campaigns with no queue entries' AS issue,
       COUNT(DISTINCT c.id) AS affected_records
FROM campaigns c
WHERE c.status = 'active'
AND c.campaign_type = 'linkedin'
AND NOT EXISTS (
  SELECT 1 FROM send_queue sq
  WHERE sq.campaign_id = c.id
  AND sq.status = 'pending'
);

-- 2.2 Prospects with 'pending' status in active campaigns (should have queue entry)
SELECT 'Pending prospects missing queue entries' AS issue,
       COUNT(*) AS affected_records
FROM campaign_prospects cp
JOIN campaigns c ON c.id = cp.campaign_id
WHERE cp.connection_request_sent = 'pending'
AND c.status = 'active'
AND NOT EXISTS (
  SELECT 1 FROM send_queue sq
  WHERE sq.prospect_id = cp.id
  AND sq.status = 'pending'
);

-- 2.3 Queue entries stuck (past scheduled_for, still pending)
SELECT 'Stuck queue entries (past scheduled time)' AS issue,
       COUNT(*) AS affected_records
FROM send_queue
WHERE status = 'pending'
AND scheduled_for < NOW() - INTERVAL '10 minutes';

-- 2.4 Queue entries without scheduled_for
SELECT 'Queue entries with NULL scheduled_for' AS issue,
       COUNT(*) AS affected_records
FROM send_queue
WHERE scheduled_for IS NULL;

-- 2.5 Prospects marked as sent but no queue record
SELECT 'Prospects marked sent with no queue record' AS issue,
       COUNT(*) AS affected_records
FROM campaign_prospects cp
WHERE cp.connection_request_sent IN ('sent', 'accepted')
AND NOT EXISTS (
  SELECT 1 FROM send_queue sq
  WHERE sq.prospect_id = cp.id
  AND sq.status IN ('sent', 'completed')
);

-- 3. WORKSPACE ISOLATION CHECKS
-- ============================================

-- 3.1 Campaigns with workspace_id not in workspaces table
SELECT 'Campaigns with invalid workspace_id' AS issue,
       COUNT(*) AS affected_records
FROM campaigns c
WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = c.workspace_id);

-- 3.2 Workspace_prospects with invalid workspace_id
SELECT 'Workspace_prospects with invalid workspace_id' AS issue,
       COUNT(*) AS affected_records
FROM workspace_prospects wp
WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = wp.workspace_id);

-- 3.3 Users in workspace_members but not in users table
SELECT 'Workspace_members with invalid user_id' AS issue,
       COUNT(*) AS affected_records
FROM workspace_members wm
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = wm.user_id);

-- 3.4 Workspace_members without workspace
SELECT 'Workspace_members with invalid workspace_id' AS issue,
       COUNT(*) AS affected_records
FROM workspace_members wm
WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = wm.workspace_id);

-- 4. PERFORMANCE ANALYSIS
-- ============================================

-- 4.1 Missing indexes check
SELECT 'Missing indexes analysis' AS note,
       'See index report below' AS details;

-- 4.2 Tables with most rows
SELECT 'Large tables' AS analysis,
       schemaname,
       tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
       (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND tablename = t.tablename) AS index_count
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- 5. RLS POLICY AUDIT
-- ============================================

-- 5.1 Tables without RLS enabled
SELECT 'Tables without RLS enabled' AS issue,
       tablename AS table_name
FROM pg_tables t
WHERE schemaname = 'public'
AND NOT EXISTS (
  SELECT 1 FROM pg_policies p
  WHERE p.schemaname = 'public'
  AND p.tablename = t.tablename
)
ORDER BY tablename;

-- 6. EMAIL QUEUE ANALYSIS
-- ============================================

-- 6.1 Email queue stuck entries
SELECT 'Email queue stuck entries' AS issue,
       COUNT(*) AS affected_records
FROM email_send_queue
WHERE status = 'pending'
AND scheduled_for < NOW() - INTERVAL '1 hour';

-- 6.2 Email queue entries without workspace
SELECT 'Email queue with invalid workspace_id' AS issue,
       COUNT(*) AS affected_records
FROM email_send_queue eq
WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = eq.workspace_id);

-- 7. LINKEDIN COMMENT QUEUE ANALYSIS
-- ============================================

-- 7.1 Comment queue stuck entries
SELECT 'Comment queue stuck entries' AS issue,
       COUNT(*) AS affected_records
FROM linkedin_comment_queue
WHERE status = 'pending'
AND scheduled_for < NOW() - INTERVAL '1 hour';

-- 8. USER AND UNIPILE ACCOUNT CONSISTENCY
-- ============================================

-- 8.1 Users without any workspace membership
SELECT 'Users without workspace membership' AS issue,
       COUNT(*) AS affected_records
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_members wm WHERE wm.user_id = u.id
);

-- 8.2 Unipile accounts without valid user
SELECT 'Unipile accounts with invalid user_id' AS issue,
       COUNT(*) AS affected_records
FROM user_unipile_accounts uua
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = uua.user_id);

-- 8.3 Unipile accounts with connection_status issues
SELECT 'Unipile accounts disconnected' AS issue,
       COUNT(*) AS affected_records
FROM user_unipile_accounts
WHERE connection_status != 'connected';

-- 9. WORKSPACE TIER AND BILLING CONSISTENCY
-- ============================================

-- 9.1 Workspaces without tier assignment
SELECT 'Workspaces without tier' AS issue,
       COUNT(*) AS affected_records
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_tiers wt WHERE wt.workspace_id = w.id
);

-- 9.2 Workspace_tiers with invalid workspace_id
SELECT 'Workspace_tiers with invalid workspace' AS issue,
       COUNT(*) AS affected_records
FROM workspace_tiers wt
WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = wt.workspace_id);

-- 10. KNOWLEDGE BASE CONSISTENCY
-- ============================================

-- 10.1 Knowledge base entries without workspace
SELECT 'Knowledge base entries with invalid workspace' AS issue,
       COUNT(*) AS affected_records
FROM knowledge_base kb
WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = kb.workspace_id);

-- 10.2 Knowledge base sections without parent
SELECT 'Knowledge base sections with invalid parent' AS issue,
       COUNT(*) AS affected_records
FROM knowledge_base_sections kbs
WHERE NOT EXISTS (SELECT 1 FROM knowledge_base kb WHERE kb.id = kbs.knowledge_base_id);
