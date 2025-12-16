import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://latxadqrvrrrcvkktrog.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ');

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';
const BRIAN_UNIPILE_ID = 'RFrEaJZOSGieognCTW0V6w';

async function deleteAll() {
  // Get ALL posted comments
  const { data: posted } = await supabase
    .from('linkedin_post_comments')
    .select('id, unipile_comment_id, comment_text, post:linkedin_posts_discovered(social_id, share_url, author_name)')
    .eq('workspace_id', 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7')
    .eq('status', 'posted');

  console.log('POSTED COMMENTS TO DELETE:', posted?.length || 0);

  for (const comment of posted || []) {
    console.log('\n--- DELETING ---');
    console.log('Author:', comment.post?.author_name);
    console.log('Comment:', comment.comment_text?.substring(0, 50));
    console.log('Unipile ID:', comment.unipile_comment_id);

    // Get post social ID
    let postId = comment.post?.social_id;
    if (!postId && comment.post?.share_url) {
      const match = comment.post.share_url.match(/activity-(\d+)/);
      if (match) postId = 'urn:li:activity:' + match[1];
    }

    // Try to delete by unipile_comment_id first
    if (comment.unipile_comment_id) {
      const res = await fetch(
        `https://${UNIPILE_DSN}/api/v1/posts/comments/${comment.unipile_comment_id}?account_id=${BRIAN_UNIPILE_ID}`,
        { method: 'DELETE', headers: { 'X-API-KEY': UNIPILE_API_KEY } }
      );
      console.log('Delete by ID result:', res.status);
      if (res.ok || res.status === 204) {
        console.log('✅ DELETED');
        await supabase.from('linkedin_post_comments').update({ status: 'deleted' }).eq('id', comment.id);
        continue;
      }
    }

    // If no ID or failed, try to find comment on the post
    if (postId) {
      console.log('Searching comments on post:', postId);

      // First resolve the post
      const resolveRes = await fetch(
        `https://${UNIPILE_DSN}/api/v1/posts/${encodeURIComponent(postId)}?account_id=${BRIAN_UNIPILE_ID}`,
        { headers: { 'X-API-KEY': UNIPILE_API_KEY } }
      );

      if (resolveRes.ok) {
        const postData = await resolveRes.json();
        const ugcPostId = postData.social_id || postId;
        console.log('Resolved to:', ugcPostId);

        // Get comments
        const commentsRes = await fetch(
          `https://${UNIPILE_DSN}/api/v1/posts/${encodeURIComponent(ugcPostId)}/comments?account_id=${BRIAN_UNIPILE_ID}`,
          { headers: { 'X-API-KEY': UNIPILE_API_KEY } }
        );

        if (commentsRes.ok) {
          const commentsData = await commentsRes.json();
          console.log('Found', commentsData.items?.length || 0, 'comments');

          // Find Brian's comment by matching text
          const brianComment = commentsData.items?.find(c => {
            const searchText = comment.comment_text?.substring(0, 30);
            return c.text?.includes(searchText);
          });

          if (brianComment) {
            console.log('Found matching comment:', brianComment.id);
            const delRes = await fetch(
              `https://${UNIPILE_DSN}/api/v1/posts/comments/${brianComment.id}?account_id=${BRIAN_UNIPILE_ID}`,
              { method: 'DELETE', headers: { 'X-API-KEY': UNIPILE_API_KEY } }
            );
            console.log('Delete result:', delRes.status);
            if (delRes.ok || delRes.status === 204) {
              console.log('✅ DELETED');
              await supabase.from('linkedin_post_comments').update({ status: 'deleted' }).eq('id', comment.id);
            }
          } else {
            console.log('Could not find matching comment on post');
          }
        }
      }
    }
  }

  console.log('\n=== DONE ===');
}

deleteAll().catch(console.error);
