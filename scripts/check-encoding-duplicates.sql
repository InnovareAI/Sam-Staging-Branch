-- Check for encoding-based duplicates
-- Posts with same author + similar date but different content encoding

-- Check Anna Tavano posts
SELECT
  id,
  LEFT(share_url, 80) as url_preview,
  author_name,
  created_at,
  LENGTH(post_content) as content_length,
  SUBSTRING(post_content, 1, 100) as content_preview,
  reaction_count,
  comment_count
FROM linkedin_posts_discovered
WHERE author_name = 'Anna Tavano'
  AND post_content LIKE '%India continues%'
ORDER BY created_at DESC;

-- Check Chet Moss posts
SELECT
  id,
  LEFT(share_url, 80) as url_preview,
  author_name,
  created_at,
  LENGTH(post_content) as content_length,
  SUBSTRING(post_content, 1, 100) as content_preview,
  reaction_count,
  comment_count
FROM linkedin_posts_discovered
WHERE author_name = 'Chet Moss'
  AND post_content LIKE '%spellcheck%'
ORDER BY created_at DESC;

-- Check all potential duplicates (same author + date, different content)
SELECT
  author_name,
  DATE(post_date) as date,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id) as post_ids
FROM linkedin_posts_discovered
GROUP BY author_name, DATE(post_date)
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 10;
