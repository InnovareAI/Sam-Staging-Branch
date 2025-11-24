-- Check Dave Hayward duplicate specifically
SELECT
  id,
  social_id,
  share_url,
  SUBSTRING(post_content, 1, 50) as content_preview,
  engagement_metrics->>'reactions' as reactions,
  engagement_metrics->>'comments' as comments,
  engagement_metrics->>'reposts' as reposts,
  created_at
FROM linkedin_posts_discovered
WHERE author_name = 'Dave Hayward'
  AND post_content LIKE '%AI Corner%'
ORDER BY created_at DESC;

-- Check if they have the same social_id
SELECT
  social_id,
  COUNT(*) as count,
  ARRAY_AGG(id) as post_ids
FROM linkedin_posts_discovered
WHERE author_name = 'Dave Hayward'
  AND post_content LIKE '%AI Corner%'
GROUP BY social_id;

-- Check all duplicates still remaining
SELECT
  social_id,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(author_name) as authors,
  ARRAY_AGG(LEFT(post_content, 50)) as content_previews
FROM linkedin_posts_discovered
WHERE social_id IS NOT NULL
GROUP BY social_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 10;
