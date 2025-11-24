-- Check if duplicates still exist in database
-- Run this in Supabase SQL Editor

-- Check for the specific Chet Moss post that's duplicated
SELECT
  id,
  share_url,
  post_content,
  created_at,
  comment_count,
  reaction_count
FROM linkedin_posts_discovered
WHERE author_name = 'Chet Moss'
  AND post_content LIKE '%spellcheck%'
ORDER BY created_at DESC;

-- Check all duplicates by URL
SELECT
  share_url,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as post_ids
FROM linkedin_posts_discovered
GROUP BY share_url
HAVING COUNT(*) > 1;

-- Check all duplicates by content
SELECT
  LEFT(post_content, 100) as content_preview,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as post_ids
FROM linkedin_posts_discovered
GROUP BY post_content
HAVING COUNT(*) > 1;
