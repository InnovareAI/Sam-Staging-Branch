import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://latxadqrvrrrcvkktrog.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ');

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';
const BRIAN_UNIPILE_ID = 'RFrEaJZOSGieognCTW0V6w';
const BRIAN_LINKEDIN_ID = 'ACoAAAD-i_IBPhZ311Obft4g7uzqA1W1rvR7s_E';

// BAD comment ID
const BAD_COMMENT_ID = '3a66435d-b240-40bd-a660-e3037775573b';
const BAD_POST_ID = '5a77bc83-6696-4127-9b3a-78cda66bc173';

async function deleteBadComment() {
  console.log('DELETING BAD COMMENT FROM LINKEDIN');
  console.log('='.repeat(60));

  // Get the post details
  const { data: post } = await supabase
    .from('linkedin_posts_discovered')
    .select('social_id, share_url, author_name')
    .eq('id', BAD_POST_ID)
    .single();

  console.log('Post by:', post?.author_name);
  console.log('Share URL:', post?.share_url);

  // Extract activity ID
  let postId = post?.social_id;
  if (!postId && post?.share_url) {
    const match = post.share_url.match(/activity-(\d+)/);
    if (match) postId = 'urn:li:activity:' + match[1];
  }

  console.log('Post ID:', postId);

  // Resolve to ugcPost
  const resolveRes = await fetch(
    `https://${UNIPILE_DSN}/api/v1/posts/${encodeURIComponent(postId)}?account_id=${BRIAN_UNIPILE_ID}`,
    { headers: { 'X-API-KEY': UNIPILE_API_KEY } }
  );

  if (!resolveRes.ok) {
    console.log('Failed to resolve post:', await resolveRes.text());
    return;
  }

  const postData = await resolveRes.json();
  const ugcPostId = postData.social_id || postId;
  console.log('Resolved post ID:', ugcPostId);

  // Get comments on this post
  const commentsRes = await fetch(
    `https://${UNIPILE_DSN}/api/v1/posts/${encodeURIComponent(ugcPostId)}/comments?account_id=${BRIAN_UNIPILE_ID}`,
    { headers: { 'X-API-KEY': UNIPILE_API_KEY } }
  );

  if (!commentsRes.ok) {
    console.log('Failed to get comments:', await commentsRes.text());
    return;
  }

  const commentsData = await commentsRes.json();
  console.log('Total comments on post:', commentsData.items?.length || 0);

  // Find Brian's comment
  for (const c of commentsData.items || []) {
    console.log('\nComment by:', c.author?.name, '(' + c.author?.id + ')');
    console.log('Text:', c.text?.substring(0, 60));

    // Check if it's Brian's comment
    if (c.author?.id === BRIAN_LINKEDIN_ID || c.text?.includes('Fascinating perspective')) {
      console.log('\n>>> FOUND BRIAN\'S BAD COMMENT <<<');
      console.log('Comment ID:', c.id);

      // DELETE IT
      const deleteRes = await fetch(
        `https://${UNIPILE_DSN}/api/v1/posts/comments/${c.id}?account_id=${BRIAN_UNIPILE_ID}`,
        { method: 'DELETE', headers: { 'X-API-KEY': UNIPILE_API_KEY } }
      );

      console.log('Delete status:', deleteRes.status);
      const deleteText = await deleteRes.text();
      console.log('Delete response:', deleteText);

      if (deleteRes.ok || deleteRes.status === 204 || deleteRes.status === 200) {
        console.log('✅ DELETED FROM LINKEDIN');

        // Update DB
        await supabase
          .from('linkedin_post_comments')
          .update({ status: 'deleted' })
          .eq('id', BAD_COMMENT_ID);

        console.log('✅ Updated DB status to deleted');
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DONE');
}

deleteBadComment().catch(console.error);
