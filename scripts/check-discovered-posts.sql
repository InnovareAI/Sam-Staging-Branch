-- Check discovered posts and their statuses
SELECT
  monitor_id,
  status,
  COUNT(*) as count
FROM linkedin_posts_discovered
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009' -- InnovareAI workspace
GROUP BY monitor_id, status
ORDER BY monitor_id, status;

-- Check specific posts that could have comments generated
SELECT
  id,
  author_name,
  LEFT(post_content, 100) as content_preview,
  status,
  created_at
FROM linkedin_posts_discovered
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND status = 'discovered'
ORDER BY created_at DESC
LIMIT 10;

-- Check if any comments exist at all
SELECT
  status,
  COUNT(*) as count
FROM linkedin_post_comments
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
GROUP BY status;
