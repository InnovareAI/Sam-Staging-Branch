-- Diagnose duplicates by social_id (FIXED - correct column names)
-- The social_id (LinkedIn URN) should be the source of truth

-- Check if duplicates share the same social_id
SELECT
  social_id,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id) as post_ids,
  ARRAY_AGG(share_url) as urls,
  ARRAY_AGG(author_name) as authors,
  ARRAY_AGG(created_at ORDER BY created_at) as created_times
FROM linkedin_posts_discovered
WHERE social_id IS NOT NULL
GROUP BY social_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 10;

-- Check posts with NULL social_id (these might be problematic)
SELECT
  COUNT(*) as posts_with_null_social_id
FROM linkedin_posts_discovered
WHERE social_id IS NULL;

-- Check the Chet Moss duplicate specifically
SELECT
  id,
  social_id,
  share_url,
  SUBSTRING(post_content, 1, 50) as content_preview,
  engagement_metrics->>'reactions' as reactions,
  engagement_metrics->>'comments' as comments,
  created_at
FROM linkedin_posts_discovered
WHERE author_name = 'Chet Moss'
  AND post_content LIKE '%spellcheck%'
ORDER BY created_at DESC;

-- Check the Anna Tavano duplicate specifically
SELECT
  id,
  social_id,
  share_url,
  SUBSTRING(post_content, 1, 50) as content_preview,
  engagement_metrics->>'reactions' as reactions,
  engagement_metrics->>'comments' as comments,
  created_at
FROM linkedin_posts_discovered
WHERE author_name = 'Anna Tavano'
  AND post_content LIKE '%India continues%'
ORDER BY created_at DESC;
